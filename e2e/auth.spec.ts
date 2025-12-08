/**
 * E2E Tests: Authentication Flow
 *
 * Tests user registration, login, logout, and password management
 */
import { test, expect } from '@playwright/test';
import {
  cleanDatabase,
  registerUser,
  loginUser,
  logoutUser,
  waitForApiResponse,
  waitForToast as _waitForToast,
  isLoggedIn,
  generateTestEmail,
  generateTestUsername,
} from './helpers';

test.describe('Authentication Flow', () => {
  test.beforeEach(async () => {
    // Clean database before each test for isolation
    await cleanDatabase();
  });

  test.describe('User Registration', () => {
    test('should register a new user successfully', async ({ page }) => {
      const username = generateTestUsername('newuser');
      const email = generateTestEmail('newuser');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);

      // Wait for registration to complete
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Should redirect to home page
      await expect(page).toHaveURL('/');

      // Should be logged in
      const loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(true);

      // Should display welcome message or username
      await expect(page.locator(`text=${username}`)).toBeVisible({ timeout: 5000 });
    });

    test('should show validation errors for invalid input', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Try to submit with empty fields
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('text=/required|cannot be empty/i')).toBeVisible();
    });

    test('should reject weak passwords', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      const username = generateTestUsername();
      const email = generateTestEmail();

      await page.fill('input[name="username"]', username);
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', 'weak'); // Too short

      await page.click('button[type="submit"]');

      // Should show password strength error
      await expect(
        page.locator('text=/password.*must be|password.*too short|at least.*characters/i')
      ).toBeVisible();
    });

    test('should reject duplicate email', async ({ page }) => {
      const username1 = generateTestUsername('user1');
      const username2 = generateTestUsername('user2');
      const email = generateTestEmail('duplicate');
      const password = 'SecurePass123!';

      // Register first user
      await registerUser(page, username1, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Logout
      await logoutUser(page);

      // Try to register second user with same email
      await registerUser(page, username2, email, password);

      // Should show duplicate email error
      await expect(
        page.locator('text=/email.*already.*exists|email.*taken|already.*registered/i')
      ).toBeVisible();
    });

    test('should reject invalid email format', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      const username = generateTestUsername();

      await page.fill('input[name="username"]', username);
      await page.fill('input[name="email"]', 'not-an-email');
      await page.fill('input[name="password"]', 'SecurePass123!');

      await page.click('button[type="submit"]');

      // Should show email validation error
      await expect(page.locator('text=/invalid.*email|valid.*email.*address/i')).toBeVisible();
    });
  });

  test.describe('User Login', () => {
    test('should login with valid credentials', async ({ page }) => {
      const username = generateTestUsername('loginuser');
      const email = generateTestEmail('loginuser');
      const password = 'SecurePass123!';

      // Register user first
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Logout
      await logoutUser(page);

      // Login again
      await loginUser(page, email, password);
      await waitForApiResponse(page, '/api/auth/login', 200);

      // Should redirect to home
      await expect(page).toHaveURL('/');

      // Should be logged in
      const loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(true);
    });

    test('should reject invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      await page.fill('input[name="email"]', 'nonexistent@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');

      await page.click('button[type="submit"]');

      // Should show invalid credentials error
      await expect(
        page.locator('text=/invalid.*credentials|incorrect.*email.*password|login.*failed/i')
      ).toBeVisible();

      // Should not be logged in
      const loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(false);
    });

    test('should show error for non-existent user', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      await page.fill('input[name="email"]', generateTestEmail('nonexistent'));
      await page.fill('input[name="password"]', 'SomePassword123!');

      await page.click('button[type="submit"]');

      // Should show error
      await expect(
        page.locator('text=/invalid.*credentials|user.*not.*found|login.*failed/i')
      ).toBeVisible();
    });

    test('should lock account after multiple failed attempts', async ({ page }) => {
      const username = generateTestUsername('locktest');
      const email = generateTestEmail('locktest');
      const password = 'SecurePass123!';

      // Register user
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);
      await logoutUser(page);

      // Attempt login with wrong password multiple times (5+ times based on lockout policy)
      for (let i = 0; i < 6; i++) {
        await page.goto('/login');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'WrongPassword123!');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500); // Brief pause between attempts
      }

      // Should show account locked message
      await expect(
        page.locator('text=/account.*locked|too.*many.*attempts|temporarily.*disabled/i')
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
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Verify logged in
      let loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(true);

      // Logout
      await logoutUser(page);
      await waitForApiResponse(page, '/api/auth/logout', 200);

      // Should redirect to home or login page
      await page.waitForLoadState('networkidle');

      // Should not be logged in
      loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(false);

      // Should show login button
      await expect(page.locator('text=/login|sign in/i')).toBeVisible();
    });

    test('should clear session on logout', async ({ page }) => {
      const username = generateTestUsername('sessiontest');
      const email = generateTestEmail('sessiontest');
      const password = 'SecurePass123!';

      // Register and login
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Logout
      await logoutUser(page);
      await waitForApiResponse(page, '/api/auth/logout', 200);

      // Try to access protected route
      await page.goto('/alerts'); // Assuming alerts requires authentication

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/(login|signin).*/);
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session across page navigation', async ({ page }) => {
      const username = generateTestUsername('navtest');
      const email = generateTestEmail('navtest');
      const password = 'SecurePass123!';

      // Register user
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Navigate to different pages
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Should still be logged in
      let loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(true);

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Should still be logged in
      loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(true);
    });

    test('should maintain session after page reload', async ({ page }) => {
      const username = generateTestUsername('reloadtest');
      const email = generateTestEmail('reloadtest');
      const password = 'SecurePass123!';

      // Register user
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be logged in
      const loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(true);
    });
  });

  test.describe('Password Reset Flow', () => {
    test('should request password reset', async ({ page }) => {
      const username = generateTestUsername('resettest');
      const email = generateTestEmail('resettest');
      const password = 'SecurePass123!';

      // Register user
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);
      await logoutUser(page);

      // Go to password reset page
      await page.goto('/login');
      await page.click('text=/forgot.*password|reset.*password/i');

      // Should be on password reset request page
      await expect(page).toHaveURL(/.*\/(forgot-password|reset-password|password-reset).*/);

      // Request reset
      await page.fill('input[name="email"]', email);
      await page.click('button[type="submit"]');

      // Should show success message
      await expect(page.locator('text=/email.*sent|check.*email|reset.*link/i')).toBeVisible();
    });

    test('should handle invalid email in reset request', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      await page.fill('input[name="email"]', 'invalid-email');
      await page.click('button[type="submit"]');

      // Should show validation error
      await expect(page.locator('text=/invalid.*email|valid.*email/i')).toBeVisible();
    });
  });

  test.describe('Authentication Guards', () => {
    test('should redirect unauthenticated users from protected routes', async ({ page }) => {
      // Try to access protected route without authentication
      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/(login|signin).*/);
    });

    test('should allow authenticated users to access protected routes', async ({ page }) => {
      const username = generateTestUsername('guardtest');
      const email = generateTestEmail('guardtest');
      const password = 'SecurePass123!';

      // Register and login
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Access protected route
      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should stay on alerts page
      await expect(page).toHaveURL(/.*\/alerts.*/);
    });
  });
});
