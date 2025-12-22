/**
 * E2E Test Helpers: Product Discovery - Seeding
 */
import { db } from '../../server/db';
import { priceHistory, products, productOffers, retailers } from '@shared/schema';

export async function seedProductDiscoveryTestData(): Promise<void> {
  const [retailer1] = await db
    .insert(retailers)
    .values({
      name: 'Test Electronics Store',
      website: 'https://test-electronics.example.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    })
    .returning();

  const [retailer2] = await db
    .insert(retailers)
    .values({
      name: 'Budget Tech Shop',
      website: 'https://budget-tech.example.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    })
    .returning();

  const [product] = await db
    .insert(products)
    .values({
      name: 'Test Gaming Laptop',
      description: 'High-performance gaming laptop with RTX graphics',
      image: 'https://via.placeholder.com/400',
      category: 'Electronics',
    })
    .returning();

  const offers = await db
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
