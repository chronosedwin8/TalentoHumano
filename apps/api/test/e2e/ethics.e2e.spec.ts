import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO, anonymous, as, closeApp, getApp, login, type Session } from './harness';

/**
 * The hotline is the most sensitive surface of the platform: an anonymous
 * report must stay anonymous even against someone with database access.
 */
describe('canal de denuncias', () => {
  const prisma = new PrismaClient();
  let ethics: Session;
  let employee: Session;
  let slug: string;
  let reportId: string;
  let trackingCode: string;
  let accessKey: string;

  beforeAll(async () => {
    await getApp();
    [ethics, employee] = await Promise.all([login(DEMO.ethics), login(DEMO.employee)]);
    slug = employee.user.company!.slug;
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await closeApp();
  });

  describe('envio anonimo desde el portal publico', () => {
    it('el portal publica las categorias sin pedir sesion', async () => {
      const client = await anonymous();
      const response = await client.get(`/public/ethics/${slug}`);
      expect(response.status).toBe(200);
      expect(response.body.data.company.name).toBeTruthy();
      expect(Array.isArray(response.body.data.categories)).toBe(true);
    });

    it('acepta una denuncia anonima y entrega codigo y clave', async () => {
      const client = await anonymous();
      const response = await client.post(`/public/ethics/${slug}/reports`, {
        isAnonymous: true,
        relationship: 'employee',
        subject: 'Prueba automatizada del canal',
        description:
          'Denuncia creada por la suite e2e para verificar que el anonimato se mantiene de extremo a extremo.',
        fileIds: [],
        consentAccepted: true,
      });
      expect([200, 201]).toContain(response.status);
      trackingCode = response.body.data.trackingCode;
      accessKey = response.body.data.accessKey;
      expect(trackingCode).toMatch(/^TAL-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(accessKey.length).toBeGreaterThanOrEqual(8);
    });

    it('asigna un plazo legal de respuesta', async () => {
      const report = await prisma.ethicsReport.findFirst({ where: { trackingCode } });
      reportId = report!.id;
      expect(report?.dueAt).toBeTruthy();
      expect(report!.dueAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('rechaza el envio sin consentimiento de tratamiento de datos', async () => {
      const client = await anonymous();
      const response = await client.post(`/public/ethics/${slug}/reports`, {
        isAnonymous: true,
        relationship: 'employee',
        subject: 'Denuncia sin consentimiento',
        description: 'Texto suficientemente largo para pasar la validacion de longitud minima.',
        fileIds: [],
        consentAccepted: false,
      });
      expect([400, 422]).toContain(response.status);
    });

    it('rechaza una descripcion demasiado corta', async () => {
      const client = await anonymous();
      const response = await client.post(`/public/ethics/${slug}/reports`, {
        isAnonymous: true,
        relationship: 'employee',
        subject: 'Corta',
        description: 'muy corta',
        fileIds: [],
        consentAccepted: true,
      });
      expect([400, 422]).toContain(response.status);
    });
  });

  describe('garantia de anonimato', () => {
    it('la tabla de denuncias no tiene columnas de IP ni de dispositivo', async () => {
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'ethics_reports'
      `;
      const names = columns.map((column) => column.column_name);
      expect(names).not.toContain('ip_address');
      expect(names).not.toContain('user_agent');
      expect(names).not.toContain('created_by');
    });

    it('no guarda ningun dato de contacto del denunciante anonimo', async () => {
      const report = await prisma.ethicsReport.findFirst({ where: { trackingCode } });
      expect(report?.isAnonymous).toBe(true);
      expect(report?.reporterName).toBeNull();
      expect(report?.reporterEmail).toBeNull();
      expect(report?.reporterPhone).toBeNull();
    });

    it('guarda el contenido cifrado, nunca en claro', async () => {
      const report = await prisma.ethicsReport.findFirst({ where: { trackingCode } });
      expect(report?.subject).toMatch(/^enc:v1:/);
      expect(report?.description).toMatch(/^enc:v1:/);
      expect(report?.description).not.toContain('suite e2e');
    });

    it('guarda la clave de acceso como hash, no en claro', async () => {
      const report = await prisma.ethicsReport.findFirst({ where: { trackingCode } });
      expect(report?.accessKeyHash).toBeTruthy();
      expect(report?.accessKeyHash).not.toBe(accessKey);
      expect(report?.accessKeyHash).not.toContain(accessKey);
    });

    it('no deja rastro del envio en la bitacora de auditoria', async () => {
      const trail = await prisma.auditLog.count({
        where: { entityType: 'ethics_report', entityId: reportId },
      });
      expect(trail).toBe(0);
    });
  });

  describe('seguimiento por el denunciante', () => {
    it('con codigo y clave correctos devuelve el estado', async () => {
      const client = await anonymous();
      const response = await client.post('/public/ethics/follow-up', { trackingCode, accessKey });
      expect([200, 201]).toContain(response.status);
      expect(response.body.data.trackingCode).toBe(trackingCode);
      expect(response.body.data.subject).toBe('Prueba automatizada del canal');
    });

    it('con la clave equivocada no revela nada', async () => {
      const client = await anonymous();
      const response = await client.post('/public/ethics/follow-up', {
        trackingCode,
        accessKey: 'clave-incorrecta',
      });
      expect(response.status).toBe(404);
      expect(response.text).not.toContain('Prueba automatizada');
    });

    it('con un codigo inexistente responde igual que con clave mala', async () => {
      const client = await anonymous();
      const response = await client.post('/public/ethics/follow-up', {
        trackingCode: 'TAL-ZZZZ-ZZZZ',
        accessKey: 'cualquier-clave',
      });
      expect(response.status).toBe(404);
    });

    it('el denunciante puede aportar informacion sin identificarse', async () => {
      const client = await anonymous();
      const response = await client.post('/public/ethics/messages', {
        trackingCode,
        accessKey,
        message: 'Aporto un dato adicional desde la prueba e2e.',
      });
      expect([200, 201]).toContain(response.status);

      const followUp = await client.post('/public/ethics/follow-up', { trackingCode, accessKey });
      const messages = followUp.body.data.messages;
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.at(-1).authorKind).toBe('reporter');
    });

    it('los mensajes tambien se guardan cifrados', async () => {
      const message = await prisma.ethicsReportMessage.findFirst({
        where: { reportId },
        orderBy: { createdAt: 'desc' },
      });
      expect(message?.body).toMatch(/^enc:v1:/);
      expect(message?.body).not.toContain('prueba e2e');
    });
  });

  describe('bandeja del oficial de etica', () => {
    it('el oficial ve la denuncia descifrada', async () => {
      const client = await as(ethics);
      const response = await client.get('/ethics/reports?limit=100');
      expect(response.status).toBe(200);
      const row = response.body.data.find((item: any) => item.trackingCode === trackingCode);
      expect(row, 'la denuncia recien creada debe aparecer en la bandeja').toBeTruthy();
      expect(row.subject).toBe('Prueba automatizada del canal');
    });

    it('la bandeja no expone datos del denunciante anonimo', async () => {
      const client = await as(ethics);
      const response = await client.get(`/ethics/reports/${reportId}`);
      expect(response.status).toBe(200);
      expect(response.body.data.isAnonymous).toBe(true);
      expect(response.body.data.reporterName).toBeNull();
      expect(response.body.data.reporterEmail).toBeNull();
    });

    it('la lectura de una denuncia queda registrada como acceso sensible', async () => {
      const before = await prisma.sensitiveAccessLog.count({
        where: { entityType: 'ethics_report' },
      });
      const client = await as(ethics);
      await client.get(`/ethics/reports/${reportId}`);
      const after = await prisma.sensitiveAccessLog.count({
        where: { entityType: 'ethics_report' },
      });
      expect(after).toBeGreaterThan(before);
    });

    it('un colaborador corriente no llega a la bandeja', async () => {
      const client = await as(employee);
      expect((await client.get('/ethics/reports')).status).toBe(403);
      expect((await client.get(`/ethics/reports/${reportId}`)).status).toBe(403);
    });

    it('las estadisticas son agregadas y no incluyen el detalle', async () => {
      const client = await as(ethics);
      const response = await client.get('/ethics/statistics');
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('total');
      expect(JSON.stringify(response.body.data)).not.toContain('Prueba automatizada');
    });
  });

  describe('limite de envios', () => {
    it('limita los envios seguidos desde el portal publico', async () => {
      const client = await anonymous();
      const statuses: number[] = [];
      // El limite es configurable (`ETHICS_REPORT_LIMIT`) porque una oficina
      // entera comparte una IP: se lee del entorno para no fijar un numero.
      const limit = Number(process.env.ETHICS_REPORT_LIMIT ?? 20);
      for (let attempt = 0; attempt < limit + 3; attempt += 1) {
        const response = await client.post(`/public/ethics/${slug}/reports`, {
          isAnonymous: true,
          relationship: 'other',
          subject: `Envio masivo ${attempt}`,
          description: 'Texto de relleno suficientemente largo para superar la validacion minima.',
          fileIds: [],
          consentAccepted: true,
        });
        statuses.push(response.status);
      }
      // El portal se protege del abuso sin bloquear una denuncia legitima.
      expect(statuses).toContain(429);
    });
  });
});
