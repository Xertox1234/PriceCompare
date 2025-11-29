/**
 * E2E Test Helper Functions
 *
 * Shared utilities for Playwright E2E tests
 */
import { type Page } from '@playwright/test';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

/**
 * Clean database before tests
 * Removes all test data to ensure isolation
 */
export async function cleanDatabase() {
  // Use TRUNCATE CASCADE to reset all tables
  // This is faster and safer than deleting individual records
  await db.execute(sql`
    TRUNCATE TABLE
      users,
      products,
      product_offers,
      price_history,
      price_alerts,
      watch_lists,
      forum_topics,
      forum_posts,
      notifications,
      user_sessions
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Register a new user through the UI
 */
export async function registerUser(
  page: Page,
  username: string,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/');

  // Wait for navigation to be ready
  await page.waitForLoadState('networkidle');

  // Click register link
  await page.click('text=Register');
  await page.waitForURL(/.*\/(register|signup).*/);

  // Fill registration form
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');
}

/**
 * Login an existing user through the UI
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');
}

/**
 * Logout current user
 */
export async function logoutUser(page: Page): Promise<void> {
  // Look for logout button/link (may vary by implementation)
  const logoutSelectors = [
    'button:has-text("Logout")',
    'a:has-text("Logout")',
    'button:has-text("Log out")',
    'a:has-text("Log out")',
  ];

  for (const selector of logoutSelectors) {
    try {
      await page.click(selector, { timeout: 2000 });
      return;
    } catch {
      // Try next selector
    }
  }

  throw new Error('Could not find logout button');
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  status?: number
): Promise<void> {
  await page.waitForResponse(
    response => {
      const matchesUrl = typeof urlPattern === 'string'
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url());

      const matchesStatus = status ? response.status() === status : true;

      return matchesUrl && matchesStatus;
    },
    { timeout: 10000 }
  );
}

/**
 * Wait for toast/notification message
 */
export async function waitForToast(
  page: Page,
  message: string | RegExp
): Promise<void> {
  const toastSelectors = [
    '[role="alert"]',
    '.toast',
    '.notification',
    '[data-sonner-toast]',
  ];

  for (const selector of toastSelectors) {
    try {
      if (typeof message === 'string') {
        await page.waitForSelector(`${selector}:has-text("${message}")`, { timeout: 5000 });
      } else {
        const toast = await page.waitForSelector(selector, { timeout: 5000 });
        const text = await toast.textContent();
        if (text && message.test(text)) {
          return;
        }
      }
      return;
    } catch {
      // Try next selector
    }
  }
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check for user-specific elements
  const loggedInSelectors = [
    'button:has-text("Logout")',
    'a:has-text("Logout")',
    '[data-testid="user-menu"]',
    '.user-profile',
  ];

  for (const selector of loggedInSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      return true;
    } catch {
      // Try next selector
    }
  }

  return false;
}

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Generate unique test username
 */
export function generateTestUsername(prefix = 'user'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}`;
}
