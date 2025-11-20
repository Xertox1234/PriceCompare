/**
 * E2E Tests: Product Discovery & Price Tracking
 *
 * Tests product search, details, price history, and watchlist features
 */
import { test, expect } from '@playwright/test';
import {
  cleanDatabase,
  registerUser,
  loginUser,
  waitForApiResponse,
  generateTestEmail,
  generateTestUsername,
} from './helpers';
import { db } from '../server/db';
import { products, productOffers, priceHistory, retailers } from '../shared/schema';

test.describe('Product Discovery & Price Tracking', () => {
  test.beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();

    // Seed test data
    await seedTestData();
  });

  test.describe('Product Search', () => {
    test('should search products by name', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Find search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
      await searchInput.fill('Laptop');

      // Submit search
      await searchInput.press('Enter');

      // Wait for search results
      await waitForApiResponse(page, '/api/products', 200);

      // Should show search results
      await expect(page.locator('text=/laptop/i')).toBeVisible();
      await expect(page.locator('[data-testid="product-card"], .product-card')).toHaveCount(1);
    });

    test('should filter products by category', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Click on Electronics category
      await page.click('text=/electronics/i');

      // Wait for filtered results
      await waitForApiResponse(page, '/api/products', 200);

      // Should show only electronics products
      await expect(page.locator('text=/laptop|phone|tablet/i')).toBeVisible();
    });

    test('should handle empty search results', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
      await searchInput.fill('NonExistentProductXYZ123');
      await searchInput.press('Enter');

      await waitForApiResponse(page, '/api/products', 200);

      // Should show "no results" message
      await expect(
        page.locator('text=/no.*results|no.*products.*found|nothing.*found/i')
      ).toBeVisible();
    });

    test('should paginate product results', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Check for pagination controls (if more than 1 page of products)
      const paginationExists = await page.locator('[data-testid="pagination"], .pagination, button:has-text("Next")').count() > 0;

      if (paginationExists) {
        // Click next page
        await page.click('button:has-text("Next")');
        await waitForApiResponse(page, '/api/products', 200);

        // URL should contain page parameter
        await expect(page).toHaveURL(/.*page=2.*/);
      }
    });
  });

  test.describe('Product Details', () => {
    test('should view product details', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Click on first product
      await page.click('[data-testid="product-card"], .product-card');

      // Wait for product details to load
      await waitForApiResponse(page, /\/api\/products\/\d+/, 200);

      // Should show product details
      await expect(page.locator('h1, [data-testid="product-name"]')).toBeVisible();
      await expect(page.locator('text=/\\$[0-9]+/')).toBeVisible(); // Price
      await expect(page.locator('text=/description/i')).toBeVisible();
    });

    test('should display price history chart', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Click on product
      await page.click('[data-testid="product-card"], .product-card');

      // Wait for price history to load
      await waitForApiResponse(page, /\/api\/products\/\d+\/price-history/, 200);

      // Should show price history chart
      await expect(
        page.locator('[data-testid="price-chart"], .recharts-wrapper, canvas, svg.recharts-surface')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should show price trend indicators', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Click on product with price history
      await page.click('[data-testid="product-card"], .product-card');

      await waitForApiResponse(page, /\/api\/products\/\d+/, 200);

      // Should show price trend (up, down, or stable)
      await expect(
        page.locator('text=/price.*trend|trending|volatility|lowest.*price|highest.*price/i')
      ).toBeVisible();
    });

    test('should display multiple retailer offers', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Click on product
      await page.click('[data-testid="product-card"], .product-card');

      await waitForApiResponse(page, /\/api\/products\/\d+/, 200);

      // Should show offers from different retailers
      await expect(
        page.locator('[data-testid="offer-card"], .offer-card, .retailer-offer')
      ).toHaveCount(2); // Our test data has 2 offers
    });

    test('should navigate to retailer website', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Click on product
      await page.click('[data-testid="product-card"], .product-card');
      await waitForApiResponse(page, /\/api\/products\/\d+/, 200);

      // Click "View on [Retailer]" or "Buy Now" button
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        page.click('a:has-text("View"), a:has-text("Buy"), button:has-text("Visit")').catch(() => {
          // If no external link, check for affiliate redirect
          return page.click('[data-testid="buy-button"], .buy-button');
        }),
      ]);

      // Should open retailer page in new tab
      await newPage.waitForLoadState('domcontentloaded');
      expect(newPage.url()).toContain('http');

      await newPage.close();
    });
  });

  test.describe('Price History', () => {
    test('should view 30-day price history', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="product-card"], .product-card');
      await waitForApiResponse(page, /\/api\/products\/\d+\/price-history/, 200);

      // Select 30-day view
      await page.click('button:has-text("30 days"), [data-value="30d"]').catch(() => {
        // Default might already be 30 days
      });

      // Should show chart with data
      await expect(
        page.locator('[data-testid="price-chart"], .recharts-wrapper')
      ).toBeVisible();
    });

    test('should view 90-day price history', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="product-card"], .product-card');
      await waitForApiResponse(page, /\/api\/products\/\d+\/price-history/, 200);

      // Select 90-day view
      await page.click('button:has-text("90 days"), [data-value="90d"]');
      await waitForApiResponse(page, /\/api\/products\/\d+\/price-history/, 200);

      // Should show updated chart
      await expect(
        page.locator('[data-testid="price-chart"], .recharts-wrapper')
      ).toBeVisible();
    });

    test('should display lowest and highest prices', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="product-card"], .product-card');
      await waitForApiResponse(page, /\/api\/products\/\d+/, 200);

      // Should show price statistics
      await expect(page.locator('text=/lowest.*price/i')).toBeVisible();
      await expect(page.locator('text=/highest.*price/i')).toBeVisible();
    });
  });

  test.describe('Watchlist', () => {
    test('should add product to watchlist', async ({ page }) => {
      const username = generateTestUsername('watchlist');
      const email = generateTestEmail('watchlist');
      const password = 'SecurePass123!';

      // Register and login
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Go to product page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="product-card"], .product-card');

      // Add to watchlist
      await page.click('button:has-text("Watch"), button:has-text("Add to Watchlist"), [data-testid="add-to-watchlist"]');

      // Wait for API call
      await waitForApiResponse(page, /\/api\/watch/, 201);

      // Should show success feedback
      await expect(
        page.locator('text=/added.*watchlist|watching/i')
      ).toBeVisible();
    });

    test('should remove product from watchlist', async ({ page }) => {
      const username = generateTestUsername('unwatchlist');
      const email = generateTestEmail('unwatchlist');
      const password = 'SecurePass123!';

      // Register and login
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Go to product page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="product-card"], .product-card');

      // Add to watchlist
      await page.click('button:has-text("Watch"), button:has-text("Add to Watchlist")');
      await waitForApiResponse(page, /\/api\/watch/, 201);

      // Remove from watchlist
      await page.click('button:has-text("Unwatch"), button:has-text("Remove"), [data-testid="remove-from-watchlist"]');
      await waitForApiResponse(page, /\/api\/watch/, 200);

      // Should show removed feedback
      await expect(
        page.locator('text=/removed.*watchlist|no longer.*watching/i')
      ).toBeVisible();
    });

    test('should require authentication to add to watchlist', async ({ page }) => {
      // Go to product page without logging in
      await page.goto('/products');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="product-card"], .product-card');

      // Try to add to watchlist
      await page.click('button:has-text("Watch"), button:has-text("Add to Watchlist")');

      // Should redirect to login or show login prompt
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      const hasLoginModal = await page.locator('text=/log in|sign in/i').isVisible();

      expect(currentUrl.includes('/login') || hasLoginModal).toBe(true);
    });
  });

  test.describe('Price Comparison', () => {
    test('should compare prices across retailers', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="product-card"], .product-card');
      await waitForApiResponse(page, /\/api\/products\/\d+/, 200);

      // Should show multiple offers
      const offerCount = await page.locator('[data-testid="offer-card"], .offer-card, .retailer-offer').count();
      expect(offerCount).toBeGreaterThan(0);

      // Should show price differences
      await expect(page.locator('text=/\\$[0-9]+/')).toHaveCount(offerCount);
    });

    test('should highlight best price', async ({ page }) => {
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      await page.click('[data-testid="product-card"], .product-card');
      await waitForApiResponse(page, /\/api\/products\/\d+/, 200);

      // Should indicate best/lowest price
      await expect(
        page.locator('text=/best.*price|lowest.*price|best.*deal/i')
      ).toBeVisible();
    });
  });
});

/**
 * Seed test data for product discovery tests
 */
async function seedTestData() {
  // Create test retailer
  const [retailer1] = await db.insert(retailers).values({
    name: 'Test Electronics Store',
    domain: 'test-electronics.example.com',
    logoUrl: 'https://via.placeholder.com/150',
  }).returning();

  const [retailer2] = await db.insert(retailers).values({
    name: 'Budget Tech Shop',
    domain: 'budget-tech.example.com',
    logoUrl: 'https://via.placeholder.com/150',
  }).returning();

  // Create test product
  const [product] = await db.insert(products).values({
    name: 'Test Gaming Laptop',
    description: 'High-performance gaming laptop with RTX graphics',
    imageUrl: 'https://via.placeholder.com/400',
    categoryId: 1,
  }).returning();

  // Create offers for the product
  await db.insert(productOffers).values([
    {
      productId: product.id,
      retailerId: retailer1.id,
      price: '1299.99',
      currency: 'USD',
      url: 'https://test-electronics.example.com/laptop',
      inStock: true,
    },
    {
      productId: product.id,
      retailerId: retailer2.id,
      price: '1249.99',
      currency: 'USD',
      url: 'https://budget-tech.example.com/laptop',
      inStock: true,
    },
  ]);

  // Create price history
  const now = new Date();
  const priceHistoryData = [];

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    priceHistoryData.push({
      productId: product.id,
      retailerId: retailer1.id,
      price: (1299.99 - Math.random() * 100).toFixed(2),
      recordedAt: date,
    });
  }

  await db.insert(priceHistory).values(priceHistoryData);
}
