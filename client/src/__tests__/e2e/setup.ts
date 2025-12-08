import { test as setup } from '@playwright/test';

/**
 * Global Setup for E2E Tests
 * Runs once before all tests
 */

const _authFile = '.auth/user.json';

setup('authenticate', async ({ page }) => {
  // This is an example setup for authenticated tests
  // Adjust based on your authentication flow

  // For now, we'll just navigate to home to ensure app is running
  await page.goto('/');

  // If you need to login for tests, do it here:
  // await page.goto('/login');
  // await page.getByLabel('username').fill('testuser');
  // await page.getByLabel('password').fill('testpass');
  // await page.getByRole('button', { name: 'Sign in' }).click();
  // await page.waitForURL('/dashboard');
  // await page.context().storageState({ path: authFile });
});
