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
 * E2E Test Timeout Configuration
 * Centralizes timeout values used across helpers
 *
 * Rationale:
 * - BUTTON: Typically just DOM visibility, fast
 * - MODAL: May have CSS transitions/animations
 * - FORM: Waits for input field to be interactive (may include form init)
 * - USER_STATE: UI updates after API response completes
 * - NETWORK: Waits for all network requests to finish
 * - API_RESPONSE: Waits for specific API endpoint to respond
 */
export const TIMEOUTS = {
  // UI Element Visibility
  BUTTON_VISIBLE: 10000,
  FORM_INPUT: 5000,
  DIALOG_VISIBLE: 5000,

  // User State Changes (API + React state update)
  USER_STATE_CHANGE: 10000,

  // Network Stability
  NETWORK_IDLE: 10000,
  API_RESPONSE: 10000,

  // User Interactions
  CLICK_ACTION: 5000,
} as const;

/**
 * Wait for page to be ready for interaction
 *
 * CRITICAL: Use this instead of page.waitForLoadState('networkidle') in E2E tests.
 *
 * Problem: 'networkidle' waits for ALL network activity to stop, but WebSocket
 * connections never idle - they maintain persistent connections for real-time updates.
 * Tests using 'networkidle' will timeout (45s) waiting for a state that never occurs.
 *
 * Solution: Wait for DOM content to load, then wait for critical elements to be visible.
 *
 * @param page - Playwright page object
 * @param options - Configuration options
 * @param options.waitFor - Optional selector to wait for specific element visibility
 * @param options.timeout - Timeout for element wait (default: 10000ms)
 *
 * @example
 * // Basic usage (replaces networkidle)
 * await waitForPageReady(page);
 *
 * @example
 * // Wait for specific element
 * await waitForPageReady(page, { waitFor: 'main' });
 *
 * @example
 * // Wait with custom timeout
 * await waitForPageReady(page, { waitFor: '[data-testid="dashboard"]', timeout: 15000 });
 */
export async function waitForPageReady(
  page: Page,
  options?: { waitFor?: string; timeout?: number }
): Promise<void> {
  // Wait for DOM content to load (fast, reliable)
  await page.waitForLoadState('domcontentloaded');

  // If specific element requested, wait for it
  if (options?.waitFor) {
    await page.locator(options.waitFor).waitFor({
      state: 'visible',
      timeout: options.timeout ?? 10000,
    });
  }

  // Small stability buffer for React hydration and initial renders
  await page.waitForTimeout(500);
}

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
        -- Core entities (no FK deps)
        'users', 'products', 'retailers', 'forum_categories', 'badges', 'topic_tags',

        -- First-level dependencies (depend only on core entities)
        'product_offers', 'watch_lists', 'notifications', 'password_reset_tokens',
        'notification_preferences', 'user_reputation', 'trending_products',
        'search_queries', 'agent_sessions', 'wishlists', 'user_badges',
        'scraping_sources', 'forum_topics', 'private_messages',
        'user_compare_items', 'user_product_views',

        -- Second-level dependencies (depend on first-level)
        'price_history', 'price_alerts', 'product_watches', 'watch_list_shares',
        'scraping_jobs', 'price_predictions', 'price_snapshots',
        'wishlist_items', 'product_specifications', 'product_urls', 'job_locks',
        'forum_posts', 'deal_spottings', 'topic_tag_relations',

        -- Third-level dependencies (depend on second-level)
        'price_aggregates_daily', 'price_aggregates_weekly', 'price_aggregates_monthly',
        'price_trends', 'post_likes', 'post_mentions', 'post_revisions'
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

  // CRITICAL: Clear Redis keys to prevent data leakage between tests
  // Both sessions AND rate limits persist in Redis even after database truncation
  // Rate limit accumulation across tests causes "Too many requests" errors
  const redisClient = getRedisSessionClient();
  if (redisClient) {
    // SAFETY: Validate Redis URL doesn't contain "production"
    const redisUrl = process.env.REDIS_URL || '';
    if (redisUrl.includes('production') || redisUrl.includes('prod-')) {
      throw new Error(
        `Refusing to clear Redis keys - Redis URL contains "production" or "prod-". ` +
        `Redis URL: ${redisUrl.substring(0, 30)}...`
      );
    }

    // PERFORMANCE: Use SCAN instead of KEYS (non-blocking, O(N) but doesn't block Redis)
    // KEYS is O(N) and blocks all Redis operations during execution

    // Clear session keys, rate limit keys, and account lockout keys
    // Session keys: sess:* (express-session - note different prefix from REDIS_KEYS.SESSION)
    // Rate limit keys: ratelimit:* (see server/config/redis.ts REDIS_KEYS.RATE_LIMIT)
    // Account lockout keys: lockout:* (see server/config/redis.ts REDIS_KEYS.ACCOUNT_LOCKOUT)
    // Cache keys intentionally NOT cleared - tests may rely on cache behavior
    const patternsToClean = ['sess:*', 'ratelimit:*', 'lockout:*'];

    for (const pattern of patternsToClean) {
      const keys: string[] = [];
      let cursor = '0';

      do {
        // SCAN iterates in chunks of 100 keys at a time
        // Returns object: {cursor: string, keys: string[]}
        const result = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = result.cursor;

        if (result.keys.length > 0) {
          keys.push(...result.keys);
        }
      } while (cursor !== '0');

      // Delete all matching keys in a single operation
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
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
  await page.getByTestId('user-menu-button').first().waitFor({ state: 'visible', timeout: TIMEOUTS.USER_STATE_CHANGE });
}

/**
 * Open the registration modal (without submitting)
 */
export async function openRegisterModal(page: Page): Promise<void> {
  // Navigate to home page first
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Then ensure clean browser state
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // CRITICAL: Reload page after clearing cookies to get fresh CSRF token
  // The CSRF token is fetched on app startup (App.tsx useEffect)
  // After clearing cookies, the old token is stale and needs to be refreshed

  // IMPORTANT: Attach response listener BEFORE reload to prevent race condition
  // If we attach after reload(), the response might arrive before the listener is ready
  const csrfTokenPromise = page.waitForResponse(
    (response) => response.url().includes('/api/csrf-token'),
    { timeout: TIMEOUTS.API_RESPONSE }
  );

  // Trigger reload (response listener is already attached)
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // Wait for the token response to arrive
  await csrfTokenPromise.catch(() => {
    // Token might be cached already (304 Not Modified), or app might have token in memory
    // Continue anyway since server accepts both cookie and header validation
  });

  // Click "My account" button to open auth modal
  const myAccountButton = page.getByRole('button', { name: /my account/i }).first();
  await myAccountButton.waitFor({ state: 'visible', timeout: TIMEOUTS.BUTTON_VISIBLE });
  await myAccountButton.click();

  // Wait for modal to open - it might open in login mode first
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: TIMEOUTS.DIALOG_VISIBLE });

  // Check if modal opened in login mode, if so toggle to register mode
  const modalTitle = await page.textContent('[role="dialog"] h2');
  if (modalTitle?.includes('Sign In')) {
    // Click the toggle link to switch to register mode
    await page.getByRole('button', { name: /create.*account|sign up/i }).click();
  }

  // Now wait for the registration form
  await page.waitForSelector('input#username', { state: 'visible', timeout: TIMEOUTS.FORM_INPUT });
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
  await page.getByTestId('user-menu-button').first().waitFor({ state: 'visible', timeout: TIMEOUTS.USER_STATE_CHANGE });
}

/**
 * Open the login modal (without submitting)
 */
export async function openLoginModal(page: Page): Promise<void> {
  // Navigate to home page first
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Then ensure clean browser state
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // CRITICAL: Reload page after clearing cookies to get fresh CSRF token
  // The CSRF token is fetched on app startup (App.tsx useEffect)
  // After clearing cookies, the old token is stale and needs to be refreshed

  // IMPORTANT: Attach response listener BEFORE reload to prevent race condition
  // If we attach after reload(), the response might arrive before the listener is ready
  const csrfTokenPromise = page.waitForResponse(
    (response) => response.url().includes('/api/csrf-token'),
    { timeout: TIMEOUTS.API_RESPONSE }
  );

  // Trigger reload (response listener is already attached)
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // Wait for the token response to arrive
  await csrfTokenPromise.catch(() => {
    // Token might be cached already (304 Not Modified), or app might have token in memory
    // Continue anyway since server accepts both cookie and header validation
  });

  // Click "My account" button to open auth modal
  const myAccountButton = page.getByRole('button', { name: /my account/i }).first();
  await myAccountButton.waitFor({ state: 'visible', timeout: TIMEOUTS.BUTTON_VISIBLE });
  await myAccountButton.click();

  // Wait for modal to open - it should open in login mode by default
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: TIMEOUTS.DIALOG_VISIBLE });

  // Wait for the login form email input
  await page.waitForSelector('input#email', { state: 'visible', timeout: TIMEOUTS.FORM_INPUT });
}

/**
 * Logout current user
 * Works with both TemplateHeader and SharedNavigation components
 *
 * CRITICAL FIX: Waits for /api/auth/logout API response before checking UI state
 * This prevents race conditions where tests proceed before session is cleared
 */
export async function logoutUser(page: Page): Promise<void> {
  // Best-effort UI logout, with a fallback to clearing browser state.
  await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.NETWORK_IDLE }).catch(() => undefined);

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
    await page.waitForLoadState('domcontentloaded');
    return;
  }

  try {
    await userMenuButton.click({ timeout: TIMEOUTS.CLICK_ACTION });
    const signOutButton = page.getByTestId('sign-out-button');
    await signOutButton.waitFor({ state: 'visible', timeout: TIMEOUTS.BUTTON_VISIBLE });

    // CRITICAL: Attach response listener BEFORE clicking to prevent race condition
    // The logout API must complete before we check UI state
    const logoutPromise = page.waitForResponse(
      (response) => response.url().includes('/api/auth/logout'),
      { timeout: TIMEOUTS.API_RESPONSE }
    );

    await signOutButton.click({ timeout: TIMEOUTS.CLICK_ACTION });

    // Wait for logout API to complete
    await logoutPromise.catch(() => {
      // API might fail but UI logout still works (fallback below handles this)
    });

    // Wait for stable state after API completion
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.NETWORK_IDLE }).catch(() => undefined);

    // CRITICAL: Verify BOTH logout indicators (not just one via Promise.race)
    // This ensures the session is fully cleared before proceeding
    await Promise.all([
      page
        .getByTestId('user-menu-button')
        .first()
        .waitFor({ state: 'hidden', timeout: TIMEOUTS.USER_STATE_CHANGE })
        .catch(() => undefined),
      page
        .getByRole('button', { name: /sign in/i })
        .first()
        .waitFor({ state: 'visible', timeout: TIMEOUTS.BUTTON_VISIBLE })
        .catch(() => undefined),
    ]);
  } catch (error) {
    // Fallback: Hard logout by clearing browser state
    // This ensures tests can continue even if UI logout fails
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    throw new Error(`Logout failed, used fallback: ${error instanceof Error ? error.message : String(error)}`);
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
    { timeout: TIMEOUTS.API_RESPONSE }
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
        await page.waitForSelector(`${selector}:has-text("${message}")`, { timeout: TIMEOUTS.DIALOG_VISIBLE });
      } else {
        const toast = await page.waitForSelector(selector, { timeout: TIMEOUTS.DIALOG_VISIBLE });
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
      await page.waitForSelector(selector, { timeout: 2000 }); // Hardcoded timeout justified: Quick multi-selector check
      return true;
    } catch {
      // Try next selector
    }
  }

  return false;
}

/**
 * Verify which navigation component is rendered on the page
 * Helps debug test failures caused by wrong header component
 *
 * ARCHITECTURE CONTEXT:
 * - TemplateHeader: Used on most pages (/, /products, /price-watch, etc.)
 * - SharedNavigation: Used on specific pages (/alerts, etc.)
 *
 * @returns 'TemplateHeader' | 'SharedNavigation' | 'Unknown'
 */
export async function verifyNavigationComponent(page: Page): Promise<'TemplateHeader' | 'SharedNavigation' | 'Unknown'> {
  // TemplateHeader uses data-testid="user-menu-button" for logged-in users
  // SharedNavigation also uses data-testid="user-menu-button"
  // Both use "My account" button for logged-out users
  // We need to check structural differences to distinguish them

  // Check for TemplateHeader-specific elements
  const hasTemplateHeader = await page
    .locator('header')
    .filter({ hasText: 'PriceCompare' }) // Logo text
    .count()
    .then((count) => count > 0)
    .catch(() => false);

  // Check for SharedNavigation-specific elements
  const hasSharedNav = await page
    .locator('nav[class*="bg-white"][class*="shadow"]') // SharedNavigation uses these classes
    .count()
    .then((count) => count > 0)
    .catch(() => false);

  if (hasTemplateHeader && !hasSharedNav) {
    return 'TemplateHeader';
  } else if (hasSharedNav && !hasTemplateHeader) {
    return 'SharedNavigation';
  } else if (hasTemplateHeader && hasSharedNav) {
    // Both present - this shouldn't happen but log it
    return 'Unknown';
  }

  return 'Unknown';
}

/**
 * Assert that the expected navigation component is present
 * Throws descriptive error if wrong component is rendered
 *
 * @param page - Playwright page object
 * @param expected - Expected navigation component type
 * @throws Error with clear message if wrong component is present
 */
export async function assertNavigationComponent(
  page: Page,
  expected: 'TemplateHeader' | 'SharedNavigation'
): Promise<void> {
  const actual = await verifyNavigationComponent(page);

  if (actual === 'Unknown') {
    throw new Error(
      `Could not identify navigation component on page ${page.url()}. ` +
        `Expected ${expected} but found neither TemplateHeader nor SharedNavigation.`
    );
  }

  if (actual !== expected) {
    throw new Error(
      `Wrong navigation component on page ${page.url()}. ` +
        `Expected ${expected} but found ${actual}. ` +
        `This may indicate the page is using the wrong layout component.`
    );
  }
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

/**
 * Fetch CSRF token from the API
 * Used for direct API requests in E2E tests that bypass the React app's token management
 *
 * @param page - Playwright page object
 * @returns CSRF token string
 * @throws Error if token fetch fails or returns invalid format
 *
 * @example
 * ```typescript
 * const csrfToken = await getCsrfToken(page);
 * await page.request.post('/api/watchlists', {
 *   data: { name: 'Test List' },
 *   headers: { 'X-CSRF-Token': csrfToken },
 * });
 * ```
 */
export async function getCsrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/csrf-token');

  // Validate HTTP response status
  if (!response.ok()) {
    throw new Error(
      `Failed to fetch CSRF token: ${response.status()} ${response.statusText()}. ` +
      `Body: ${await response.text()}`
    );
  }

  // Parse response
  const envelope = await response.json() as { success: boolean; data: { csrfToken: string } };

  // Runtime validation
  if (!envelope.success || !envelope.data?.csrfToken) {
    throw new Error(
      `Invalid CSRF token response format. Expected { success: true, data: { csrfToken: string } }, ` +
      `got: ${JSON.stringify(envelope)}`
    );
  }

  return envelope.data.csrfToken;
}
