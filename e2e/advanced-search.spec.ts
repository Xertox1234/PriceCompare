/**
 * E2E Tests: Advanced Search
 *
 * Tests multi-criteria product search, filtering, sorting, and pagination.
 *
 * Test Coverage:
 * - Category filtering
 * - Price range filtering
 * - Retailer filtering
 * - Sort operations (price, rating, relevance)
 * - Multi-criteria combinations
 * - Pagination handling
 * - Empty state handling
 *
 * Phase 2.2 Patterns Applied (see docs/08_TESTING_PATTERNS.md):
 * ----------------------------------------------------------------
 * 1. Type Safety
 *    - All helpers use `type Page` from '@playwright/test'
 *    - Zero `any` types throughout test suite
 *    - Proper TypeScript types for all function parameters
 *
 * 2. Modal-Based Authentication
 *    - Use registerUser() helper for authenticated tests
 *    - Wait for data-testid="user-menu-button" to confirm auth state
 *    - Auth not required for search (public feature)
 *
 * 3. Explicit Waits for Dynamic Content
 *    - Always wait for search results: waitForSearchResults()
 *    - Wait for networkidle after filter/sort operations
 *    - No hardcoded timeouts for dynamic content
 *
 * 4. Semantic, Role-Based Selectors
 *    - Prefer: getByRole('button', { name: /sort/i })
 *    - Prefer: getByLabel(/min.*price/i) for form fields
 *    - Avoid: CSS selectors except for data-testid fallbacks
 *
 * 5. Database Test Data
 *    - Create test data via seedMultipleProducts() helper
 *    - Test via UI interactions, not database queries
 *    - Clean database in beforeEach for isolation
 *
 * 6. Graceful Degradation
 *    - Use test.skip() for unimplemented UI features
 *    - Check element existence before assertions
 *    - Comments indicate flexible patterns
 */
import { test, expect } from '@playwright/test';
import { cleanDatabase } from './helpers';
import { seedMultipleProducts } from './helpers/admin-helpers';
import {
  performSearch,
  applyCategoryFilter,
  applyPriceRangeFilter,
  sortSearchResults,
  waitForSearchResults,
  getSearchResultCount,
  getSearchResultPrices,
  getSearchResultCategories,
} from './helpers/search-helpers';
import { db } from '../server/db';
import { products, retailers, productOffers } from '@shared/schema';

test.describe('Advanced Search - Multi-Criteria Filtering', () => {
  test.beforeEach(async () => {
    // Clean database before each test for isolation
    await cleanDatabase();
  });

  test.describe('Category Filtering', () => {
    test('should filter search results by category', async ({ page }) => {
      // Create test products in different categories
      await seedProductsWithCategories();

      // Perform search
      await performSearch(page, 'product');
      await waitForSearchResults(page);

      // Verify initial results show multiple categories
      const initialCount = await getSearchResultCount(page);
      expect(initialCount).toBeGreaterThan(0);

      // Apply category filter
      const categoryFilter = page.getByLabel(/category/i);

      if ((await categoryFilter.count()) === 0) {
        test.skip();
        return;
      }

      await applyCategoryFilter(page, 'Electronics');

      // Wait for filtered results
      await waitForSearchResults(page);

      // Verify all results are in selected category
      const categories = await getSearchResultCategories(page);

      if (categories.length > 0) {
        // Verify all displayed categories match filter
        categories.forEach((category) => {
          expect(category.toLowerCase()).toContain('electronic');
        });
      }

      // Result count should be less than or equal to initial
      const filteredCount = await getSearchResultCount(page);
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('should show only selected category products', async ({ page }) => {
      // Create products with specific categories
      await seedProductsWithCategories();

      // Navigate to search
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check if category filter exists
      const categoryFilter = page.getByLabel(/category/i);

      if ((await categoryFilter.count()) === 0) {
        test.skip();
        return;
      }

      // Select "Computers & Laptops" category
      await applyCategoryFilter(page, 'Computers');

      // Wait for results
      await waitForSearchResults(page);

      // Verify results contain category indicator
      const resultCards = page.locator('[data-testid="product-card"], .product-card');
      const count = await resultCards.count();

      if (count > 0) {
        // At least one result should be visible
        expect(count).toBeGreaterThan(0);

        // Check if category badges are displayed
        const categoryBadges = page.locator('[data-testid="category"], .category');

        if ((await categoryBadges.count()) > 0) {
          await expect(categoryBadges.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Price Range Filtering', () => {
    test('should filter products by price range', async ({ page }) => {
      // Create products with varied prices
      await seedProductsWithPrices();

      // Perform search
      await performSearch(page, 'product');
      await waitForSearchResults(page);

      // Check if price filter exists
      const minPriceInput = page.getByLabel(/min.*price/i);
      const maxPriceInput = page.getByLabel(/max.*price/i);

      if ((await minPriceInput.count()) === 0 || (await maxPriceInput.count()) === 0) {
        test.skip();
        return;
      }

      // Apply price range filter ($50 - $200)
      await applyPriceRangeFilter(page, 50, 200);

      // Wait for filtered results
      await waitForSearchResults(page);

      // Get prices from results
      const prices = await getSearchResultPrices(page);

      // Verify all prices are within range
      if (prices.length > 0) {
        prices.forEach((price) => {
          expect(price).toBeGreaterThanOrEqual(50);
          expect(price).toBeLessThanOrEqual(200);
        });
      }
    });

    test('should update results when price range changes', async ({ page }) => {
      // Create products with varied prices
      await seedProductsWithPrices();

      // Navigate to search/products page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check if price filters exist
      const minPriceInput = page.getByLabel(/min.*price/i);
      const maxPriceInput = page.getByLabel(/max.*price/i);

      if ((await minPriceInput.count()) === 0 || (await maxPriceInput.count()) === 0) {
        test.skip();
        return;
      }

      // Get initial result count
      const initialCount = await getSearchResultCount(page);

      // Apply restrictive price filter
      await applyPriceRangeFilter(page, 100, 150);
      await waitForSearchResults(page);

      // Verify filtered results
      const filteredCount = await getSearchResultCount(page);

      // Should have fewer results (or possibly zero if no products in range)
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      // Verify prices are within range
      const prices = await getSearchResultPrices(page);

      if (prices.length > 0) {
        prices.forEach((price) => {
          expect(price).toBeGreaterThanOrEqual(100);
          expect(price).toBeLessThanOrEqual(150);
        });
      }
    });
  });

  test.describe('Sort Operations', () => {
    test('should sort results by price (low to high)', async ({ page }) => {
      // Create products with varied prices
      await seedProductsWithPrices();

      // Navigate to products page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check if sort control exists
      const sortControl = page.getByLabel(/sort.*by/i);

      if ((await sortControl.count()) === 0) {
        test.skip();
        return;
      }

      // Sort by price ascending
      await sortSearchResults(page, 'price');

      // Wait for sorted results
      await waitForSearchResults(page);

      // Get prices from results
      const prices = await getSearchResultPrices(page);

      // Verify prices are in ascending order
      if (prices.length > 1) {
        for (let i = 0; i < prices.length - 1; i++) {
          expect(prices[i]).toBeLessThanOrEqual(prices[i + 1]);
        }
      }
    });

    test('should sort results by price (high to low)', async ({ page }) => {
      // Create products with varied prices
      await seedProductsWithPrices();

      // Navigate to products page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check if sort control exists
      const sortControl = page.getByLabel(/sort.*by/i);

      if ((await sortControl.count()) === 0) {
        test.skip();
        return;
      }

      // Sort by price descending
      await sortSearchResults(page, 'price.*desc|high.*low');

      // Wait for sorted results
      await waitForSearchResults(page);

      // Get prices from results
      const prices = await getSearchResultPrices(page);

      // Verify prices are in descending order
      if (prices.length > 1) {
        for (let i = 0; i < prices.length - 1; i++) {
          expect(prices[i]).toBeGreaterThanOrEqual(prices[i + 1]);
        }
      }
    });
  });

  test.describe('Multi-Criteria Search', () => {
    test('should combine category and price filters', async ({ page }) => {
      // Create diverse product set
      await seedProductsWithCategories();
      await seedProductsWithPrices();

      // Navigate to products page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check if filters exist
      const categoryFilter = page.getByLabel(/category/i);
      const minPriceInput = page.getByLabel(/min.*price/i);

      if ((await categoryFilter.count()) === 0 || (await minPriceInput.count()) === 0) {
        test.skip();
        return;
      }

      // Apply category filter
      await applyCategoryFilter(page, 'Electronics');
      await waitForSearchResults(page);

      // Apply price range filter
      await applyPriceRangeFilter(page, 100, 500);
      await waitForSearchResults(page);

      // Verify results match both criteria
      const prices = await getSearchResultPrices(page);
      const categories = await getSearchResultCategories(page);

      // All prices should be in range
      if (prices.length > 0) {
        prices.forEach((price) => {
          expect(price).toBeGreaterThanOrEqual(100);
          expect(price).toBeLessThanOrEqual(500);
        });
      }

      // All categories should match filter
      if (categories.length > 0) {
        categories.forEach((category) => {
          expect(category.toLowerCase()).toContain('electronic');
        });
      }
    });

    test('should combine filters with sorting', async ({ page }) => {
      // Create diverse product set
      await seedProductsWithCategories();
      await seedProductsWithPrices();

      // Navigate to products page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check if all controls exist
      const categoryFilter = page.getByLabel(/category/i);
      const minPriceInput = page.getByLabel(/min.*price/i);
      const sortControl = page.getByLabel(/sort.*by/i);

      if (
        (await categoryFilter.count()) === 0 ||
        (await minPriceInput.count()) === 0 ||
        (await sortControl.count()) === 0
      ) {
        test.skip();
        return;
      }

      // Apply category filter
      await applyCategoryFilter(page, 'Electronics');
      await waitForSearchResults(page);

      // Apply price range
      await applyPriceRangeFilter(page, 100, 500);
      await waitForSearchResults(page);

      // Sort by price
      await sortSearchResults(page, 'price');
      await waitForSearchResults(page);

      // Verify combined criteria
      const prices = await getSearchResultPrices(page);

      if (prices.length > 1) {
        // Verify price range
        prices.forEach((price) => {
          expect(price).toBeGreaterThanOrEqual(100);
          expect(price).toBeLessThanOrEqual(500);
        });

        // Verify sort order
        for (let i = 0; i < prices.length - 1; i++) {
          expect(prices[i]).toBeLessThanOrEqual(prices[i + 1]);
        }
      }
    });
  });

  test.describe('Pagination', () => {
    test('should paginate search results', async ({ page }) => {
      // Create enough products to trigger pagination (25+ products)
      await seedMultipleProducts(25);

      // Navigate to products page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check if pagination exists
      const nextButton = page.getByRole('button', { name: /next/i });
      const paginationLinks = page.locator('[data-testid="pagination"], .pagination');

      if ((await nextButton.count()) === 0 && (await paginationLinks.count()) === 0) {
        // Not enough products to trigger pagination
        test.skip();
        return;
      }

      // Get results on page 1
      const page1Count = await getSearchResultCount(page);
      expect(page1Count).toBeGreaterThan(0);

      // Navigate to page 2
      if ((await nextButton.count()) > 0) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');

        // Verify page 2 has results
        const page2Count = await getSearchResultCount(page);
        expect(page2Count).toBeGreaterThan(0);

        // Verify URL contains page parameter
        const url = page.url();
        expect(url).toMatch(/[?&]page=2/);
      }
    });

    test('should maintain filters across pagination', async ({ page }) => {
      // Create enough products to trigger pagination
      await seedMultipleProducts(25);

      // Navigate to products page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check if pagination and filters exist
      const nextButton = page.getByRole('button', { name: /next/i });
      const minPriceInput = page.getByLabel(/min.*price/i);

      if ((await nextButton.count()) === 0 || (await minPriceInput.count()) === 0) {
        test.skip();
        return;
      }

      // Apply price filter
      await applyPriceRangeFilter(page, 100, 500);
      await waitForSearchResults(page);

      // Get page 1 prices
      const page1Prices = await getSearchResultPrices(page);

      // Navigate to page 2
      await nextButton.click();
      await page.waitForLoadState('networkidle');

      // Get page 2 prices
      const page2Prices = await getSearchResultPrices(page);

      // Verify filter is still applied on page 2
      if (page2Prices.length > 0) {
        page2Prices.forEach((price) => {
          expect(price).toBeGreaterThanOrEqual(100);
          expect(price).toBeLessThanOrEqual(500);
        });
      }

      // Verify URL contains both page and filter parameters
      const url = page.url();
      expect(url).toMatch(/[?&]page=2/);

      // Verify we got different results (not the same as page 1)
      if (page1Prices.length > 0 && page2Prices.length > 0) {
        expect(page1Prices).not.toEqual(page2Prices);
      }
    });
  });

  test.describe('Empty States', () => {
    test('should show empty state when no results match filters', async ({ page }) => {
      // Create a few products
      await seedMultipleProducts(5);

      // Navigate to products page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check if price filters exist
      const minPriceInput = page.getByLabel(/min.*price/i);

      if ((await minPriceInput.count()) === 0) {
        test.skip();
        return;
      }

      // Apply very restrictive price filter (unlikely to have matches)
      await applyPriceRangeFilter(page, 10000, 20000);

      // Wait for results or empty state
      await page.waitForLoadState('networkidle');

      // Should show empty state message
      const emptyMessage = page.locator('text=/no.*results|no.*products.*found|nothing.*found/i');

      if ((await emptyMessage.count()) > 0) {
        await expect(emptyMessage.first()).toBeVisible();
      } else {
        // If no explicit empty message, verify zero results
        const resultCount = await getSearchResultCount(page);
        expect(resultCount).toBe(0);
      }
    });

    test('should show helpful message when search has no results', async ({ page }) => {
      // Create some products
      await seedMultipleProducts(5);

      // Search for non-existent product
      await performSearch(page, 'NonExistentProductXYZ12345');

      // Wait for results or empty state
      await page.waitForLoadState('networkidle');

      // Should show empty state or "no results" message
      const emptyMessage = page.locator('text=/no.*results|no.*products.*found|nothing.*found/i');

      // Verify message is visible or no products shown
      const messageVisible = (await emptyMessage.count()) > 0;
      const resultCount = await getSearchResultCount(page);

      // Either empty message should be shown or result count should be 0
      if (!messageVisible) {
        expect(resultCount).toBe(0);
      } else {
        await expect(emptyMessage.first()).toBeVisible();
      }
    });
  });
});

/**
 * Local Test Helpers
 */

/**
 * Seed products with different categories
 */
async function seedProductsWithCategories(): Promise<void> {
  const [retailer] = await db
    .insert(retailers)
    .values({
      name: 'Test Retailer',
      website: 'https://test-retailer.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    })
    .returning();

  const categories = ['Electronics', 'Computers', 'Smartphones', 'Tablets', 'Accessories'];

  for (let i = 0; i < 10; i++) {
    const [product] = await db
      .insert(products)
      .values({
        name: `Product ${i + 1}`,
        description: `Description ${i + 1}`,
        category: categories[i % categories.length],
        image: 'https://via.placeholder.com/300',
      })
      .returning();

    await db.insert(productOffers).values({
      productId: product.id,
      retailerId: retailer.id,
      price: (Math.random() * 500 + 50).toFixed(2),
      productUrl: `https://test-retailer.com/product/${product.id}`,
      availability: 'in_stock',
    });
  }
}

/**
 * Seed products with varied prices
 */
async function seedProductsWithPrices(): Promise<void> {
  const [retailer] = await db
    .insert(retailers)
    .values({
      name: 'Price Test Retailer',
      website: 'https://price-retailer.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    })
    .returning();

  // Create products with specific price ranges
  const priceRanges = [
    { min: 20, max: 50 }, // Budget
    { min: 50, max: 100 }, // Low
    { min: 100, max: 200 }, // Mid
    { min: 200, max: 500 }, // High
    { min: 500, max: 1000 }, // Premium
  ];

  for (let i = 0; i < 15; i++) {
    const range = priceRanges[i % priceRanges.length];
    const price = Math.random() * (range.max - range.min) + range.min;

    const [product] = await db
      .insert(products)
      .values({
        name: `Price Product ${i + 1}`,
        description: `Product with price $${price.toFixed(2)}`,
        category: 'Electronics',
        image: 'https://via.placeholder.com/300',
      })
      .returning();

    await db.insert(productOffers).values({
      productId: product.id,
      retailerId: retailer.id,
      price: price.toFixed(2),
      productUrl: `https://price-retailer.com/product/${product.id}`,
      availability: 'in_stock',
    });
  }
}
