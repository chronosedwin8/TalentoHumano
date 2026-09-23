import { expect, test } from '@playwright/test';
import { USERS, signIn } from './fixtures';

/**
 * Every settings tab must render with real data. Two of them crashed because
 * the page expected a different response shape than the API returns; this
 * walks all of them so a contract mismatch shows up as a failing test.
 */
const TABS = [
  'empresa',
  'organizacion',
  'usuarios',
  'roles',
  'modulos',
  'catalogos',
  'campos',
  'integraciones',
  'auditoria',
];

test.describe('configuracion', () => {
  for (const tab of TABS) {
    test(`la pestana ${tab} carga sin errores`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await signIn(page, USERS.admin);
      await page.goto(`/settings/${tab}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Unexpected Application Error')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test('usuarios muestra nombre, correo y roles', async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.goto('/settings/usuarios');
    await page.getByPlaceholder('Buscar por nombre o correo').fill('admin@demo.com');
    const row = page.locator('tbody tr').filter({ hasText: 'admin@demo.com' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Administrador de empresa');
  });

  test('auditoria lista las entidades en el filtro', async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.goto('/settings/auditoria');
    const options = page.locator('select').first().locator('option');
    await expect(options.nth(1)).toHaveText(/\(\d+\)$/);
  });
});
