import { expect, test } from '@playwright/test';
import { USERS, expectNoErrorToast, signIn } from './fixtures';

/**
 * Screens added after the release audit. Each one must render its header
 * and load its data without an error toast; the detail pages open from a row.
 */
test.describe('pantallas de operacion', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.admin);
  });

  test('entrevistas: agenda y dialogo de programacion', async ({ page }) => {
    await page.goto('/recruiting/entrevistas');
    await expect(page.getByRole('heading', { name: 'Entrevistas' })).toBeVisible();
    await page.getByRole('button', { name: 'Programar entrevista' }).click();
    await expect(page.getByRole('dialog')).toContainText('Programar entrevista');
    await page.keyboard.press('Escape');
    await expectNoErrorToast(page);
  });

  test('ofertas: listado y formulario', async ({ page }) => {
    await page.goto('/recruiting/ofertas');
    await expect(page.getByRole('heading', { name: 'Ofertas' })).toBeVisible();
    await page.getByRole('button', { name: 'Nueva oferta' }).click();
    await expect(page.getByRole('dialog')).toContainText('Nueva carta de oferta');
    await page.keyboard.press('Escape');
    await expectNoErrorToast(page);
  });

  test('ficha del candidato desde el banco', async ({ page }) => {
    await page.goto('/recruiting/candidatos');
    await expect(page.getByRole('heading', { name: 'Banco de candidatos' })).toBeVisible();
    const firstRow = page.locator('tbody tr').first();
    await firstRow.waitFor();
    await firstRow.click();
    await page.waitForURL(/\/recruiting\/candidatos\//);
    await expect(page.getByText('Postulaciones')).toBeVisible();
    await expect(page.getByText('Notas del equipo')).toBeVisible();
    await expectNoErrorToast(page);
  });

  test('tipos de ausencia y politicas', async ({ page }) => {
    await page.goto('/leaves/tipos');
    await expect(
      page.getByRole('heading', { name: 'Tipos de ausencia y politicas' }),
    ).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await page.getByRole('button', { name: 'Nuevo tipo' }).click();
    await expect(page.getByRole('dialog')).toContainText('Nuevo tipo de ausencia');
    await page.keyboard.press('Escape');
    await expectNoErrorToast(page);
  });

  test('justificaciones de asistencia', async ({ page }) => {
    await page.goto('/time/justificaciones');
    await expect(
      page.getByRole('heading', { name: 'Justificaciones de asistencia' }),
    ).toBeVisible();
    await expectNoErrorToast(page);
  });

  test('exportacion de asistencia descarga un CSV', async ({ page }) => {
    await page.goto('/time/asistencia');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^asistencia-.*\.csv$/);
  });
});
