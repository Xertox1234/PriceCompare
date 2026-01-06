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
 *
 * SAFETY GUARDRAILS:
 * - Only runs when NODE_ENV=test
 * - Validates database name contains "test"
 * - Validates Redis URL doesn't contain "production"
 * - Uses SCAN instead of KEYS for non-blocking Redis operations
 */
export async function cleanDatabase() {
  // SAFETY: Validate we're in test mode
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'cleanDatabase() can only run when NODE_ENV=test. ' +
      `Current NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`
    );
  }

  // SAFETY: Validate database name contains "test"
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl) {
    try {
      const url = new URL(dbUrl);
      const dbName = url.pathname.slice(1); // Remove leading slash

      if (!dbName.includes('test')) {
        throw new Error(
          `Refusing to truncate database "${dbName}" - name must contain "test". ` +
          `Set DATABASE_NAME=pricecompare_test in .env.test or use a DATABASE_URL with "test" in the database name.`
        );
      }
    } catch (error) {
      if (error instanceof TypeError) {
        // Invalid URL format - let it fail naturally below
        // eslint-disable-next-line no-console -- Test helper needs diagnostic output
        console.warn(`⚠️  Could not parse DATABASE_URL for validation: ${dbUrl}`);
      } else {
        throw error;
      }
    }
  }

  // SCHEMA: Tables created via global setup migrations (e2e/global-setup.ts)
  // No manual CREATE TABLE needed - schema managed by migrations/

  // Use TRUNCATE CASCADE to reset all tables
  // This is faster and safer than deleting individual records
  // CASCADE handles foreign key dependencies automatically (order doesn't matter)
  //
  // E2E TESTING: Truncate tables conditionally to handle schema evolution
  // Some tables may not exist yet if migrations haven't been fully applied
  // Use DO block to check table existence before truncating
  await db.execute(sql`
    DO $$
    DECLARE
      tbl TEXT;
      table_list TEXT[] := ARRAY[
        'users', 'products', 'product_offers', 'price_history', 'price_alerts',
        'watch_lists', 'notifications', 'retailers', 'password_reset_tokens',
        'notification_preferences', 'product_watches', 'watch_list_shares',
        'user_reputation', 'trending_products', 'search_queries', 'agent_sessions',
        'scraping_jobs', 'price_predictions', 'scraping_sources', 'price_snapshots'
      ];
    BEGIN
      FOREACH tbl IN ARRAY table_list
      LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(tbl) || ' RESTART IDENTITY CASCADE';
        END IF;
      END LOOP;
    END $$;
  `);

  // CRITICAL: Clear Redis sessions to prevent session leakage between tests
  // Sessions persist in Redis even after database truncation and browser cookie clearing
  const redisClient = getRedisSessionClient();
  if (redisClient) {
    // SAFETY: Validate Redis URL doesn't contain "production"
    const redisUrl = process.env.REDIS_URL || '';
    if (redisUrl.includes('production') || redisUrl.includes('prod-')) {
      throw new Error(
        `Refusing to clear sessions - Redis URL contains "production" or "prod-". ` +
        `Redis URL: ${redisUrl.substring(0, 30)}...`
      );
    }

    // PERFORMANCE: Use SCAN instead of KEYS (non-blocking, O(N) but doesn't block Redis)
    // KEYS is O(N) and blocks all Redis operations during execution
    const sessionKeys: string[] = [];
    let cursor = '0';

    do {
      // SCAN iterates in chunks of 100 keys at a time
      // Returns object: {cursor: string, keys: string[]}
      const result = await redisClient.scan(cursor, {
        MATCH: 'sess:*',
        COUNT: 100,
      });
      cursor = result.cursor;
      const keys = result.keys;

      if (keys.length > 0) {
        sessionKeys.push(...keys);
      }
    } while (cursor !== '0');

    // Delete all session keys in a single operation
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
  await openRegisterModal(page);

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
 * Open the registration modal (without submitting)
 */
export async function openRegisterModal(page: Page): Promise<void> {
  // Navigate to /price-watch page which uses SharedNavigation (has Sign Up button)
  await page.goto('/price-watch');

  // Ensure clean browser state (must be after navigation)
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.reload();
  await page.waitForLoadState('networkidle');

  await page
    .getByRole('button', { name: /sign up/i })
    .first()
    .click();

  await page.waitForSelector('input#username', { state: 'visible', timeout: 5000 });
}

/**
 * Login an existing user through the UI (via modal)
 */
export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await openLoginModal(page);

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
 * Open the login modal (without submitting)
 */
export async function openLoginModal(page: Page): Promise<void> {
  await page.goto('/price-watch');

  // Ensure clean browser state (must be after navigation)
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.reload();
  await page.waitForLoadState('networkidle');

  await page
    .getByRole('button', { name: /sign in/i })
    .first()
    .click();

  await page.waitForSelector('input#email', { state: 'visible', timeout: 5000 });
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

    // Wait for a stable logged-out state to avoid navigation races.
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
    await Promise.race([
      page
        .getByTestId('user-menu-button')
        .first()
        .waitFor({ state: 'hidden', timeout: 10000 })
        .catch(() => undefined),
      page
        .getByRole('button', { name: /sign in/i })
        .first()
        .waitFor({ state: 'visible', timeout: 10000 })
        .catch(() => undefined),
    ]);
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
