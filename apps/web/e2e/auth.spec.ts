import { expect, test } from '@playwright/test';
import { USERS, signIn } from './fixtures';

test.describe('ingreso a la plataforma', () => {
  // Estas pruebas son sobre el ingreso: empiezan siempre sin sesion.

  test('un colaborador ingresa y llega a su tablero', async ({ page }) => {
    await signIn(page, USERS.employee);
    await expect(page).toHaveURL(/\/(dashboard|portal)/);
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('rechaza una contrasena incorrecta sin dejar entrar', async ({ page }) => {
    await page.goto('/auth/ingresar');
    await page.locator('#email').fill(USERS.employee);
    await page.locator('#password').fill('contrasena-incorrecta');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByText(/invalid|incorrect|no fue posible/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/ingresar/);
  });

  test('una ruta privada redirige al ingreso cuando no hay sesion', async ({ page }) => {
    await page.goto('/people');
    await expect(page).toHaveURL(/\/auth\/ingresar/);
  });

  test('la recuperacion de contrasena no revela si el correo existe', async ({ page }) => {
    await page.goto('/auth/recuperar');
    await page.locator('#email').fill('nadie-existe@demo.com');
    await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
    await expect(page.getByText(/si el correo existe/i)).toBeVisible();
  });

  test('la sesion sobrevive a una recarga', async ({ page }) => {
    await signIn(page, USERS.hr);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});

test.describe('el menu depende del rol', () => {
  test.describe('un colaborador', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, USERS.employee);
    });

    test('no ve Configuracion en el menu', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('navigation')).toBeVisible();
      await expect(
        page.getByRole('navigation').getByRole('link', { name: /configuraci/i }),
      ).toHaveCount(0);
    });
  });

  test.describe('el administrador de empresa', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, USERS.admin);
    });

    test('si ve Configuracion en el menu', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(
        page.getByRole('navigation').getByRole('link', { name: /configuraci/i }),
      ).toBeVisible();
    });
  });
});

test.describe('idioma de la interfaz', () => {
  test('la interfaz arranca en espanol', async ({ page }) => {
    await page.goto('/auth/ingresar');
    await expect(page.getByText('Correo corporativo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });

  test('no deja cadenas sin traducir en la pantalla de ingreso', async ({ page }) => {
    await page.goto('/auth/ingresar');
    const body = (await page.textContent('body')) ?? '';
    // Una clave i18n sin resolver se ve como `auth.email`.
    expect(body).not.toMatch(/\b(auth|common|modules|nav)\.[a-zA-Z]+\b/);
  });
});
