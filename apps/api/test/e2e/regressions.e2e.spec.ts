import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO, as, closeApp, getApp, login, type Session } from './harness';

/**
 * Defects found by the pre-release audit. Each test pins the behaviour that
 * was broken so it cannot silently regress: route registration order,
 * soft deletes on models without an `updatedById` column, list filters that
 * were ignored, and enum filters that produced opaque errors.
 */
describe('regresiones de la auditoria', () => {
  let admin: Session;
  let employee: Session;

  beforeAll(async () => {
    await getApp();
    [admin, employee] = await Promise.all([login(DEMO.admin), login(DEMO.employee)]);
  }, 120_000);

  afterAll(async () => {
    await closeApp();
  });

  describe('archivos con almacenamiento local', () => {
    it('la ruta publica de descarga no queda atrapada por la ruta :id', async () => {
      const server = (await getApp()).getHttpServer();
      const { default: request } = await import('supertest');
      const response = await request(server).get('/api/v1/files/download?key=x&token=y');
      // A bad token is rejected by the route itself (403), not by the auth
      // guard of the ':id' route (401) nor as an invalid uuid (422).
      expect(response.status).toBe(403);
    });
  });

  describe('eliminacion logica', () => {
    it('elimina un tipo de ausencia (modelo sin updatedById)', async () => {
      const client = await as(admin);
      const code = `e2e-${Date.now().toString(36)}`;
      const created = await client.post('/leaves/types', {
        name: `Tipo e2e ${code}`,
        code,
        color: '#2563eb',
      });
      expect([200, 201]).toContain(created.status);
      const id = created.body.data.id as string;

      const removed = await client.delete(`/leaves/types/${id}`);
      expect(removed.status).toBe(200);

      const list = await client.get('/leaves/types');
      expect(list.status).toBe(200);
      const rows = (list.body.data ?? []) as Array<{ id: string }>;
      expect(rows.some((row) => row.id === id)).toBe(false);
    });
  });

  describe('listado de colaboradores', () => {
    it('respeta el filtro ids usado por los selectores', async () => {
      const client = await as(admin);
      const page = await client.get('/people/employees?limit=3&status=active');
      expect(page.status).toBe(200);
      const [first, second] = page.body.data as Array<{ id: string }>;
      expect(first).toBeTruthy();

      const picked = await client.get(`/people/employees?ids=${first.id},${second.id}&limit=10`);
      expect(picked.status).toBe(200);
      const ids = (picked.body.data as Array<{ id: string }>).map((row) => row.id).sort();
      expect(ids).toEqual([first.id, second.id].sort());
    });

    it('scope=team limita la lista a la linea de reporte', async () => {
      const client = await as(employee);
      const mine = employee.user.employee!.id;
      const team = await client.get('/people/employees?scope=team&limit=50');
      expect(team.status).toBe(200);
      const ids = (team.body.data as Array<{ id: string }>).map((row) => row.id);
      // A regular employee's team is just themself.
      expect(ids).toEqual([mine]);
    });

    it('un estado fuera del catalogo responde 422 con el campo', async () => {
      const client = await as(admin);
      const response = await client.get('/people/employees?status=foo');
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details?.field).toBe('status');
    });
  });

  describe('saldos de vacaciones', () => {
    it('entrega el saldo de cada colaborador del alcance en una sola respuesta', async () => {
      const client = await as(admin);
      const response = await client.get('/leaves/balances');
      expect(response.status).toBe(200);
      const rows = response.body.data as Array<{
        employee: { id: string };
        balance: { availableDays: number } | null;
      }>;
      expect(rows.length).toBeGreaterThan(10);
      expect(
        rows.every((row) => row.balance === null || typeof row.balance.availableDays === 'number'),
      ).toBe(true);
    });
  });

  describe('salud', () => {
    it('responde 200 con la base de datos arriba', async () => {
      const server = (await getApp()).getHttpServer();
      const { default: request } = await import('supertest');
      const response = await request(server).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.data.dependencies.database).toBe('up');
    });
  });
});
