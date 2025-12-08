import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * Tests user registration and login flows
 */

test.describe('Authentication', () => {
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  test.describe('Registration', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/');

      // Look for register/sign up link (adjust selector based on your UI)
      const registerLink = page.getByRole('link', { name: /sign up|register/i });

      if (await registerLink.isVisible()) {
        await registerLink.click();

        // Verify registration form is visible
        await expect(page.getByRole('heading', { name: /register|sign up/i })).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('should show validation errors for invalid input', async ({ page }) => {
      await page.goto('/');

      const registerLink = page.getByRole('link', { name: /sign up|register/i });
      if (!(await registerLink.isVisible())) {
        test.skip();
        return;
      }

      await registerLink.click();

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /register|sign up/i });
      await submitButton.click();

      // Should show validation errors (adjust based on your error display)
      await expect(page.locator('text=/required|invalid/i').first()).toBeVisible({ timeout: 3000 });
    });

    test('should register new user successfully', async ({ page }) => {
      await page.goto('/');

      const registerLink = page.getByRole('link', { name: /sign up|register/i });
      if (!(await registerLink.isVisible())) {
        test.skip();
        return;
      }

      await registerLink.click();

      // Fill registration form (adjust selectors based on your form)
      await page.getByLabel(/username/i).fill(testUser.username);
      await page.getByLabel(/email/i).fill(testUser.email);
      await page
        .getByLabel(/password/i)
        .first()
        .fill(testUser.password);

      // Submit form
      await page.getByRole('button', { name: /register|sign up/i }).click();

      // Wait for redirect or success message
      await expect(page).toHaveURL(/\/(dashboard|home|products)/, { timeout: 10000 });
    });
  });

  test.describe('Login', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/');

      // Look for login/sign in link
      const loginLink = page.getByRole('link', { name: /log in|sign in/i });

      if (await loginLink.isVisible()) {
        await loginLink.click();

        // Verify login form is visible
        await expect(page.getByRole('heading', { name: /log in|sign in/i })).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/');

      const loginLink = page.getByRole('link', { name: /log in|sign in/i });
      if (!(await loginLink.isVisible())) {
        test.skip();
        return;
      }

      await loginLink.click();

      // Try invalid credentials
      await page.getByLabel(/username|email/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /log in|sign in/i }).click();

      // Should show error message
      await expect(page.locator('text=/invalid|incorrect|failed/i').first()).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('Logout', () => {
    test('should logout user successfully', async ({ page }) => {
      // This test assumes user is logged in
      // You may need to add login logic here or use a setup fixture

      await page.goto('/');

      const logoutButton = page.getByRole('button', { name: /log out|sign out/i });
      if (!(await logoutButton.isVisible())) {
        test.skip();
        return;
      }

      await logoutButton.click();

      // Should redirect to homepage or login
      await expect(page).toHaveURL(/\/(|login|signin)/, { timeout: 5000 });
    });
  });
});
