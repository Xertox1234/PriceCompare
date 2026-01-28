/**
 * E2E Test Helpers: Product Discovery - Seeding
 *
 * Creates test data for product discovery E2E tests.
 * Uses upsert pattern to be idempotent (safe to run multiple times).
 */
import { db } from '../../server/db';
import { priceHistory, products, productOffers, retailers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export async function seedProductDiscoveryTestData(): Promise<void> {
  // Use unique test identifiers to avoid conflicts with other tests
  const testRetailer1Name = 'E2E Test Electronics Store';
  const testRetailer2Name = 'E2E Budget Tech Shop';
  const testProductName = 'E2E Test Gaming Laptop';

  // Upsert retailer 1 - find existing or create new
  let retailer1 = await db.query.retailers.findFirst({
    where: and(eq(retailers.name, testRetailer1Name), eq(retailers.countryCode, 'CA')),
  });

  if (!retailer1) {
    const [inserted] = await db
      .insert(retailers)
      .values({
        name: testRetailer1Name,
        website: 'https://test-electronics.example.com',
        logo: 'https://via.placeholder.com/150',
        isActive: true,
        countryCode: 'CA', // Canadian retailer to avoid US conflicts
        currency: 'CAD',
      })
      .returning();
    retailer1 = inserted;
  }

  // Upsert retailer 2
  let retailer2 = await db.query.retailers.findFirst({
    where: and(eq(retailers.name, testRetailer2Name), eq(retailers.countryCode, 'CA')),
  });

  if (!retailer2) {
    const [inserted] = await db
      .insert(retailers)
      .values({
        name: testRetailer2Name,
        website: 'https://budget-tech.example.com',
        logo: 'https://via.placeholder.com/150',
        isActive: true,
        countryCode: 'CA',
        currency: 'CAD',
      })
      .returning();
    retailer2 = inserted;
  }

  // Upsert product
  let product = await db.query.products.findFirst({
    where: eq(products.name, testProductName),
  });

  if (!product) {
    const [inserted] = await db
      .insert(products)
      .values({
        name: testProductName,
        description: 'High-performance gaming laptop with RTX graphics',
        image: 'https://via.placeholder.com/400',
        category: 'Electronics',
      })
      .returning();
    product = inserted;
  }

  // Check if offers already exist for this product
  const existingOffers = await db.query.productOffers.findMany({
    where: eq(productOffers.productId, product.id),
  });

  let offers: typeof existingOffers;

  if (existingOffers.length === 0) {
    offers = await db
      .insert(productOffers)
      .values([
        {
          productId: product.id,
          retailerId: retailer1.id,
          price: '1299.99',
          productUrl: 'https://test-electronics.example.com/laptop',
          availability: 'in_stock',
        },
        {
          productId: product.id,
          retailerId: retailer2.id,
          price: '1249.99',
          productUrl: 'https://budget-tech.example.com/laptop',
          availability: 'in_stock',
        },
      ])
      .returning();
  } else {
    offers = existingOffers;
  }

  // Check if price history already exists
  const existingHistory = await db.query.priceHistory.findFirst({
    where: eq(priceHistory.productId, product.id),
  });

  if (!existingHistory && offers.length > 0) {
    const now = new Date();
    const priceHistoryData: Array<(typeof priceHistory)['_']['inferInsert']> = [];

    for (let i = 30; i >= 0; i--) {
      const recordedAt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      priceHistoryData.push({
        productOfferId: offers[0].id,
        productId: product.id,
        retailerId: retailer1.id,
        price: (1299.99 - (i % 10) * 7.5).toFixed(2),
        recordedAt,
      });
    }

    await db.insert(priceHistory).values(priceHistoryData);
  }
}
