import { expect, test } from '@playwright/test';
import { COMPANY_SLUG, USERS, signIn } from './fixtures';

test.describe('portal publico de empleo', () => {
  test('postularse a una vacante sin tener cuenta', async ({ page }) => {
    await page.goto(`/careers/${COMPANY_SLUG}`);
    await expect(page.getByRole('heading', { name: /trabaje con nosotros/i })).toBeVisible();

    const firstJob = page.locator('a[href*="/careers/"]').first();
    await firstJob.click();
    await expect(page.getByRole('button', { name: /enviar postulacion/i })).toBeVisible();

    const stamp = Date.now();
    await page.getByLabel(/^Nombre/).fill('Candidata');
    await page.getByLabel(/^Apellido/).fill('Playwright');
    await page.getByLabel(/^Correo/).fill(`candidata.pw.${stamp}@example.com`);
    await page.getByLabel(/^Telefono/).fill('3001234567');
    await page
      .getByLabel(/carta de presentacion/i)
      .fill('Postulacion creada por la suite de navegador.');

    // El envio queda bloqueado hasta aceptar el tratamiento de datos.
    const submit = page.getByRole('button', { name: /enviar postulacion/i });
    await expect(submit).toBeDisabled();
    await page.getByRole('checkbox').last().check();
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(page.getByText(/postulacion enviada/i)).toBeVisible({ timeout: 20_000 });
  });

  test('filtra las vacantes por modalidad', async ({ page }) => {
    await page.goto(`/careers/${COMPANY_SLUG}`);
    const before = await page.locator('a[href*="/careers/"]').count();
    await page.getByRole('combobox').first().selectOption('remoto');
    const after = await page.locator('a[href*="/careers/"]').count();
    expect(after).toBeLessThanOrEqual(before);
  });

  test('una empresa inexistente muestra un mensaje claro', async ({ page }) => {
    await page.goto('/careers/empresa-que-no-existe');
    await expect(page.getByText(/empresa no encontrada/i)).toBeVisible();
  });
});

test.describe('la postulacion llega al equipo de seleccion', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.hr);
  });

  test('el candidato aparece en la lista', async ({ page }) => {
    await page.goto('/recruiting/candidatos');
    await expect(page.getByRole('heading', { name: /candidat/i })).toBeVisible();
    await page
      .getByPlaceholder(/buscar/i)
      .first()
      .fill('Playwright');
    await expect(page.getByText(/Playwright/).first()).toBeVisible({ timeout: 20_000 });
  });
});
