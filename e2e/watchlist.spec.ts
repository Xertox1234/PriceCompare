/**
 * E2E Tests: Watchlist Management
 *
 * Tests product watchlist organization, CRUD operations, bulk actions,
 * and import/export functionality.
 *
 * Test Coverage:
 * - Watchlist creation and deletion
 * - Adding/removing products from watchlists
 * - Moving products between watchlists
 * - Bulk delete operations
 * - Watchlist export (CSV)
 * - Watchlist import (CSV)
 *
 * Phase 1.1 Patterns Applied (see docs/08_TESTING_PATTERNS.md):
 * ----------------------------------------------------------------
 * 1. Modal-Based Authentication
 *    - Auth happens via modals, not dedicated routes
 *    - Use registerUser()/loginUser() helpers from e2e/helpers.ts
 *    - Wait for data-testid="user-menu-button" to confirm auth state
 *
 * 2. Explicit Waits for Dynamic Content
 *    - Always wait for dialogs/modals: waitForSelector('[role="dialog"]')
 *    - Wait for toasts to confirm mutations: getByText(/created/i).waitFor()
 *    - Use .first() when multiple matches exist (toast + aria-live region)
 *
 * 3. Semantic, Label-Based Selectors
 *    - Prefer: getByRole('button', { name: /create list/i })
 *    - Prefer: getByLabel(/^name/i) for form fields
 *    - Avoid: CSS selectors, data-testid (except for helpers)
 *
 * 4. Test Helper Consistency
 *    - Shared helpers in e2e/helpers.ts (auth, database)
 *    - Feature helpers in e2e/helpers/ (admin, product seeding)
 *    - Local helpers at bottom of spec file (createWatchlist, etc.)
 *
 * 5. User-Observable Behavior Testing
 *    - Test what users see (toasts, tabs, buttons)
 *    - Avoid implementation details (counts, internal state)
 *    - Focus on critical user journeys
 */
import { test, expect, type Page } from '@playwright/test';
import {
  cleanDatabase,
  registerUser,
  loginUser as _loginUser,
  logoutUser as _logoutUser,
  generateTestUsername,
  generateTestEmail,
} from './helpers';
import { seedTestProduct, seedMultipleProducts } from './helpers/admin-helpers';

test.describe('Watchlist - Product Organization', () => {
  test.beforeEach(async () => {
    // Clean database before each test for isolation
    await cleanDatabase();
  });

  test.describe('Watchlist CRUD Operations', () => {
    test('should create new watchlist', async ({ page }) => {
      await registerUser(page, generateTestUsername('watchlist'), generateTestEmail('watchlist'), 'WatchlistPass123!');

      // Navigate to watchlists page
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      // Wait for data to load and button to appear (React Query data fetching)
      // Note: Two "Create Watchlist" buttons exist (header + empty state), use .first()
      await page.getByRole('button', { name: /create watchlist/i }).first().waitFor({ state: 'visible', timeout: 15000 });

      // Click create button (header button)
      await page.getByRole('button', { name: /create watchlist/i }).first().click();

      // Wait for modal/form to be visible
      await page.waitForSelector('[role="dialog"], form', { state: 'visible', timeout: 5000 });

      // Fill form
      await page.getByLabel(/^name/i).fill('Holiday Shopping 2025');
      await page.getByRole('button', { name: /create list/i }).click();

      // Verify success
      await expect(page.getByText(/watch list created/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('tab', { name: /holiday shopping 2025/i })).toBeVisible();
    });

    test('should delete watchlist', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      // Create watchlist first
      await createWatchlist(page, 'List to Delete');

      // Navigate to watchlists page
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      // Find watchlist and delete
      const watchlistCard = page.locator('[data-testid="watchlist-card"]', {
        hasText: 'List to Delete',
      });

      await watchlistCard.getByRole('button', { name: /delete/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /confirm.*delete/i }).click();

      // Verify deletion
      await expect(page.getByText(/watchlist deleted/i)).toBeVisible();
      await expect(watchlistCard).not.toBeVisible();
    });
  });

  test.describe('Product Management in Watchlists', () => {
    test('should add product to watchlist', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      // Create watchlist first
      await createWatchlist(page, 'Holiday Shopping 2025');

      // Create test product
      const { product } = await seedTestProduct();

      // Navigate to product page
      await page.goto(`/products/${product.id}`);
      await page.waitForLoadState('networkidle');

      // Add to watchlist
      await page.getByRole('button', { name: /add to watchlist/i }).click();

      // Wait for modal/dropdown
      await page.waitForSelector('[role="dialog"], [role="menu"]', {
        state: 'visible',
        timeout: 5000,
      });

      // Select watchlist
      await page.getByLabel(/select watchlist/i).selectOption('Holiday Shopping 2025');
      await page.getByRole('button', { name: /^add$/i }).click();

      // Verify success
      await expect(page.getByText(/added to watchlist/i)).toBeVisible();

      // Navigate to watchlist and verify product appears
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      await page.getByText(/holiday shopping 2025/i).click();

      // Wait for product to be visible in watchlist
      await page.getByText(product.name).waitFor({ state: 'visible', timeout: 5000 });

      await expect(page.getByText(product.name)).toBeVisible();
    });

    test('should remove product from watchlist', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      // Create watchlist and add product
      await createWatchlist(page, 'My List');
      const { product } = await seedTestProduct();
      await addProductToWatchlist(page, product.id, 'My List');

      // Navigate to watchlist
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      await page.getByText(/my list/i).click();

      // Wait for product to load
      await page.getByText(product.name).waitFor({ state: 'visible', timeout: 5000 });

      // Remove product
      const productCard = page.locator('[data-testid="product-card"]', {
        hasText: product.name,
      });

      await productCard.getByRole('button', { name: /remove/i }).click();

      // Confirm removal
      await page.getByRole('button', { name: /confirm.*remove/i }).click();

      // Verify removal
      await expect(page.getByText(/removed from watchlist/i)).toBeVisible();
      await expect(productCard).not.toBeVisible();
    });

    test('should move product between watchlists', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      // Create two watchlists
      await createWatchlist(page, 'List A');
      await createWatchlist(page, 'List B');

      // Add product to List A
      const { product } = await seedTestProduct();
      await addProductToWatchlist(page, product.id, 'List A');

      // Open List A
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      await page.getByText(/list a/i).click();

      // Wait for product to load
      await page.getByText(product.name).waitFor({ state: 'visible', timeout: 5000 });

      // Select product and move
      await page.locator(`[data-testid="product-checkbox-${product.id}"]`).check();
      await page.getByRole('button', { name: /move to/i }).click();

      // Wait for move dialog
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });

      // Select destination watchlist
      await page.getByLabel(/select watchlist/i).selectOption('List B');
      await page.getByRole('button', { name: /confirm/i }).click();

      // Verify moved
      await expect(page.getByText(/product moved/i)).toBeVisible();
      await expect(page.getByText(product.name)).not.toBeVisible(); // Removed from List A

      // Check List B
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      await page.getByText(/list b/i).click();

      // Wait for product in List B
      await page.getByText(product.name).waitFor({ state: 'visible', timeout: 5000 });

      await expect(page.getByText(product.name)).toBeVisible(); // Now in List B
    });
  });

  test.describe('Bulk Operations', () => {
    test('should bulk delete from watchlist', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      // Create watchlist with 5 products
      await createWatchlist(page, 'My List');
      const products = await seedMultipleProducts(5);

      for (const product of products) {
        await addProductToWatchlist(page, product.id, 'My List');
      }

      // Navigate to watchlist
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      await page.getByText(/my list/i).click();

      // Wait for products to load
      await page.locator('[data-testid="product-card"]').first().waitFor({
        state: 'visible',
        timeout: 5000,
      });

      // Select 3 products
      const checkboxes = page.locator('[data-testid="product-checkbox"]');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();

      // Delete selected
      await page.getByRole('button', { name: /delete selected/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /confirm.*delete/i }).click();

      // Verify deletion
      await expect(page.getByText(/3 items? deleted/i)).toBeVisible();
      await expect(page.locator('[data-testid="product-card"]')).toHaveCount(2); // 2 remaining
    });

    test.skip('should bulk add products to watchlist - UI not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when bulk add UI is built
      // Expected flow:
      // 1. Navigate to search results or category page
      // 2. Select multiple products using checkboxes
      // 3. Click "Add to Watchlist" bulk action
      // 4. Select destination watchlist
      // 5. Verify all products added
    });
  });

  test.describe('Import/Export', () => {
    test('should export watchlist to CSV', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      // Create watchlist with products
      await createWatchlist(page, 'Export Test');
      const products = await seedMultipleProducts(3);

      for (const product of products) {
        await addProductToWatchlist(page, product.id, 'Export Test');
      }

      // Navigate to watchlist
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      await page.getByText(/export test/i).click();

      // Wait for watchlist to load
      await page.locator('[data-testid="product-card"]').first().waitFor({
        state: 'visible',
        timeout: 5000,
      });

      // Export
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /export/i }).click();

      // If there's a dropdown menu, select CSV
      const csvOption = page.getByRole('menuitem', { name: /csv/i });
      if (await csvOption.isVisible().catch(() => false)) {
        await csvOption.click();
      }

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/export-test.*\.csv/i);
    });

    test.skip('should import watchlist from CSV - UI not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when watchlist import UI is built
      // Expected flow:
      // 1. Click "Import Watchlist" button
      // 2. Upload valid CSV file
      // 3. See import progress indicator
      // 4. Verify all products added to new watchlist
      // 5. See success notification with import count
    });
  });

  test.describe('Watchlist Sharing', () => {
    test.skip('should share watchlist with another user - feature not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when sharing feature is added
      // Expected flow:
      // 1. Open watchlist settings
      // 2. Click "Share" button
      // 3. Enter email of user to share with
      // 4. Select permission level (view/edit)
      // 5. Send invitation
      // 6. Verify shared user receives notification
    });

    test.skip('should make watchlist public - feature not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when public sharing is added
      // Expected flow:
      // 1. Open watchlist settings
      // 2. Toggle "Make Public" switch
      // 3. Generate shareable link
      // 4. Verify watchlist accessible via link (unauthenticated)
    });
  });
});

// Helper functions

/**
 * Create a new watchlist via UI
 */
async function createWatchlist(page: Page, name: string) {
  await page.goto('/watchlists');
  await page.waitForLoadState('networkidle');

  // Click header button (two buttons exist: header + empty state)
  await page.getByRole('button', { name: /create watchlist/i }).first().click();

  // Wait for modal/form
  await page.waitForSelector('[role="dialog"], form', { state: 'visible', timeout: 5000 });

  await page.getByLabel(/^name/i).fill(name);
  await page.getByRole('button', { name: /create list/i }).click();

  // Wait for success notification
  await page
    .getByText(/watch list created/i)
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Add a product to a watchlist via UI
 */
async function addProductToWatchlist(page: Page, productId: number, watchlistName: string) {
  await page.goto(`/products/${productId}`);
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /add to watchlist/i }).click();

  // Wait for modal/dropdown
  await page.waitForSelector('[role="dialog"], [role="menu"]', {
    state: 'visible',
    timeout: 5000,
  });

  await page.getByLabel(/select watchlist/i).selectOption(watchlistName);
  await page.getByRole('button', { name: /^add$/i }).click();

  // Wait for success notification
  await page.getByText(/added to watchlist/i).waitFor({ state: 'visible', timeout: 5000 });
}
