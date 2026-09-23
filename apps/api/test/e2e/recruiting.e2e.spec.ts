import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO, anonymous, as, closeApp, getApp, login, type Session } from './harness';

/** Public application to hire: the flow that crosses from ATS into HRIS. */
describe('seleccion y portal de empleo', () => {
  let hr: Session;
  let employee: Session;
  let slug: string;
  let jobSlug: string;
  let jobId: string;
  let candidateEmail: string;
  let applicationId: string;

  beforeAll(async () => {
    await getApp();
    [hr, employee] = await Promise.all([login(DEMO.hr), login(DEMO.employee)]);
    slug = hr.user.company!.slug;
    candidateEmail = `candidata.e2e.${Date.now()}@example.com`;
  }, 120_000);

  afterAll(async () => {
    await closeApp();
  });

  describe('portal publico de empleo', () => {
    it('lista las vacantes publicadas sin sesion', async () => {
      const client = await anonymous();
      const response = await client.get(`/public/careers/${slug}`);
      expect(response.status).toBe(200);
      expect(response.body.data.postings.length).toBeGreaterThan(0);
      jobSlug = response.body.data.postings[0].slug;
    });

    it('no expone el rango salarial cuando la vacante lo oculta', async () => {
      const client = await anonymous();
      const { postings } = (await client.get(`/public/careers/${slug}`)).body.data;
      for (const posting of postings) {
        if (!posting.salaryVisible) {
          expect(posting.salaryRangeMin).toBeNull();
          expect(posting.salaryRangeMax).toBeNull();
        }
      }
    });

    it('no publica vacantes internas ni borradores', async () => {
      const client = await anonymous();
      const { postings } = (await client.get(`/public/careers/${slug}`)).body.data;
      for (const posting of postings) {
        expect(posting.isInternal ?? false).toBe(false);
      }

      const all = (await (await as(hr)).get('/recruiting/jobs?limit=100')).body.meta.total;
      expect(all).toBeGreaterThanOrEqual(postings.length);
    });

    it('devuelve el detalle de una vacante', async () => {
      const client = await anonymous();
      const response = await client.get(`/public/careers/${slug}/jobs/${jobSlug}`);
      expect(response.status).toBe(200);
      expect(response.body.data.posting.title).toBeTruthy();
      jobId = response.body.data.posting.id;
    });

    it('responde 404 para una vacante inexistente', async () => {
      const client = await anonymous();
      expect((await client.get(`/public/careers/${slug}/jobs/no-existe`)).status).toBe(404);
    });

    it('responde 404 para una empresa inexistente', async () => {
      const client = await anonymous();
      expect((await client.get('/public/careers/empresa-que-no-existe')).status).toBe(404);
    });
  });

  describe('postulacion publica', () => {
    it('acepta una postulacion con consentimiento', async () => {
      const client = await anonymous();
      const response = await client.post(`/public/careers/${slug}/jobs/${jobSlug}/apply`, {
        firstName: 'Candidata',
        lastName: 'Automatizada',
        email: candidateEmail,
        phone: '3001234567',
        city: 'Bogota',
        source: 'portal',
        coverLetter: 'Postulacion creada por la suite e2e.',
        consentAccepted: true,
      });
      expect([200, 201]).toContain(response.status);
      applicationId = response.body.data.applicationId;
      expect(applicationId).toBeTruthy();
    });

    it('rechaza una postulacion sin consentimiento', async () => {
      const client = await anonymous();
      const response = await client.post(`/public/careers/${slug}/jobs/${jobSlug}/apply`, {
        firstName: 'Sin',
        lastName: 'Consentimiento',
        email: `sin.consentimiento.${Date.now()}@example.com`,
        phone: '3001234567',
        consentAccepted: false,
      });
      expect([400, 422]).toContain(response.status);
    });

    it('rechaza un correo mal formado', async () => {
      const client = await anonymous();
      const response = await client.post(`/public/careers/${slug}/jobs/${jobSlug}/apply`, {
        firstName: 'Correo',
        lastName: 'Invalido',
        email: 'no-es-un-correo',
        phone: '3001234567',
        consentAccepted: true,
      });
      expect([400, 422]).toContain(response.status);
    });
  });

  describe('pipeline interno', () => {
    it('la postulacion cae en la primera etapa del pipeline', async () => {
      const client = await as(hr);
      const response = await client.get(`/recruiting/jobs/${jobId}/pipeline`);
      expect(response.status).toBe(200);
      const stages: any[] = response.body.data.stages ?? response.body.data;
      const all = stages.flatMap((stage: any) => stage.applications ?? []);
      const found = all.find((row: any) => row.id === applicationId);
      expect(found, 'la postulacion recien creada debe aparecer en el pipeline').toBeTruthy();
    });

    it('el candidato queda registrado con sus datos de contacto', async () => {
      const client = await as(hr);
      const response = await client.get(`/recruiting/candidates?search=Automatizada&limit=20`);
      expect(response.status).toBe(200);
      const candidate = response.body.data.find((row: any) => row.email === candidateEmail);
      expect(candidate).toBeTruthy();
      expect(candidate.fullName).toContain('Candidata');
    });

    it('un colaborador corriente no ve el pipeline ni los candidatos', async () => {
      const client = await as(employee);
      expect((await client.get(`/recruiting/jobs/${jobId}/pipeline`)).status).toBe(403);
      expect((await client.get('/recruiting/candidates')).status).toBe(403);
      expect((await client.get(`/recruiting/applications/${applicationId}`)).status).toBe(403);
    });

    it('registra la fuente de la postulacion', async () => {
      const client = await as(hr);
      const response = await client.get(`/recruiting/applications/${applicationId}`);
      expect(response.status).toBe(200);
      expect(response.body.data.source ?? response.body.data.candidate?.source).toBe('portal');
    });
  });

  describe('indicadores de seleccion', () => {
    it('entrega metricas agregadas del proceso', async () => {
      const client = await as(hr);
      const response = await client.get('/recruiting/metrics');
      expect(response.status).toBe(200);
      expect(response.body.data).toBeTruthy();
    });
  });
});
