/**
 * E2E Test Helpers: Search Seeding
 */
import { db } from '../../server/db';
import { products, retailers, productOffers } from '@shared/schema';
import { deterministicNumberInRange, deterministicPriceString } from './deterministic';

export async function seedProductsWithCategories(options?: {
  productCount?: number;
  retailerName?: string;
}): Promise<void> {
  const [retailer] = await db
    .insert(retailers)
    .values({
      name: options?.retailerName ?? 'Test Retailer',
      website: 'https://test-retailer.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    })
    .returning();

  const categories = ['Electronics', 'Computers', 'Smartphones', 'Tablets', 'Accessories'];
  const productCount = options?.productCount ?? 10;

  for (let i = 0; i < productCount; i++) {
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
      price: deterministicPriceString(10_000 + i, 50, 550),
      productUrl: `https://test-retailer.com/product/${product.id}`,
      availability: 'in_stock',
    });
  }
}

export async function seedProductsWithPrices(options?: {
  productCount?: number;
  retailerName?: string;
}): Promise<void> {
  const [retailer] = await db
    .insert(retailers)
    .values({
      name: options?.retailerName ?? 'Price Test Retailer',
      website: 'https://price-retailer.com',
      logo: 'https://via.placeholder.com/150',
      isActive: true,
    })
    .returning();

  const priceRanges = [
    { min: 20, max: 50 },
    { min: 50, max: 100 },
    { min: 100, max: 200 },
    { min: 200, max: 500 },
    { min: 500, max: 1000 },
  ];

  const productCount = options?.productCount ?? 15;

  for (let i = 0; i < productCount; i++) {
    const range = priceRanges[i % priceRanges.length];
    const price = deterministicNumberInRange(20_000 + i, range.min, range.max);

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
