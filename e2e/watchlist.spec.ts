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
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import {
  registerUser,
  loginUser,
  logoutUser,
  generateTestUsername,
  generateTestEmail,
} from './helpers';
import { seedTestProduct, seedMultipleProducts } from './helpers/admin-helpers';
import { ensureUserHasWatchlist, bulkAddProductsToWatchlist } from './helpers/watchlist-helpers';
import { db } from '../server/db';
import { users } from '@shared/schema';

test.describe('Watchlist - Product Organization', () => {
  test.describe('Watchlist CRUD Operations', () => {
    test('should create new watchlist', async ({ page }) => {
      await registerUser(
        page,
        generateTestUsername('watchlist'),
        generateTestEmail('watchlist'),
        'WatchlistPass123!'
      );

      // Navigate to watchlists page
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      // Wait for data to load and button to appear (React Query data fetching)
      // Note: Two "Create Watchlist" buttons exist (header + empty state), use .first()
      await page
        .getByRole('button', { name: /create watchlist/i })
        .first()
        .waitFor({ state: 'visible', timeout: 15000 });

      // Click create button (header button)
      await page
        .getByRole('button', { name: /create watchlist/i })
        .first()
        .click();

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

      // Ensure the correct watchlist tab is active (TabsContent for non-active tabs can be hidden)
      const watchlistTab = page.getByRole('tab', { name: /list to delete/i });
      await watchlistTab.waitFor({ state: 'visible', timeout: 15000 });
      await watchlistTab.click();

      // Find watchlist and delete
      const watchlistCard = page
        .locator('[data-testid="watchlist-card"]')
        .filter({ hasText: 'List to Delete' })
        .first();
      await expect(watchlistCard).toBeVisible({ timeout: 15000 });

      await watchlistCard.getByRole('button', { name: /^delete$/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /confirm.*delete/i }).click();

      // Verify deletion (use .first() to avoid duplicate toast + aria-live region)
      await expect(page.getByText(/watchlist deleted/i).first()).toBeVisible();
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

      // Navigate to product page (route is /product/:id, singular)
      await page.goto(`/product/${product.id}`);
      await page.waitForLoadState('networkidle');

      // Add to watchlist
      await page.getByRole('button', { name: /add to watchlist/i }).click();

      // Wait for modal/dropdown
      await page.waitForSelector('[role="dialog"], [role="menu"]', {
        state: 'visible',
        timeout: 5000,
      });

      // Select watchlist (Radix UI Select - click to open, then select option)
      await page.getByLabel(/select watchlist/i).click();

      // Wait for options to be visible before clicking
      const option = page.getByRole('option', { name: 'Holiday Shopping 2025' });
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();

      await page.getByRole('button', { name: /^add$/i }).click();

      // Verify success (use .first() to avoid duplicate toast + aria-live region)
      await expect(page.getByText(/added to watchlist/i).first()).toBeVisible();

      // Wait for dialog to close (indicates API call completed)
      await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });

      // Navigate to watchlist and verify product appears
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      // Click the tab (there's also a card with same name, so use role selector)
      await page.getByRole('tab', { name: /holiday shopping 2025/i }).click();

      // Wait for product to be visible in watchlist
      await page.getByText(product.name).waitFor({ state: 'visible', timeout: 15000 });

      await expect(page.getByText(product.name)).toBeVisible();
    });

    test('should remove product from watchlist', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      // Get the authenticated user's ID (cleanDb ensures only one user exists)
      const [user] = await db.select().from(users).limit(1);

      // Create watchlist and add product via database (fast setup, bypassing UI)
      const { product } = await seedTestProduct();
      const { watchListId } = await ensureUserHasWatchlist(user.id, 'My List');
      await bulkAddProductsToWatchlist(user.id, watchListId, [product.id]);

      // Navigate to watchlist
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      // Click the tab (use role selector to avoid ambiguity with card)
      await page.getByRole('tab', { name: /my list/i }).click();

      // Wait for product to load
      await page.getByText(product.name).waitFor({ state: 'visible', timeout: 15000 });

      // Remove product
      const productCard = page.locator('[data-testid="product-card"]', {
        hasText: product.name,
      });

      await productCard.getByRole('button', { name: /remove/i }).click();

      // Confirm removal
      await page.getByRole('button', { name: /confirm.*remove/i }).click();

      // Verify removal (use .first() to avoid duplicate toast + aria-live region)
      await expect(page.getByText(/deleted successfully/i).first()).toBeVisible();
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

      // Click the tab (use role selector to avoid ambiguity with card)
      await page.getByRole('tab', { name: /list a/i }).click();

      // Wait for product to load
      await page.getByText(product.name).waitFor({ state: 'visible', timeout: 15000 });

      // Select product and move
      await page.locator(`[data-testid="product-checkbox-${product.id}"]`).check();
      await page.getByRole('button', { name: /move to/i }).click();

      // Wait for move dialog
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });

      // Select destination watchlist (Radix UI Select - click to open, then select option)
      await page.getByLabel(/select watchlist/i).click();

      // Wait for options to be visible before clicking
      const moveOption = page.getByRole('option', { name: 'List B' });
      await moveOption.waitFor({ state: 'visible', timeout: 5000 });
      await moveOption.click();

      await page.getByRole('button', { name: /confirm/i }).click();

      // Verify moved (use .first() to avoid duplicate toast + aria-live region)
      await expect(page.getByText(/moved successfully/i).first()).toBeVisible();
      await expect(page.getByText(product.name)).toBeHidden({ timeout: 15000 }); // Removed from List A

      // Check List B
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      // Click the tab (use role selector to avoid ambiguity with card)
      await page.getByRole('tab', { name: /list b/i }).click();

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

      // Click the tab (use role selector to avoid ambiguity with card)
      await page.getByRole('tab', { name: /my list/i }).click();

      // Wait for products to load
      await page.locator('[data-testid="product-card"]').first().waitFor({
        state: 'visible',
        timeout: 15000,
      });

      // Select 3 products (use product-specific checkbox testids)
      const checkboxes = page.locator('[data-testid^="product-checkbox-"]');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();

      // Delete selected
      await page.getByRole('button', { name: /delete selected/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /confirm.*remove/i }).click();

      // Verify deletion (use .first() to avoid duplicate toast + aria-live region)
      await expect(page.getByText(/3 items? deleted/i).first()).toBeVisible();
      await expect(page.locator('[data-testid="product-card"]')).toHaveCount(2); // 2 remaining
    });

    test('should bulk add products to watchlist', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      // Create destination list
      await createWatchlist(page, 'Bulk Add List');

      // Seed products and navigate to shop
      const products = await seedMultipleProducts(3);
      await page.goto('/shop');
      await page.waitForLoadState('networkidle');

      // Select all products using checkboxes on the listing page
      for (const product of products) {
        await page
          .locator(`[data-testid="product-checkbox-${product.id}"]`)
          .waitFor({ state: 'visible', timeout: 15000 });
        await page.locator(`[data-testid="product-checkbox-${product.id}"]`).click();
      }

      // Bulk action
      await page.getByTestId('bulk-add-to-watchlist').click();
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });

      // Select destination list
      await page.getByLabel(/select watchlist/i).click();
      await page.getByRole('option', { name: /bulk add list/i }).click();
      await page.getByRole('button', { name: /^add$/i }).click();

      // Verify all products added in watchlist
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');
      await page.getByRole('tab', { name: /bulk add list/i }).click();
      for (const product of products) {
        await expect(page.getByText(product.name)).toBeVisible({ timeout: 15000 });
      }
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

      // Click the tab (use role selector to avoid ambiguity with card)
      await page.getByRole('tab', { name: /export test/i }).click();

      // Wait for watchlist to load
      await page.locator('[data-testid="product-card"]').first().waitFor({
        state: 'visible',
        timeout: 15000,
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

    test('should import watchlist from CSV', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      const products = await seedMultipleProducts(2);

      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      const csvContent =
        'Product ID,Priority,Target Price,Notes\n' +
        `${products[0].id},5,99.99,High priority\n` +
        `${products[1].id},2,,Second item`;

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: /import watchlist/i }).click(),
      ]);

      await fileChooser.setFiles({
        name: 'Import Test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent, 'utf-8'),
      });

      await expect(page.getByText(/import successful/i).first()).toBeVisible({ timeout: 15000 });

      // New watchlist name derived from filename
      await page
        .getByRole('tab', { name: /import test/i })
        .waitFor({ state: 'visible', timeout: 15000 });
      await page.getByRole('tab', { name: /import test/i }).click();

      await page.getByText(products[0].name).waitFor({ state: 'visible', timeout: 15000 });
      await expect(page.getByText(products[0].name)).toBeVisible();
      await expect(page.getByText(products[1].name)).toBeVisible();
    });
  });

  test.describe('Watchlist Sharing', () => {
    test('should share watchlist with another user (edit permission)', async ({ page }) => {
      const ownerUsername = generateTestUsername('owner');
      const ownerEmail = generateTestEmail('owner');
      const ownerPassword = 'OwnerPass123!';

      const recipientUsername = generateTestUsername('recipient');
      const recipientEmail = generateTestEmail('recipient');
      const recipientPassword = 'Recipient!Pass123';

      await registerUser(page, ownerUsername, ownerEmail, ownerPassword);

      const { product } = await seedTestProduct();
      await createWatchlist(page, 'Shared List');
      await addProductToWatchlist(page, product.id, 'Shared List');

      // Create the recipient account
      await logoutUser(page);
      await registerUser(page, recipientUsername, recipientEmail, recipientPassword);

      // Share from owner -> recipient
      await logoutUser(page);
      await loginUser(page, ownerEmail, ownerPassword);

      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      await page.getByRole('tab', { name: /shared list/i }).click();
      await page.getByRole('button', { name: /^share$/i }).click();
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });

      await page.getByLabel(/^email$/i).fill(recipientEmail);
      await page.getByRole('combobox', { name: /permission/i }).click();
      await page.getByRole('option', { name: /^edit$/i }).click();
      await page.getByRole('button', { name: /^share$/i }).click();

      await expect(page.getByText(/invite sent/i).first()).toBeVisible({ timeout: 10000 });

      // Verify recipient can see and edit shared list
      await logoutUser(page);
      await loginUser(page, recipientEmail, recipientPassword);

      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');

      await page
        .getByRole('tab', { name: /shared list/i })
        .waitFor({ state: 'visible', timeout: 15000 });
      await page.getByRole('tab', { name: /shared list/i }).click();

      await page.getByText(product.name).waitFor({ state: 'visible', timeout: 15000 });
      await expect(page.getByText(product.name)).toBeVisible();

      // Remove should be available for edit permission
      await page.getByRole('button', { name: /^remove$/i }).click();
      await page.getByRole('button', { name: /confirm remove/i }).click();

      await expect(page.getByText(/removed/i).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(product.name)).toBeHidden({ timeout: 15000 });
    });

    test('should make watchlist public', async ({ page }) => {
      await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

      const { product } = await seedTestProduct();
      await createWatchlist(page, 'Public List');
      await addProductToWatchlist(page, product.id, 'Public List');

      // Open watchlists
      await page.goto('/watchlists');
      await page.waitForLoadState('networkidle');
      await page.getByRole('tab', { name: /public list/i }).click();

      // Make public
      await page.getByRole('button', { name: /make public/i }).click();
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 10000 });

      const linkInput = page.getByLabel(/shareable link/i);
      await expect(linkInput).toBeVisible({ timeout: 10000 });
      const url = (await linkInput.inputValue()).trim();
      expect(url).toMatch(/\/watchlists\/public\//i);

      // Close the dialog so it doesn't block the user menu click during logout
      await page.keyboard.press('Escape');
      await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 5000 });

      // Verify accessible unauthenticated
      await logoutUser(page);
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(product.name)).toBeVisible({ timeout: 15000 });
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
  await page
    .getByRole('button', { name: /create watchlist/i })
    .first()
    .click();

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
  // Route is /product/:id (singular), not /products/:id
  await page.goto(`/product/${productId}`);
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /add to watchlist/i }).click();

  // Wait for modal/dropdown
  await page.waitForSelector('[role="dialog"], [role="menu"]', {
    state: 'visible',
    timeout: 5000,
  });

  // Radix UI Select - click to open, then select option
  await page.getByLabel(/select watchlist/i).click();

  // Wait for options to be visible before clicking
  const helperOption = page.getByRole('option', { name: watchlistName });
  await helperOption.waitFor({ state: 'visible', timeout: 5000 });
  await helperOption.click();

  await page.getByRole('button', { name: /^add$/i }).click();

  // Wait for success notification (use .first() to handle duplicate aria-live regions)
  await page
    .getByText(/added to watchlist/i)
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });
}
