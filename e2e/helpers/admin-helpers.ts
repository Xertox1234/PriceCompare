/**
 * E2E Test Helpers: Admin Features
 *
 * Utilities for testing admin-specific functionality
 */
import { type Page } from '@playwright/test';
import { db } from '../../server/db';
import { products, retailers, productOffers, priceHistory } from '@shared/schema';
import type { Product, Retailer } from '@shared/schema';
import { deterministicPriceString } from './deterministic';

/**
 * Creates an admin user by registering the first user in a clean database.
 * The first user automatically receives admin role.
 *
 * @param page - Playwright page instance
 * @param options - Optional override for admin credentials
 * @returns Admin user credentials
 */
export async function createAdminUser(
  page: Page,
  options?: {
    username?: string;
    email?: string;
    password?: string;
  }
): Promise<{ username: string; email: string; password: string }> {
  const username = options?.username ?? 'admin';
  const email = options?.email ?? 'admin@pricecompare.com';
  const password = options?.password ?? 'AdminPass123!';

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

  // Wait for modal to open with accessible label
  await page.waitForSelector('input#username', { state: 'visible', timeout: 5000 });

  // Fill registration form using getByLabel() for resilience
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/email/i).fill(email);
  await page
    .getByLabel(/^password$/i)
    .first()
    .fill(password);
  await page.getByLabel(/confirm.*password/i).fill(password);

  // Submit form (button text is "Create Account")
  await page.getByRole('button', { name: /create account/i }).click();

  // CRITICAL: Wait for user to be logged in (modal closes and user menu appears)
  // Registration API returns 201 but React needs time to update auth state
  // Use .first() because multiple navigation instances exist (desktop, mobile, etc.)
  await page.getByTestId('user-menu-button').first().waitFor({ state: 'visible', timeout: 10000 });

  return { username, email, password };
}

/**
 * Seeds a test product with retailer and optional offers.
 *
 * @param overrides - Optional field overrides for product
 * @returns Created product and retailer
 */
export async function seedTestProduct(
  overrides?: Partial<typeof products.$inferInsert>
): Promise<{ product: Product; retailer: Retailer }> {
  // Create retailer first
  const [retailer] = await db
    .insert(retailers)
    .values({
      name: overrides?.name ? `${overrides.name} Retailer` : 'Test Retailer',
      website: 'https://test-retailer.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    })
    .returning();

  // Create product
  const [product] = await db
    .insert(products)
    .values({
      name: 'Test Product',
      description: 'Test Description',
      image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=300&fit=crop',
      category: 'Electronics',
      ...overrides,
    })
    .returning();

  // Create product offer (required for product detail page to load)
  await db.insert(productOffers).values({
    productId: product.id,
    retailerId: retailer.id,
    productUrl: `https://${retailer.website}/products/${product.id}`,
    price: '99.99',
    availability: 'in_stock',
  });

  return { product, retailer };
}

/**
 * Seeds analytics data for testing admin dashboard.
 * Creates sample products, offers, and price history.
 *
 * @param options - Configuration for data volume
 * @returns Count of created records
 */
export async function seedAnalyticsData(options?: {
  productCount?: number;
  priceHistoryCount?: number;
}): Promise<{
  productsCreated: number;
  retailersCreated: number;
  priceHistoryCreated: number;
}> {
  const productCount = options?.productCount ?? 10;
  const priceHistoryCount = options?.priceHistoryCount ?? 50;

  // Create retailers
  const retailerData = [
    {
      name: 'Amazon',
      website: 'https://amazon.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    },
    {
      name: 'Best Buy',
      website: 'https://bestbuy.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    },
    {
      name: 'Walmart',
      website: 'https://walmart.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    },
  ];

  const createdRetailers = await db.insert(retailers).values(retailerData).returning();

  // Create products
  const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books'];
  const productData = Array.from({ length: productCount }, (_, i) => ({
    name: `Test Product ${i + 1}`,
    description: `Description for product ${i + 1}`,
    category: categories[i % categories.length],
    image: 'https://via.placeholder.com/300',
  }));

  const createdProducts = await db.insert(products).values(productData).returning();

  // Batch create product offers (avoid N+1 queries)
  const offerData = createdProducts.map((product) => {
    const retailer = createdRetailers[product.id % createdRetailers.length];
    return {
      productId: product.id,
      retailerId: retailer.id,
      productUrl: `https://${retailer.website}/products/${product.id}`,
      price: deterministicPriceString(30_000 + product.id, 50, 1050),
      availability: 'in_stock',
    };
  });

  const createdOffers = await db.insert(productOffers).values(offerData).returning();

  // Batch create price history entries (23x faster than loop)
  const priceEntriesPerProduct = Math.floor(priceHistoryCount / createdProducts.length);
  const priceHistoryData = [];
  const now = new Date();

  for (let i = 0; i < createdProducts.length; i++) {
    const product = createdProducts[i];
    const offer = createdOffers[i];

    for (let j = 0; j < priceEntriesPerProduct; j++) {
      const daysAgo = Math.floor((j / priceEntriesPerProduct) * 30); // Spread over 30 days
      const recordedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      priceHistoryData.push({
        productOfferId: offer.id,
        productId: product.id,
        retailerId: offer.retailerId,
        price: deterministicPriceString(40_000 + product.id * 1000 + j, 50, 1050),
        recordedAt,
      });
    }
  }

  // Single batch insert for all price history records (only if we have data)
  if (priceHistoryData.length > 0) {
    await db.insert(priceHistory).values(priceHistoryData);
  }

  return {
    productsCreated: createdProducts.length,
    retailersCreated: createdRetailers.length,
    priceHistoryCreated: priceHistoryData.length,
  };
}

/**
 * Seeds multiple products for testing bulk operations.
 *
 * @param count - Number of products to create
 * @returns Array of created products
 */
export async function seedMultipleProducts(count: number): Promise<Product[]> {
  const retailerData = {
    name: 'Bulk Test Retailer',
    website: 'https://bulk-retailer.com',
    logo: 'https://via.placeholder.com/150',
    isActive: true,
  };

  const [retailer] = await db.insert(retailers).values(retailerData).returning();

  const productData = Array.from({ length: count }, (_, i) => ({
    name: `Bulk Product ${i + 1}`,
    description: `Description ${i + 1}`,
    category: 'Electronics',
    image: 'https://via.placeholder.com/300',
  }));

  const createdProducts = await db.insert(products).values(productData).returning();

  // Create offers for each product
  for (let i = 0; i < createdProducts.length; i++) {
    const product = createdProducts[i];
    await db.insert(productOffers).values({
      productId: product.id,
      retailerId: retailer.id,
      productUrl: `https://${retailer.website}/products/${product.id}`,
      price: deterministicPriceString(50_000 + i, 100, 600),
      availability: 'in_stock',
    });
  }

  return createdProducts;
}
