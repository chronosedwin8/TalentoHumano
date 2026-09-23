import { addDays, toDateKey } from '@talento/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO, as, closeApp, getApp, login, type Session } from './harness';

/**
 * First Monday of December of the current year. The suite books its absence in
 * a fixed late window so it never collides with the dates the demo seed uses,
 * and it stays inside the year where the balance was accrued.
 */
function firstMondayOfDecember(): Date {
  let date = new Date(Date.UTC(new Date().getUTCFullYear(), 11, 1));
  while (date.getUTCDay() !== 1) date = addDays(date, 1);
  return date;
}

const WINDOW_START = toDateKey(firstMondayOfDecember());
const WINDOW_END = toDateKey(addDays(firstMondayOfDecember(), 2));

describe('vacaciones y ausencias', () => {
  let hr: Session;
  let employee: Session;
  let vacationTypeId: string;
  let vacationMaxDays: number;
  let employeeId: string;

  const balanceOf = async (session: Session) => {
    const client = await as(session);
    const response = await client.get(`/leaves/balances/${session.user.employee!.id}`);
    expect(response.status).toBe(200);
    return response.body.data;
  };

  beforeAll(async () => {
    await getApp();
    [hr, employee] = await Promise.all([login(DEMO.hr), login(DEMO.employee)]);
    employeeId = employee.user.employee!.id;
    expect(
      employeeId,
      'la cuenta empleado@demo.com debe estar ligada a un colaborador',
    ).toBeTruthy();

    const client = await as(hr);
    const types = await client.get('/leaves/types');
    const vacationType = types.body.data.find((type: any) => type.code === 'vacaciones');
    expect(vacationType, 'la empresa demo debe tener el tipo vacaciones').toBeTruthy();
    vacationTypeId = vacationType.id;
    vacationMaxDays = Number(vacationType.maxDaysPerRequest ?? 15);
  }, 120_000);

  afterAll(async () => {
    await closeApp();
  });

  describe('saldos', () => {
    it('el colaborador consulta su propio saldo', async () => {
      const balance = await balanceOf(employee);
      expect(balance).toHaveProperty('availableDays');
    });

    it('el saldo disponible es consistente con lo causado y lo tomado', async () => {
      const balance = await balanceOf(employee);
      const expected =
        balance.accruedDays +
        balance.adjustedDays +
        balance.carryOverDays -
        balance.takenDays -
        balance.pendingDays;
      expect(balance.availableDays).toBeCloseTo(expected, 2);
    });

    it('el saldo causado nunca es negativo', async () => {
      const balance = await balanceOf(employee);
      expect(balance.accruedDays).toBeGreaterThanOrEqual(0);
    });

    it('el colaborador no consulta el saldo de un companero', async () => {
      const client = await as(employee);
      const otherId = hr.user.employee?.id;
      if (!otherId || otherId === employeeId) return;
      const response = await client.get(`/leaves/balances/${otherId}`);
      expect([403, 404]).toContain(response.status);
    });

    it('talento humano si consulta el saldo de cualquiera', async () => {
      const client = await as(hr);
      const response = await client.get(`/leaves/balances/${employeeId}`);
      expect(response.status).toBe(200);
    });
  });

  describe('ajuste manual de saldo', () => {
    it('talento humano acredita dias y el saldo lo refleja', async () => {
      const before = await balanceOf(employee);
      const client = await as(hr);
      const response = await client.post('/leaves/balances/adjust', {
        employeeId,
        days: 20,
        reason: 'Acreditacion para la prueba automatizada',
        year: new Date().getUTCFullYear(),
      });
      expect([200, 201], response.text.slice(0, 200)).toContain(response.status);

      const after = await balanceOf(employee);
      expect(after.adjustedDays).toBe(before.adjustedDays + 20);
      expect(after.availableDays).toBeCloseTo(before.availableDays + 20, 2);
    });
  });

  describe('solicitud de vacaciones', () => {
    let requestId: string;

    it('el colaborador crea una solicitud', async () => {
      const client = await as(employee);
      const response = await client.post('/leaves/requests', {
        leaveTypeId: vacationTypeId,
        startDate: WINDOW_START,
        endDate: WINDOW_END,
        reason: 'Descanso programado (prueba e2e)',
        fileIds: [],
      });
      expect([200, 201]).toContain(response.status);
      requestId = response.body.data.id;
      expect(requestId).toBeTruthy();
      expect(Number(response.body.data.requestedDays)).toBeGreaterThan(0);
    });

    it('la solicitud entra al flujo de aprobacion', async () => {
      const client = await as(employee);
      const response = await client.get(`/leaves/requests/${requestId}`);
      expect(response.status).toBe(200);
      expect(['pending', 'approved']).toContain(response.body.data.status);
    });

    it('cuenta dias habiles, nunca mas que los dias de calendario', async () => {
      const client = await as(employee);
      const { startDate, endDate, requestedDays } = (
        await client.get(`/leaves/requests/${requestId}`)
      ).body.data;
      const calendarDays =
        Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1;
      expect(Number(requestedDays)).toBeLessThanOrEqual(calendarDays);
    });

    it('rechaza una solicitud que termina antes de empezar', async () => {
      const client = await as(employee);
      const response = await client.post('/leaves/requests', {
        leaveTypeId: vacationTypeId,
        startDate: WINDOW_END,
        endDate: WINDOW_START,
        fileIds: [],
      });
      expect([400, 422]).toContain(response.status);
    });

    it('rechaza una solicitud que se solapa con otra ya registrada', async () => {
      const client = await as(employee);
      const response = await client.post('/leaves/requests', {
        leaveTypeId: vacationTypeId,
        startDate: WINDOW_START,
        endDate: WINDOW_START,
        fileIds: [],
      });
      expect([400, 409, 422]).toContain(response.status);
    });

    it('rechaza una solicitud mas larga de lo que permite el tipo de ausencia', async () => {
      const client = await as(employee);
      const start = addDays(firstMondayOfDecember(), 14);
      const end = addDays(start, vacationMaxDays + 20);
      const response = await client.post('/leaves/requests', {
        leaveTypeId: vacationTypeId,
        startDate: toDateKey(start),
        endDate: toDateKey(end),
        fileIds: [],
      });
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('LEAVE_MAX_DAYS');
    });

    it('rechaza una solicitud sin saldo causado en ese ano', async () => {
      // Las vacaciones se causan por ano calendario: pedir dias del ano
      // siguiente falla porque todavia no hay nada causado.
      const client = await as(employee);
      const nextYear = new Date().getUTCFullYear() + 1;
      const response = await client.post('/leaves/requests', {
        leaveTypeId: vacationTypeId,
        startDate: `${nextYear}-03-02`,
        endDate: `${nextYear}-03-04`,
        fileIds: [],
      });
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('INSUFFICIENT_BALANCE');
      expect(response.body.details?.year).toBe(nextYear);
      expect(response.body.details?.availableDays).toBe(0);
    });

    it('el colaborador cancela su propia solicitud', async () => {
      const client = await as(employee);
      const response = await client.post(`/leaves/requests/${requestId}/cancel`, {
        reason: 'Cambio de planes (prueba e2e)',
      });
      expect([200, 201]).toContain(response.status);
    });

    it('la solicitud cancelada queda marcada como tal', async () => {
      const client = await as(employee);
      const response = await client.get(`/leaves/requests/${requestId}`);
      expect(response.body.data.status).toBe('cancelled');
    });
  });

  describe('alcance de datos', () => {
    it('el colaborador solo ve sus propias solicitudes', async () => {
      const client = await as(employee);
      const response = await client.get('/leaves/requests?limit=50');
      expect(response.status).toBe(200);
      for (const row of response.body.data) {
        expect(row.employeeId ?? row.employee?.id).toBe(employeeId);
      }
    });

    it('talento humano ve al menos tantas solicitudes como el colaborador', async () => {
      const all = (await (await as(hr)).get('/leaves/requests?limit=100')).body.meta.total;
      const own = (await (await as(employee)).get('/leaves/requests?limit=100')).body.meta.total;
      expect(all).toBeGreaterThanOrEqual(own);
    });

    it('el colaborador no ajusta saldos', async () => {
      const client = await as(employee);
      const response = await client.post('/leaves/balances/adjust', {
        employeeId,
        year: new Date().getUTCFullYear(),
        days: 10,
        reason: 'Intento no autorizado',
      });
      expect(response.status).toBe(403);
    });
  });

  describe('calendario y festivos', () => {
    it('devuelve el calendario de ausencias del equipo', async () => {
      const client = await as(hr);
      const from = toDateKey(new Date());
      const to = toDateKey(addDays(new Date(), 60));
      const response = await client.get(`/leaves/calendar?from=${from}&to=${to}`);
      expect(response.status).toBe(200);
    });

    it('tiene cargado el calendario de festivos colombianos', async () => {
      const client = await as(hr);
      const year = new Date().getUTCFullYear();
      const response = await client.get(`/leaves/holidays?year=${year}`);
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(17);
    });
  });

  describe('exportacion a nomina', () => {
    it('lista las exportaciones sin exponer ningun valor liquidado', async () => {
      const client = await as(hr);
      const response = await client.get('/leaves/payroll-export');
      expect(response.status).toBe(200);
      // La plataforma registra y exporta novedades; nunca liquida.
      const payload = JSON.stringify(response.body.data ?? []);
      expect(payload).not.toMatch(/"(netPay|liquidacion|totalPagar|amountToPay)"\s*:/i);
    });
  });
});
