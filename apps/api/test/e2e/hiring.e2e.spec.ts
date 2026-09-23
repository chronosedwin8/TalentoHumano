import { PrismaClient } from '@prisma/client';
import { toDateKey } from '@talento/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO, anonymous, as, closeApp, getApp, login, type Session } from './harness';

/**
 * Criterio de aceptacion 6: contratar a un candidato debe crear colaborador,
 * usuario, legajo y proceso de onboarding sin intervencion manual.
 */
describe('contratacion de un candidato', () => {
  const prisma = new PrismaClient();
  let hr: Session;
  let slug: string;
  let jobSlug: string;
  let jobId: string;
  let applicationId: string;
  let employeeId: string;
  const stamp = Date.now();
  const candidateEmail = `contratada.e2e.${stamp}@example.com`;

  beforeAll(async () => {
    await getApp();
    hr = await login(DEMO.hr);
    slug = hr.user.company!.slug;

    // La suite crea y publica su propia vacante. Contratar cierra la vacante
    // cuando se cubren sus plazas, asi que consumir una de las sembradas
    // dejaria el portal de empleo vacio para las demas pruebas.
    const client = await as(hr);
    const created = await client.post('/recruiting/jobs', {
      title: `Vacante de prueba e2e ${stamp}`,
      description: 'Vacante creada por la suite automatizada de contratacion.',
      openings: 50,
      workModality: 'onsite',
      contractType: 'indefinido',
      isInternal: false,
    });
    expect([200, 201], created.text.slice(0, 300)).toContain(created.status);
    jobId = created.body.data.id;
    jobSlug = created.body.data.slug;

    const published = await client.post(`/recruiting/jobs/${jobId}/publish`, {});
    expect([200, 201], published.text.slice(0, 300)).toContain(published.status);

    const publicClient = await anonymous();
    const applied = await publicClient.post(`/public/careers/${slug}/jobs/${jobSlug}/apply`, {
      firstName: 'Contratada',
      lastName: `Prueba${stamp}`,
      email: candidateEmail,
      phone: '3009998877',
      city: 'Medellin',
      source: 'portal',
      consentAccepted: true,
    });
    expect([200, 201]).toContain(applied.status);
    applicationId = applied.body.data.applicationId;
  }, 120_000);

  afterAll(async () => {
    // Cierra la vacante de prueba para no dejarla visible en el portal publico.
    if (jobId) {
      const client = await as(hr);
      await client.post(`/recruiting/jobs/${jobId}/close`, {
        reason: 'Fin de la prueba automatizada',
      });
    }
    await prisma.$disconnect();
    await closeApp();
  });

  it('contrata desde la postulacion', async () => {
    const client = await as(hr);
    const templates = await client.get('/onboarding/templates');
    const templateId = templates.body.data?.[0]?.id ?? null;

    const response = await client.post(`/recruiting/applications/${applicationId}/hire`, {
      hiredAt: toDateKey(new Date()),
      contractType: 'indefinido',
      workModality: 'onsite',
      onboardingTemplateId: templateId,
      createUserAccount: true,
    });
    expect([200, 201], response.text.slice(0, 300)).toContain(response.status);
    employeeId = response.body.data.employeeId;
    expect(employeeId).toBeTruthy();
  });

  it('crea el colaborador en la empresa correcta', async () => {
    const employee = await prisma.employee.findFirst({ where: { id: employeeId } });
    expect(employee).toBeTruthy();
    expect(employee!.companyId).toBe(hr.user.company!.id);
    expect(employee!.fullName).toContain('Contratada');
    expect(employee!.status).toBe('active');
    expect(employee!.hiredAt).toBeTruthy();
  });

  it('crea el contrato del colaborador', async () => {
    const contract = await prisma.employmentContract.findFirst({ where: { employeeId } });
    expect(contract).toBeTruthy();
    expect(contract!.contractType).toBe('indefinido');
  });

  it('crea la cuenta de usuario ligada al colaborador', async () => {
    // El vinculo vive en `employees.user_id`.
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId },
      include: { user: true },
    });
    expect(employee!.userId, 'el colaborador debe quedar ligado a un usuario').toBeTruthy();
    expect(employee!.user!.email).toBeTruthy();

    const companyUser = await prisma.companyUser.findFirst({
      where: { companyId: hr.user.company!.id, userId: employee!.userId! },
      include: { roles: { include: { role: true } } },
    });
    expect(companyUser, 'el usuario debe pertenecer a la empresa').toBeTruthy();
    // Entra como colaborador, nunca con permisos elevados.
    expect(companyUser!.roles.map((assignment) => assignment.role.key)).toContain('employee');
  });

  it('abre el proceso de onboarding con sus tareas', async () => {
    const process = await prisma.onboardingProcess.findFirst({
      where: { employeeId, kind: 'onboarding' },
      include: { tasks: true },
    });
    expect(process, 'debe abrirse un proceso de ingreso').toBeTruthy();
    expect(process!.tasks.length).toBeGreaterThan(0);
    // El enlace de pre-ingreso permite al nuevo colaborador prepararse.
    expect(process!.preboardingToken).toBeTruthy();
  });

  it('el enlace de pre-ingreso funciona sin sesion', async () => {
    const process = await prisma.onboardingProcess.findFirst({ where: { employeeId } });
    const client = await anonymous();
    const response = await client.get(`/onboarding/preboarding/${process!.preboardingToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.employee.fullName).toContain('Contratada');
  });

  it('marca la postulacion como contratada y vincula al candidato', async () => {
    const application = await prisma.application.findFirst({ where: { id: applicationId } });
    expect(application!.status).toBe('hired');

    const candidate = await prisma.candidate.findFirst({ where: { email: candidateEmail } });
    expect(candidate!.hiredEmployeeId).toBe(employeeId);
    // Al ser contratado deja de estar sujeto a la retencion de datos.
    expect(candidate!.retentionUntil).toBeNull();
  });

  it('deja la contratacion registrada en la auditoria', async () => {
    const trail = await prisma.auditLog.findFirst({
      where: { entityType: 'employee', entityId: employeeId, action: 'create' },
    });
    expect(trail, 'la contratacion debe quedar auditada').toBeTruthy();
    expect(trail!.actorId).toBeTruthy();
  });

  it('el nuevo colaborador aparece en la nomina de personal', async () => {
    const client = await as(hr);
    const response = await client.get(`/people/employees?search=Contratada&limit=20`);
    expect(response.status).toBe(200);
    expect(response.body.data.some((row: any) => row.id === employeeId)).toBe(true);
  });

  it('no permite contratar dos veces la misma postulacion', async () => {
    const client = await as(hr);
    const response = await client.post(`/recruiting/applications/${applicationId}/hire`, {
      hiredAt: toDateKey(new Date()),
      contractType: 'indefinido',
    });
    expect([409, 422]).toContain(response.status);
  });
});
