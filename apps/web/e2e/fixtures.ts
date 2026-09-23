import { expect, type Page } from '@playwright/test';

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';

export const USERS = {
  admin: 'admin@demo.com',
  hr: 'hr@demo.com',
  manager: 'manager@demo.com',
  employee: 'empleado@demo.com',
  ethics: 'etica@demo.com',
};

/** The demo company slug, used by the public portals. */
export const COMPANY_SLUG = process.env.E2E_COMPANY_SLUG ?? 'demo';

/**
 * Signs in through the real form and waits for the app shell.
 *
 * Every test signs in on its own: refresh tokens are single use and rotate, so
 * a session saved once and shared between tests only works for the first one.
 * The login rate limit is tunable (`AUTH_LOGIN_LIMIT`) for exactly this kind
 * of traffic from a single address.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/auth/ingresar');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL(/\/(dashboard|portal)/, { timeout: 30_000 });
}

/** Fails the test if an error toast is visible. */
export async function expectNoErrorToast(page: Page): Promise<void> {
  await expect(page.getByText(/no fue posible/i)).toHaveCount(0);
}
