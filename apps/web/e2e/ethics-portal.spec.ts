import { expect, test } from '@playwright/test';
import { COMPANY_SLUG, USERS, signIn } from './fixtures';

/**
 * The flow the spec calls out by name: an anonymous report plus its follow-up.
 * It must work end to end without ever asking the reporter to identify.
 */
test.describe('canal de denuncias anonimo', () => {
  test('enviar una denuncia anonima y luego consultarla', async ({ page }) => {
    await page.goto(`/ethics/${COMPANY_SLUG}`);
    await expect(page.getByRole('heading', { name: /canal de denuncias/i })).toBeVisible();
    await expect(page.getByText(/su anonimato esta protegido/i)).toBeVisible();

    // La opcion anonima viene marcada por defecto.
    await expect(page.getByRole('radio', { name: /anonima/i })).toBeChecked();

    const subject = `Prueba Playwright ${Date.now()}`;
    await page.getByLabel('Asunto').fill(subject);
    await page
      .getByLabel(/que ocurrio/i)
      .fill(
        'Relato de prueba creado por la suite de navegador para validar el flujo anonimo completo de principio a fin.',
      );
    await page.getByRole('checkbox').last().check();
    await page.getByRole('button', { name: /enviar denuncia/i }).click();

    // Codigo y clave se muestran una sola vez.
    await expect(page.getByText(/denuncia recibida/i)).toBeVisible({ timeout: 20_000 });
    const trackingCode = (await page
      .getByText(/^TAL-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      .first()
      .textContent())!.trim();
    const codes = page.locator('code');
    const accessKey = (await codes.nth(1).textContent())!.trim();
    expect(trackingCode).toMatch(/^TAL-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(accessKey.length).toBeGreaterThan(6);

    // Seguimiento con el codigo y la clave.
    await page.goto('/ethics-seguimiento');
    await page.getByLabel(/codigo de seguimiento/i).fill(trackingCode);
    await page.getByLabel(/clave de acceso/i).fill(accessKey);
    await page.getByRole('button', { name: /consultar/i }).click();

    await expect(page.getByText(subject)).toBeVisible({ timeout: 20_000 });

    // El denunciante aporta informacion sin identificarse.
    await page.getByPlaceholder(/escriba un mensaje/i).fill('Aporto un detalle adicional.');
    await page.getByRole('button', { name: /enviar mensaje/i }).click();
    await expect(page.getByText('Aporto un detalle adicional.')).toBeVisible({ timeout: 20_000 });
  });

  test('una clave incorrecta no revela la denuncia', async ({ page }) => {
    await page.goto('/ethics-seguimiento');
    await page.getByLabel(/codigo de seguimiento/i).fill('TAL-AAAA-BBBB');
    await page.getByLabel(/clave de acceso/i).fill('clave-que-no-es');
    await page.getByRole('button', { name: /consultar/i }).click();
    await expect(page.getByText(/no fue posible consultar|no son validos/i).first()).toBeVisible();
  });

  test('el portal publico no pide sesion ni la ofrece', async ({ page }) => {
    await page.goto(`/ethics/${COMPANY_SLUG}`);
    await expect(page.getByRole('link', { name: /ingresar|iniciar sesion/i })).toHaveCount(0);
  });
});

test.describe('la bandeja de denuncias es solo del oficial de etica', () => {
  test.describe('visto por un colaborador', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, USERS.employee);
    });

    test('no alcanza la bandeja', async ({ page }) => {
      await page.goto('/ethics');
      // El guardia de modulo lo devuelve al tablero.
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('visto por el oficial de etica', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, USERS.ethics);
    });

    test('si ve la bandeja y el aviso de anonimato', async ({ page }) => {
      await page.goto('/ethics');
      await expect(page.getByRole('heading', { name: /canal de denuncias/i })).toBeVisible();
      await expect(page.getByText(/no guardan ip ni dispositivo/i)).toBeVisible();
    });
  });
});
