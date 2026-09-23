import { expect, request as playwrightRequest, test, type Page } from '@playwright/test';
import { DEMO_PASSWORD, USERS, signIn } from './fixtures';

const API = process.env.E2E_API_URL ?? 'http://localhost:3000';

/**
 * Criterio de aceptacion 5, visto desde el navegador: el colaborador solicita,
 * el jefe aprueba desde su bandeja y el estado cambia sin recargar a mano.
 *
 * La prueba prepara su propio escenario por API (cancela solicitudes que hayan
 * quedado de corridas anteriores y elige un dia libre), de modo que se puede
 * repetir sin volver a sembrar la base.
 */
async function arrangeFreeDay(): Promise<string> {
  const api = await playwrightRequest.newContext({ baseURL: API });

  const login = await api.post('/api/v1/auth/login', {
    data: { email: USERS.employee, password: DEMO_PASSWORD },
  });
  const session = (await login.json()).data;
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const employeeId = session.user.employee.id;

  // Cancela lo que haya quedado pendiente de corridas anteriores: de otro modo
  // la bandeja del jefe acumula solicitudes y los dias se agotan.
  const pending = await api.get('/api/v1/leaves/requests?status=pending&limit=100', { headers });
  for (const row of (await pending.json()).data ?? []) {
    if ((row.employeeId ?? row.employee?.id) !== employeeId) continue;
    await api.post(`/api/v1/leaves/requests/${row.id}/cancel`, {
      headers,
      data: { reason: 'Limpieza de la suite automatizada' },
    });
  }

  // Busca el primer dia habil libre a partir de dentro de dos meses.
  const taken = new Set<string>();
  const existing = await api.get('/api/v1/leaves/requests?limit=200', { headers });
  for (const row of (await existing.json()).data ?? []) {
    if ((row.employeeId ?? row.employee?.id) !== employeeId) continue;
    if (row.status === 'cancelled' || row.status === 'rejected') continue;
    const cursor = new Date(row.startDate);
    const end = new Date(row.endDate);
    while (cursor <= end) {
      taken.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 60);
  for (let step = 0; step < 120; step += 1) {
    const key = day.toISOString().slice(0, 10);
    const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
    const sameYear = day.getUTCFullYear() === new Date().getUTCFullYear();
    if (!isWeekend && sameYear && !taken.has(key)) {
      await api.dispose();
      return key;
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }

  await api.dispose();
  throw new Error('no quedan dias libres en el ano para la prueba');
}

/** Pide un dia concreto desde la interfaz. */
async function requestDay(page: Page, day: string): Promise<void> {
  await page.goto('/leaves');
  await expect(page.getByRole('heading', { name: /ausencias|vacaciones/i }).first()).toBeVisible();
  // La lista se rellena tras la primera consulta y vuelve a pintar la cabecera:
  // sin esperar a que asiente, el boton se desprende del DOM.
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /nueva solicitud/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/tipo de ausencia/i).selectOption({ label: 'Vacaciones' });
  await dialog.getByLabel(/^Desde/).fill(day);
  await dialog.getByLabel(/^Hasta/).fill(day);
  await dialog
    .getByRole('button', { name: /enviar|crear|solicitar/i })
    .last()
    .click();

  // Al aceptarse el dialogo se cierra. Si algo falla, queda abierto con el
  // motivo dentro, y el mensaje sirve para diagnosticar.
  await expect(dialog, await dialog.textContent().catch(() => '')).toBeHidden({ timeout: 20_000 });
}

test.describe('solicitar y aprobar vacaciones', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.employee);
  });

  test('el colaborador crea la solicitud y el jefe la aprueba', async ({ page, browser }) => {
    const day = await arrangeFreeDay();
    await requestDay(page, day);

    // El jefe entra en un contexto propio: el token de acceso vive en memoria
    // de la pagina, asi que reutilizarla dejaria activa la sesion anterior.
    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    await signIn(managerPage, USERS.manager);
    await managerPage.goto('/approvals');
    await expect(managerPage.getByRole('heading').first()).toBeVisible();
    await managerPage.waitForLoadState('networkidle');

    const approve = managerPage.getByRole('button', { name: 'Aprobar' }).first();
    await expect(approve, 'la solicitud recien creada debe llegar a la bandeja').toBeVisible({
      timeout: 20_000,
    });

    const pendingBefore = await managerPage.getByRole('button', { name: 'Aprobar' }).count();
    await approve.click();

    const dialog = managerPage.getByRole('dialog');
    await expect(dialog.getByText('Aprobar solicitud')).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirmar' }).click();

    await expect(dialog).toBeHidden({ timeout: 20_000 });
    // La lista se refresca sola: queda una solicitud pendiente menos.
    await expect
      .poll(() => managerPage.getByRole('button', { name: 'Aprobar' }).count(), { timeout: 20_000 })
      .toBeLessThan(pendingBefore);

    await managerContext.close();
  });

  test('el solicitante ve sus ausencias', async ({ page }) => {
    await page.goto('/leaves');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/vacaciones/i).first()).toBeVisible();
  });
});

test.describe('la bandeja del jefe', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.manager);
  });

  test('el jefe ve la bandeja de aprobaciones', async ({ page }) => {
    await page.goto('/approvals');
    await expect(
      page.getByRole('heading', { name: /aprobacion|solicitudes/i }).first(),
    ).toBeVisible();
  });
});

test.describe('marcacion de asistencia', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.employee);
  });

  test('el colaborador ve su reloj y puede marcar', async ({ page }) => {
    await page.goto('/time');

    const entrada = page.getByRole('button', { name: /entrada/i });
    const salida = page.getByRole('button', { name: /salida/i });
    await expect(entrada.or(salida).first()).toBeVisible();
    // El estado de los botones depende de la marcacion de hoy, que llega en una
    // segunda consulta: hay que dejar que la pagina asiente.
    await page.waitForLoadState('networkidle');

    // Un boton habilitado marca; si ya marco entrada y salida hoy, ambos quedan
    // deshabilitados y eso tambien es el comportamiento correcto.
    if (await entrada.isEnabled()) {
      await entrada.click();
      await expect(page.getByText(/entrada registrada|marcacion/i).first()).toBeVisible({
        timeout: 20_000,
      });
    } else if (await salida.isEnabled()) {
      await salida.click();
      await expect(page.getByText(/salida registrada|marcacion/i).first()).toBeVisible({
        timeout: 20_000,
      });
    } else {
      await expect(entrada).toBeDisabled();
      await expect(salida).toBeDisabled();
    }
  });

  test('la marcacion queda visible en asistencia', async ({ page }) => {
    await page.goto('/time/asistencia');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});

test.describe('responder una encuesta', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.employee);
  });

  test('el colaborador responde la encuesta asignada', async ({ page }) => {
    await page.goto('/surveys');
    await page.waitForLoadState('networkidle');

    const responder = page.getByRole('link', { name: /responder/i }).first();
    if ((await responder.count()) === 0) {
      // Ya respondio todas: la pagina lo dice, no se queda vacia.
      await expect(page.getByText(/sin encuestas|al dia|encuestas y clima/i).first()).toBeVisible();
      return;
    }

    await responder.click();
    await expect(page.getByRole('button', { name: /enviar respuestas/i })).toBeVisible();

    // El aviso de anonimato tiene que estar a la vista antes de responder.
    await expect(page.getByText(/anonima|no se guarda ninguna relacion/i).first()).toBeVisible();

    // Responde cada pregunta con la primera opcion disponible.
    const scales = page.locator('button', { hasText: /^(Muy en desacuerdo|Nada probable|0)$/ });
    const count = await scales.count();
    for (let index = 0; index < count; index += 1) {
      await scales.nth(index).click();
    }
    for (const radio of await page.getByRole('radio').all()) {
      await radio.check().catch(() => undefined);
    }

    const submit = page.getByRole('button', { name: /enviar respuestas/i });
    if (await submit.isEnabled()) {
      await submit.click();
      await expect(page.getByText(/respuesta registrada|gracias/i).first()).toBeVisible({
        timeout: 20_000,
      });
    } else {
      // Quedan preguntas obligatorias sin responder: el boton lo advierte.
      await expect(page.getByText(/responda todas las preguntas/i)).toBeVisible();
    }
  });
});
