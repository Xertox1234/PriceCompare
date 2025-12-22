/**
 * E2E Test Helpers: Price Alerts - Seeding
 */
import { db } from '../../server/db';
import { priceHistory, products, productOffers, retailers } from '@shared/schema';

export async function seedPriceAlertTestData(): Promise<{ productId: number; productName: string }> {
  const [retailer] = await db
    .insert(retailers)
    .values({
      name: 'Test Store',
      website: 'https://test-store.example.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    })
    .returning();

  const [product] = await db
    .insert(products)
    .values({
      name: 'Gaming Laptop',
      description: 'High-performance gaming laptop',
      image: 'https://via.placeholder.com/400',
      category: 'Electronics',
    })
    .returning();

  const [offer] = await db
    .insert(productOffers)
    .values({
      productId: product.id,
      retailerId: retailer.id,
      price: '1299.99',
      productUrl: 'https://test-store.example.com/laptop',
      availability: 'in_stock',
    })
    .returning();

  // Seed a small amount of history so the chart renders points.
  const now = new Date();
  await db.insert(priceHistory).values([
    {
      productOfferId: offer.id,
      productId: product.id,
      retailerId: retailer.id,
      price: '1299.99',
      recordedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      productOfferId: offer.id,
      productId: product.id,
      retailerId: retailer.id,
      price: '1249.99',
      recordedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      productOfferId: offer.id,
      productId: product.id,
      retailerId: retailer.id,
      price: '1199.99',
      recordedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  ]);

  return { productId: product.id, productName: product.name };
}
