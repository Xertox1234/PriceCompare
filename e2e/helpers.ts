/**
 * E2E Test Helper Functions
 *
 * Shared utilities for Playwright E2E tests
 */
import { type Page } from '@playwright/test';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { getRedisSessionClient } from '../server/config/redis';
import { nextDeterministicSuffix } from './helpers/deterministic';

/**
 * Clean database before tests
 * Removes all test data to ensure isolation
 */
export async function cleanDatabase() {
  // Ensure recently-added tables exist in the test database.
  // Playwright's local webServer does not automatically run migrations.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS watch_list_shares (
      id SERIAL PRIMARY KEY,
      watch_list_id INTEGER NOT NULL REFERENCES watch_lists(id) ON DELETE CASCADE,
      shared_with_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission VARCHAR(10) NOT NULL CHECK (permission IN ('view', 'edit')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT unique_watch_list_share UNIQUE (watch_list_id, shared_with_user_id)
    );

    CREATE INDEX IF NOT EXISTS watch_list_shares_watch_list_id_idx ON watch_list_shares(watch_list_id);
    CREATE INDEX IF NOT EXISTS watch_list_shares_shared_with_user_id_idx ON watch_list_shares(shared_with_user_id);
  `);

  // Use TRUNCATE CASCADE to reset all tables
  // This is faster and safer than deleting individual records
  // Only includes core tables that are guaranteed to exist
  await db.execute(sql`
    TRUNCATE TABLE
      users,
      products,
      product_offers,
      price_history,
      price_alerts,
      watch_lists,
      notifications,
      retailers,
      password_reset_tokens,
      notification_preferences,
      product_watches,
      watch_list_shares,
      user_reputation,
      scraping_jobs,
      price_snapshots
    RESTART IDENTITY CASCADE
  `);

  // CRITICAL: Clear Redis sessions to prevent session leakage between tests
  // Sessions persist in Redis even after database truncation and browser cookie clearing
  const redisClient = getRedisSessionClient();
  if (redisClient) {
    // Clear all session keys (prefix: sess:)
    const sessionKeys = await redisClient.keys('sess:*');
    if (sessionKeys.length > 0) {
      await redisClient.del(sessionKeys);
    }
  }
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
  // Navigate to /price-watch page which uses SharedNavigation (has Sign Up button)
  // Can't use /admin (redirects unauthenticated users) or / (uses TemplateHeader, no Sign Up)
  await page.goto('/price-watch');

  // Clear all browser state to ensure clean test environment (must be after navigation)
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Reload page to apply cleared state
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Click Sign Up button in navigation to open auth modal
  // Use .first() because there are multiple Sign Up buttons (nav, main, footer)
  await page
    .getByRole('button', { name: /sign up/i })
    .first()
    .click();

  // Wait for modal to open
  await page.waitForSelector('input#username', { state: 'visible', timeout: 5000 });

  // Fill registration form (uses id selectors based on actual form structure)
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/email/i).fill(email);
  await page
    .getByLabel(/^password$/i)
    .first()
    .fill(password);
  await page.getByLabel(/confirm.*password/i).fill(password);

  // Submit form (button text is "Create Account")
  await page.getByRole('button', { name: /create account/i }).click();

  // Wait for registration to complete by checking UI state
  // IMPORTANT: Don't use waitForApiResponse() - it creates race conditions (API completes before we start listening)
  // Instead, wait for the UI state change that indicates successful registration
  // CRITICAL: Wait for user to be logged in (modal closes and user menu appears)
  // Registration API returns 201 but React needs time to update auth state
  // Use .first() because multiple navigation instances exist (desktop, mobile, etc.)
  await page.getByTestId('user-menu-button').first().waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Login an existing user through the UI (via modal)
 */
export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  // Navigate to /price-watch page which uses SharedNavigation (has Sign In button)
  // Login is a modal - /login route triggers 404
  await page.goto('/price-watch');
  await page.waitForLoadState('networkidle');

  // Click Sign In button in navigation to open auth modal
  // Use .first() because there may be multiple Sign In buttons
  await page
    .getByRole('button', { name: /sign in/i })
    .first()
    .click();

  // Wait for modal to open
  await page.waitForSelector('input#email', { state: 'visible', timeout: 5000 });

  // Fill login form using label-based selectors (matches registerUser pattern)
  await page.getByLabel(/email/i).fill(email);
  await page
    .getByLabel(/^password$/i)
    .first()
    .fill(password);

  // Submit form (button text is "Sign In")
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // CRITICAL: Wait for user to be logged in (modal closes and user menu appears)
  // Use .first() because multiple navigation instances exist (desktop, mobile, etc.)
  await page.getByTestId('user-menu-button').first().waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Logout current user
 * Works with both TemplateHeader and SharedNavigation components
 */
export async function logoutUser(page: Page): Promise<void> {
  // Best-effort UI logout, with a fallback to clearing browser state.
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);

  const userMenuButton = page.getByTestId('user-menu-button').first();
  const hasUserMenu = await userMenuButton.isVisible().catch(() => false);

  if (!hasUserMenu) {
    // Some routes use different headers; clearing cookies/storage reliably logs out.
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/price-watch');
    await page.waitForLoadState('networkidle');
    return;
  }

  try {
    await userMenuButton.click({ timeout: 5000 });
    const signOutButton = page.getByTestId('sign-out-button');
    await signOutButton.waitFor({ state: 'visible', timeout: 5000 });
    await signOutButton.click({ timeout: 5000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
  } catch (error) {
    throw new Error(`Could not logout: ${error instanceof Error ? error.message : String(error)}`);
  }
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
    (response) => {
      const matchesUrl =
        typeof urlPattern === 'string'
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
export async function waitForToast(page: Page, message: string | RegExp): Promise<void> {
  const toastSelectors = ['[role="alert"]', '.toast', '.notification', '[data-sonner-toast]'];

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
  return `${prefix}-${nextDeterministicSuffix('email')}@example.com`;
}

/**
 * Generate unique test username
 */
export function generateTestUsername(prefix = 'user'): string {
  return `${prefix}_${nextDeterministicSuffix('user')}`;
}
