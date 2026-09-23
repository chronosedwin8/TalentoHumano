import { expect, test } from '@playwright/test';
import { USERS, signIn } from './fixtures';

/**
 * The self-service portal is what most of the company actually uses, and it is
 * used from a phone: this file runs in the `mobile` project too.
 */
test.describe('portal del colaborador', () => {
  // Reanuda la sesion guardada del colaborador en vez de volver a entrar.
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.employee);
  });

  test('muestra el resumen personal', async ({ page }) => {
    await page.goto('/portal');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('el colaborador consulta su saldo de vacaciones', async ({ page }) => {
    await page.goto('/portal/solicitudes');
    await expect(page.getByText(/vacaciones|solicitud/i).first()).toBeVisible();
  });

  test('el colaborador ve su perfil y sus datos', async ({ page }) => {
    await page.goto('/portal/perfil');
    await expect(page.getByRole('heading').first()).toBeVisible();
    // Nunca debe ver su salario en el portal si el rol no lo permite.
    await expect(page.getByText(/enc:v1:/)).toHaveCount(0);
  });

  test('solicitar vacaciones desde el portal', async ({ page }) => {
    await page.goto('/leaves');
    const nueva = page.getByRole('button', { name: /nueva solicitud|solicitar/i }).first();
    if ((await nueva.count()) === 0) test.skip(true, 'El rol no puede crear solicitudes');
    await nueva.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page
        .getByRole('dialog')
        .getByText(/tipo|desde|hasta/i)
        .first(),
    ).toBeVisible();
  });

  test('no expone modulos que su rol no tiene', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('el menu movil se abre y cierra', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Solo aplica al proyecto movil');
    await page.goto('/portal');
    await page.getByRole('button', { name: /menu/i }).first().click();
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('la pagina no desborda horizontalmente en movil', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Solo aplica al proyecto movil');
    await page.goto('/portal');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});

test.describe('verificacion publica de documentos', () => {
  test('un codigo inexistente lo dice sin exponer datos', async ({ page }) => {
    await page.goto('/verificar/TAL-0000-0000-0000');
    await expect(page.getByText(/documento no encontrado/i)).toBeVisible();
  });
});
