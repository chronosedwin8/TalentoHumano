import { PrismaClient } from '@prisma/client';
import { addDays, toDateKey } from '@talento/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO, as, closeApp, getApp, login, type Session } from './harness';

/**
 * Criterio de aceptacion 5: una solicitud de vacaciones entra al flujo, se
 * aprueba desde la bandeja del jefe, y el resultado se refleja en el saldo, el
 * calendario y la asistencia.
 */
describe('aprobacion de una ausencia de extremo a extremo', () => {
  const prisma = new PrismaClient();
  let hr: Session;
  let manager: Session;
  let admin: Session;
  let employee: Session;
  let vacationTypeId: string;
  let employeeId: string;
  let requestId: string;
  let instanceId: string;
  let requestedDays = 0;
  let balanceBeforeApproval: { pendingDays: number; takenDays: number };

  // Ventana en la segunda quincena de noviembre, lejos de la que usa el resto
  // de la suite y de las fechas del sembrado.
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), 10, 16));
  const WINDOW_START = toDateKey(start);
  const WINDOW_END = toDateKey(addDays(start, 2));

  beforeAll(async () => {
    await getApp();
    [hr, admin, employee] = await Promise.all([
      login(DEMO.hr),
      login(DEMO.admin),
      login(DEMO.employee),
    ]);
    employeeId = employee.user.employee!.id;

    // El aprobador es el jefe directo real del colaborador, no una cuenta fija:
    // asi la prueba sigue valiendo si cambia el organigrama del sembrado.
    const withManager = await prisma.employee.findFirst({
      where: { id: employeeId },
      include: { manager: { include: { user: true } } },
    });
    const managerEmail = withManager?.manager?.user?.email;
    expect(managerEmail, 'el colaborador demo debe tener jefe con cuenta').toBeTruthy();
    manager = await login(managerEmail!);

    // La suite reserva una ventana propia. Si una corrida anterior la dejo
    // ocupada, se limpia: de otro modo la segunda ejecucion chocaria con su
    // propia solicitud y la restriccion de solapamiento la rechazaria.
    const leftovers = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        startDate: { gte: new Date(`${WINDOW_START}T00:00:00Z`) },
        endDate: { lte: new Date(`${WINDOW_END}T23:59:59Z`) },
      },
      select: { id: true },
    });
    for (const leftover of leftovers) {
      await prisma.attendanceDay.deleteMany({ where: { leaveRequestId: leftover.id } });
      await prisma.workflowStepInstance.deleteMany({
        where: { instance: { entityType: 'leave_request', entityId: leftover.id } },
      });
      await prisma.workflowInstance.deleteMany({
        where: { entityType: 'leave_request', entityId: leftover.id },
      });
      await prisma.notification.deleteMany({
        where: { entityType: 'leave_request', entityId: leftover.id },
      });
      await prisma.auditLog.deleteMany({
        where: { entityType: 'leave_request', entityId: leftover.id },
      });
      await prisma.leaveRequest.delete({ where: { id: leftover.id } });
    }

    const client = await as(hr);
    const types = await client.get('/leaves/types');
    vacationTypeId = types.body.data.find((type: any) => type.code === 'vacaciones').id;

    // Saldo suficiente para la prueba.
    await client.post('/leaves/balances/adjust', {
      employeeId,
      days: 15,
      reason: 'Saldo para la prueba de aprobacion automatizada',
      year: new Date().getUTCFullYear(),
    });

    // Un flujo de un solo paso: aprueba el jefe directo.
    const adminClient = await as(admin);
    const definition = await adminClient.post('/workflows/definitions', {
      key: 'e2e-vacaciones',
      name: 'Aprobacion de ausencias (prueba)',
      entityType: 'leave_request',
      mode: 'sequential',
      isActive: true,
      steps: [{ name: 'Jefe directo', approverType: 'direct_manager', condition: {} }],
    });
    expect([200, 201], definition.text.slice(0, 300)).toContain(definition.status);
  }, 180_000);

  afterAll(async () => {
    // Deja la empresa demo como estaba: el flujo era solo para esta prueba.
    const adminClient = await as(admin);
    const definitions = await adminClient.get('/workflows/definitions?limit=100');
    const created = definitions.body.data?.find((row: any) => row.key === 'e2e-vacaciones');
    if (created) await adminClient.post(`/workflows/definitions/${created.id}/archive`, {});
    await prisma.$disconnect();
    await closeApp();
  });

  it('la solicitud queda pendiente y no aprobada sola', async () => {
    const client = await as(employee);
    const response = await client.post('/leaves/requests', {
      leaveTypeId: vacationTypeId,
      startDate: WINDOW_START,
      endDate: WINDOW_END,
      reason: 'Prueba de aprobacion de extremo a extremo',
      fileIds: [],
    });
    expect([200, 201], response.text.slice(0, 300)).toContain(response.status);
    requestId = response.body.data.id;
    requestedDays = Number(response.body.data.requestedDays);
    expect(response.body.data.status).toBe('pending');
    expect(requestedDays).toBeGreaterThan(0);
  });

  it('reserva el saldo mientras espera aprobacion', async () => {
    const client = await as(employee);
    balanceBeforeApproval = (await client.get(`/leaves/balances/${employeeId}`)).body.data;
    expect(balanceBeforeApproval.pendingDays).toBeGreaterThanOrEqual(requestedDays);
  });

  it('aparece en la bandeja de aprobacion del jefe', async () => {
    const client = await as(manager);
    const inbox = await client.get('/workflows/inbox?limit=50');
    expect(inbox.status).toBe(200);
    const item = inbox.body.data.find((row: any) => row.entityId === requestId);
    expect(item, 'la solicitud debe llegar a la bandeja del jefe directo').toBeTruthy();
    expect(item.entityType).toBe('leave_request');
    expect(item.status).toBe('pending');
    instanceId = item.id;
    expect(instanceId).toBeTruthy();
  });

  it('el solicitante no puede aprobar su propia solicitud', async () => {
    const client = await as(employee);
    const response = await client.post(`/workflows/instances/${instanceId}/approve`, {
      comment: 'Intento no autorizado',
    });
    expect([403, 404]).toContain(response.status);
  });

  it('el jefe aprueba desde la bandeja', async () => {
    const client = await as(manager);
    const response = await client.post(`/workflows/instances/${instanceId}/approve`, {
      comment: 'Aprobado en la prueba automatizada',
    });
    expect([200, 201], response.text.slice(0, 300)).toContain(response.status);
  });

  it('la solicitud queda aprobada', async () => {
    const client = await as(employee);
    const response = await client.get(`/leaves/requests/${requestId}`);
    expect(response.body.data.status).toBe('approved');
  });

  it('el saldo pasa de reservado a tomado', async () => {
    // El colaborador demo puede tener otras solicitudes pendientes, asi que se
    // mide el movimiento de esta y no un total absoluto.
    const client = await as(employee);
    const after = (await client.get(`/leaves/balances/${employeeId}`)).body.data;
    expect(after.pendingDays).toBeCloseTo(balanceBeforeApproval.pendingDays - requestedDays, 2);
    expect(after.takenDays).toBeCloseTo(balanceBeforeApproval.takenDays + requestedDays, 2);
  });

  it('se refleja en el calendario del equipo', async () => {
    const client = await as(hr);
    const response = await client.get(`/leaves/calendar?from=${WINDOW_START}&to=${WINDOW_END}`);
    expect(response.status).toBe(200);
    const rows = response.body.data.items ?? response.body.data;
    const found = JSON.stringify(rows).includes(requestId);
    expect(found, 'la ausencia aprobada debe verse en el calendario').toBe(true);
  });

  it('se refleja en la asistencia de esos dias', async () => {
    const days = await prisma.attendanceDay.findMany({
      where: {
        employeeId,
        date: {
          gte: new Date(`${WINDOW_START}T00:00:00Z`),
          lte: new Date(`${WINDOW_END}T00:00:00Z`),
        },
      },
    });
    expect(days.length, 'la aprobacion debe marcar los dias en asistencia').toBeGreaterThan(0);
    expect(days.every((day) => day.status === 'leave' || day.leaveRequestId === requestId)).toBe(
      true,
    );
  });

  it('la aprobacion queda auditada y se puede rastrear hasta la solicitud', async () => {
    // La decision se audita contra la instancia del flujo, que es la entidad
    // que se resolvio; la instancia apunta a la solicitud.
    const decision = await prisma.auditLog.findFirst({
      where: { entityType: 'workflow_instance', entityId: instanceId, action: 'approve' },
    });
    expect(decision, 'la aprobacion debe quedar en la bitacora').toBeTruthy();
    expect(decision!.actorId, 'debe constar quien aprobo').toBeTruthy();

    const instance = await prisma.workflowInstance.findFirst({ where: { id: instanceId } });
    expect(instance!.entityId).toBe(requestId);

    // Y la creacion de la solicitud tambien esta registrada.
    const creation = await prisma.auditLog.findFirst({
      where: { entityType: 'leave_request', entityId: requestId, action: 'create' },
    });
    expect(creation).toBeTruthy();
  });

  it('notifica al solicitante', async () => {
    const notification = await prisma.notification.findFirst({
      where: { entityType: 'leave_request', entityId: requestId },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification, 'el solicitante debe recibir notificacion').toBeTruthy();
  });

  it('la bandeja del jefe ya no la muestra pendiente', async () => {
    const client = await as(manager);
    const inbox = await client.get('/workflows/inbox?limit=50');
    const stillThere = JSON.stringify(inbox.body.data).includes(requestId);
    expect(stillThere).toBe(false);
  });
});
