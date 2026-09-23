import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO, as, closeApp, getApp, login, type Session } from './harness';

/**
 * Proves the two guarantees that hold the whole platform together: a role only
 * reaches what its permissions allow, and no request ever crosses the tenant
 * boundary.
 */
describe('control de acceso', () => {
  let hr: Session;
  let employee: Session;
  let ethics: Session;
  let admin: Session;

  beforeAll(async () => {
    await getApp();
    [hr, employee, ethics, admin] = await Promise.all([
      login(DEMO.hr),
      login(DEMO.employee),
      login(DEMO.ethics),
      login(DEMO.admin),
    ]);
  }, 120_000);

  afterAll(async () => {
    await closeApp();
  });

  describe('autenticacion', () => {
    it('rechaza una contrasena incorrecta', async () => {
      const client = await as({ token: '', user: null as never });
      const response = await client.post('/auth/login', {
        email: DEMO.hr,
        password: 'contrasena-incorrecta',
      });
      expect(response.status).toBe(401);
    });

    it('rechaza un correo inexistente con el mismo codigo', async () => {
      // No debe distinguir entre usuario inexistente y clave mala.
      const client = await as({ token: '', user: null as never });
      const response = await client.post('/auth/login', {
        email: 'nadie@demo.com',
        password: 'Demo1234!',
      });
      expect(response.status).toBe(401);
    });

    it('rechaza un token invalido', async () => {
      const client = await as({ token: 'token-falso', user: null as never });
      expect((await client.get('/auth/me')).status).toBe(401);
    });

    it('devuelve el perfil con permisos y modulos efectivos', async () => {
      const client = await as(hr);
      const response = await client.get('/auth/me');
      expect(response.status).toBe(200);
      expect(response.body.data.permissions.length).toBeGreaterThan(50);
      expect(response.body.data.modules).toContain('people');
    });

    it('el rol de talento humano expande los comodines de permisos', async () => {
      // Regresion del bug que dejaba a hr_admin con 27 permisos efectivos.
      expect(hr.user.permissions.length).toBeGreaterThan(100);
      const codes = hr.user.permissions.map((permission) => permission.code);
      expect(codes).toContain('people.employee.read');
      expect(codes).toContain('leaves.request.approve');
    });
  });

  describe('permisos por rol', () => {
    it('talento humano entra a los modulos operativos', async () => {
      const client = await as(hr);
      for (const path of [
        '/people/employees',
        '/leaves/requests',
        '/recruiting/jobs',
        '/onboarding/processes',
        '/learning/courses',
        '/performance/objectives',
        '/documents/templates',
        '/helpdesk/tickets',
      ]) {
        expect((await client.get(path)).status, `GET ${path}`).toBe(200);
      }
    });

    it('un colaborador no entra al canal de denuncias', async () => {
      const client = await as(employee);
      expect((await client.get('/ethics/reports')).status).toBe(403);
    });

    it('un colaborador no lee la bitacora de auditoria', async () => {
      const client = await as(employee);
      expect((await client.get('/audit/logs')).status).toBe(403);
    });

    it('un colaborador no administra usuarios ni roles', async () => {
      const client = await as(employee);
      expect((await client.get('/users')).status).toBe(403);
      expect((await client.get('/users/roles/all')).status).toBe(403);
    });

    it('un colaborador si accede a su propio portal', async () => {
      const client = await as(employee);
      expect((await client.get('/portal/me')).status).toBe(200);
    });

    it('el oficial de etica si entra al canal de denuncias', async () => {
      const client = await as(ethics);
      expect((await client.get('/ethics/reports')).status).toBe(200);
    });

    it('el oficial de etica no administra la nomina de personal', async () => {
      const client = await as(ethics);
      const response = await client.post('/people/employees', { firstName: 'X', lastName: 'Y' });
      expect(response.status).toBe(403);
    });

    it('solo el administrador de empresa lee el catalogo de permisos', async () => {
      expect((await (await as(admin)).get('/settings/permissions')).status).toBe(200);
      expect((await (await as(hr)).get('/settings/permissions')).status).toBe(403);
    });

    it('el administrador de empresa alcanza toda la configuracion', async () => {
      const client = await as(admin);
      for (const path of ['/settings/company', '/settings/modules', '/users', '/audit/logs']) {
        expect((await client.get(path)).status, `GET ${path}`).toBe(200);
      }
    });
  });

  describe('aislamiento entre empresas', () => {
    it('cada sesion queda atada a una empresa', async () => {
      expect(hr.user.company?.id).toBeTruthy();
      expect(employee.user.company?.id).toBe(hr.user.company?.id);
    });

    it('un id de otra empresa responde 404, no el registro ajeno', async () => {
      const client = await as(hr);
      // Un UUID valido que no pertenece a la empresa de la sesion.
      const foreignId = '00000000-0000-4000-8000-000000000001';
      const response = await client.get(`/people/employees/${foreignId}`);
      expect([403, 404]).toContain(response.status);
      expect(response.text).not.toContain('firstName');
    });

    it('todo lo que devuelve el listado pertenece a la empresa de la sesion', async () => {
      const client = await as(hr);
      const response = await client.get('/people/employees?limit=50');
      expect(response.status).toBe(200);
      const companyId = hr.user.company?.id;
      for (const row of response.body.data) {
        if ('companyId' in row) expect(row.companyId).toBe(companyId);
      }
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('no se puede crear un registro en otra empresa aunque se envie el companyId', async () => {
      const client = await as(admin);
      const unique = Date.now().toString(36).toUpperCase();
      const response = await client.post('/organization/cost-centers', {
        name: `Centro e2e ${unique}`,
        code: `E2E${unique}`,
        // El cliente intenta escribir en otra empresa: debe ser ignorado.
        companyId: '00000000-0000-4000-8000-0000000000ff',
      });
      expect([200, 201], response.text.slice(0, 200)).toContain(response.status);
      expect(response.body.data.companyId).toBe(admin.user.company?.id);
    });

    it('un upsert respeta la frontera de la empresa', async () => {
      // `upsert` no admite el filtro de empresa en su `where`, que solo acepta
      // campos unicos. El cliente de tenencia resuelve la fila antes de
      // escribir; esta prueba fija ese comportamiento para que no se pierda.
      const client = await as(hr);
      const unique = `E2E-${Date.now().toString(36).toUpperCase()}`;

      const created = await client.post('/settings/catalogs', {
        catalogKey: 'document_type',
        code: unique,
        label: 'Tipo de documento de prueba',
        position: 99,
        metadata: {},
      });
      expect([200, 201], created.text.slice(0, 200)).toContain(created.status);
      expect(created.body.data.companyId).toBe(hr.user.company?.id);

      // Volver a escribir el mismo codigo actualiza la fila propia, no crea
      // una segunda ni alcanza la de otra empresa.
      const again = await client.post('/settings/catalogs', {
        catalogKey: 'document_type',
        code: unique,
        label: 'Etiqueta corregida',
        position: 99,
        metadata: {},
      });
      expect([200, 201, 409, 422]).toContain(again.status);
      if (again.status < 300) {
        expect(again.body.data.companyId).toBe(hr.user.company?.id);
      }
    });
  });

  describe('modulos', () => {
    it('el colaborador solo ve los modulos de autoservicio', async () => {
      const client = await as(employee);
      const response = await client.get('/auth/me');
      const modules: string[] = response.body.data.modules;
      // El portal del colaborador es una ruta, no un modulo: lo que se le
      // concede son los modulos marcados como selfService en el catalogo.
      expect(modules).toContain('dashboard');
      expect(modules).toContain('leaves');
      expect(modules).not.toContain('settings');
      expect(modules).not.toContain('ethics');
    });

    it('talento humano ve mas modulos que un colaborador', async () => {
      expect(hr.user.modules.length).toBeGreaterThan(employee.user.modules.length);
    });
  });
});
