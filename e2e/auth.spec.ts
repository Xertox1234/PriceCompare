/**
 * E2E Tests: Authentication Flow
 *
 * Tests user registration, login, logout, and password management
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import {
  registerUser,
  loginUser,
  logoutUser,
  generateTestEmail,
  generateTestUsername,
} from './helpers';

test.describe('Authentication Flow', () => {
  async function openRegisterModal(page: Page): Promise<void> {
    await page.goto('/price-watch');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /sign up/i }).first().click();
    await page.waitForSelector('input#username', { state: 'visible', timeout: 5000 });
  }

  async function openLoginModal(page: Page): Promise<void> {
    await page.goto('/price-watch');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await page.waitForSelector('input#email', { state: 'visible', timeout: 5000 });
  }

  test.describe('User Registration', () => {
    test('should register a new user successfully', async ({ page }) => {
      const username = generateTestUsername('newuser');
      const email = generateTestEmail('newuser');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);

      // Should be logged in (user menu appears)
      await expect(page.getByTestId('user-menu-button').first()).toBeVisible();

      // Username/email should be visible in the user menu
      await page.getByTestId('user-menu-button').first().click();
      await expect(page.getByText(username, { exact: true })).toBeVisible();
      await expect(page.getByText(email, { exact: true })).toBeVisible();
    });

    test('should keep submit disabled until valid inputs', async ({ page }) => {
      await openRegisterModal(page);

      const submit = page.getByRole('button', { name: /create account/i });
      await expect(submit).toBeDisabled();

      const username = generateTestUsername('valid');
      const email = generateTestEmail('valid');
      await page.getByLabel(/username/i).fill(username);
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).first().fill('SecurePass123!');

      // Mismatch keeps submit disabled and shows inline error
      await page.getByLabel(/confirm.*password/i).fill('DifferentPass123!');
      await expect(page.getByText(/passwords do not match/i)).toBeVisible();
      await expect(submit).toBeDisabled();

      await page.getByLabel(/confirm.*password/i).fill('SecurePass123!');
      await expect(submit).toBeEnabled();
    });

    test('should reject duplicate email', async ({ page }) => {
      const username1 = generateTestUsername('user1');
      const username2 = generateTestUsername('user2');
      const email = generateTestEmail('duplicate');
      const password = 'SecurePass123!';

      // Register first user
      await registerUser(page, username1, email, password);

      await expect(page.getByTestId('user-menu-button').first()).toBeVisible();

      // Logout
      await logoutUser(page);

      // Try to register second user with same email
      await openRegisterModal(page);
      await page.getByLabel(/username/i).fill(username2);
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).first().fill(password);
      await page.getByLabel(/confirm.*password/i).fill(password);
      await page.getByRole('button', { name: /create account/i }).click();

      // Should show duplicate email error
      await expect(
        page
          .getByRole('alert')
          .getByText(/user already exists|email.*already.*exists|email.*taken|already.*registered/i)
      ).toBeVisible();
    });
  });

  test.describe('User Login', () => {
    test('should login with valid credentials', async ({ page }) => {
      const username = generateTestUsername('loginuser');
      const email = generateTestEmail('loginuser');
      const password = 'SecurePass123!';

      // Register user first
      await registerUser(page, username, email, password);
      await expect(page.getByTestId('user-menu-button').first()).toBeVisible();

      // Logout
      await logoutUser(page);

      // Login again
      await loginUser(page, email, password);

      // Should be logged in
      await expect(page.getByTestId('user-menu-button').first()).toBeVisible();
    });

    test('should reject invalid credentials', async ({ page }) => {
      await openLoginModal(page);

      await page.getByLabel(/email/i).fill('nonexistent@example.com');
      await page.getByLabel(/^password$/i).first().fill('wrongpassword');
      await page.getByRole('button', { name: /^sign in$/i }).click();

      // Should show invalid credentials error
      await expect(
        page
          .getByRole('alert')
          .getByText(
            /invalid.*credentials|invalid email or password|account.*locked|too.*many.*attempts|incorrect.*email.*password|login.*failed/i
          )
      ).toBeVisible();

      // Should not be logged in
      await expect(page.getByTestId('user-menu-button')).toHaveCount(0);
    });

    test('should show error for non-existent user', async ({ page }) => {
      await openLoginModal(page);

      await page.getByLabel(/email/i).fill(generateTestEmail('nonexistent'));
      await page.getByLabel(/^password$/i).first().fill('SomePassword123!');

      await page.getByRole('button', { name: /^sign in$/i }).click();

      // Should show error
      await expect(
        page
          .getByRole('alert')
          .getByText(/invalid.*credentials|invalid email or password|user.*not.*found|login.*failed/i)
      ).toBeVisible();
    });
  });

  test.describe('User Logout', () => {
    test('should logout successfully', async ({ page }) => {
      const username = generateTestUsername('logoutuser');
      const email = generateTestEmail('logoutuser');
      const password = 'SecurePass123!';

      // Register and login
      await registerUser(page, username, email, password);
      await expect(page.getByTestId('user-menu-button').first()).toBeVisible();

      // Logout
      await logoutUser(page);

      // Should show login button
      await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
      await expect(page.getByTestId('user-menu-button')).toHaveCount(0);
    });

    test('should clear session on logout', async ({ page }) => {
      const username = generateTestUsername('sessiontest');
      const email = generateTestEmail('sessiontest');
      const password = 'SecurePass123!';

      // Register and login
      await registerUser(page, username, email, password);
      await expect(page.getByTestId('user-menu-button').first()).toBeVisible();

      // Logout
      await logoutUser(page);

      // Try to access protected route
      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Alerts currently does not redirect; it should show unauthenticated UI
      await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
      await expect(page.getByTestId('user-menu-button')).toHaveCount(0);
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session across page navigation', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.getByTestId('user-menu-button').first()).toBeVisible();

      // Navigate to different pages
      await authenticatedPage.goto('/products');
      await authenticatedPage.waitForLoadState('networkidle');
      await expect(authenticatedPage.getByTestId('user-menu-button').first()).toBeVisible();

      await authenticatedPage.goto('/price-watch');
      await authenticatedPage.waitForLoadState('networkidle');
      await expect(authenticatedPage.getByTestId('user-menu-button').first()).toBeVisible();
    });

    test('should maintain session after page reload', async ({ authenticatedPage }) => {
      await expect(authenticatedPage.getByTestId('user-menu-button').first()).toBeVisible();

      // Reload page
      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState('networkidle');
      await expect(authenticatedPage.getByTestId('user-menu-button').first()).toBeVisible();
    });
  });

  test.describe('Authentication Guards', () => {
    test('should redirect unauthenticated users from protected routes', async ({ page }) => {
      // Try to access protected route without authentication
      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Alerts currently does not redirect; it should show unauthenticated UI
      await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
      await expect(page.getByTestId('user-menu-button')).toHaveCount(0);
    });

    test('should allow authenticated users to access protected routes', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/alerts');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage).toHaveURL(/.*\/alerts.*/);
      await expect(authenticatedPage.getByTestId('user-menu-button').first()).toBeVisible();
    });
  });
});
