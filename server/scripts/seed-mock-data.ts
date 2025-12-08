import 'dotenv/config';
import { db } from '../db';
import {
  products,
  retailers,
  productOffers,
  priceHistory,
  type InsertRetailer,
  type InsertProductOffer,
} from '../../shared/schema';
import { createLogger } from '../utils/logger';

const log = createLogger('SeedData');

async function seedMockData() {
  log.info('Seeding mock data');

  try {
    // Create retailers
    log.info('Creating retailers...');
    const retailerValues: InsertRetailer[] = [
      {
        name: 'Amazon',
        website: 'https://amazon.com',
        logo: 'https://logo.clearbit.com/amazon.com',
      },
      {
        name: 'Best Buy',
        website: 'https://bestbuy.com',
        logo: 'https://logo.clearbit.com/bestbuy.com',
      },
      {
        name: 'Walmart',
        website: 'https://walmart.com',
        logo: 'https://logo.clearbit.com/walmart.com',
      },
      {
        name: 'Target',
        website: 'https://target.com',
        logo: 'https://logo.clearbit.com/target.com',
      },
      {
        name: 'Newegg',
        website: 'https://newegg.com',
        logo: 'https://logo.clearbit.com/newegg.com',
      },
    ];
    const retailerData = await db.insert(retailers).values(retailerValues).returning();
    log.info('Created retailers', { count: retailerData.length });

    // Create products with offers
    log.info('Creating products with offers...');

    const productsData = [
      {
        name: 'iPhone 15 Pro Max',
        description: 'Apple iPhone 15 Pro Max with A17 Pro chip, 256GB storage, Titanium design',
        category: 'Smartphones',
        imageUrl: 'https://via.placeholder.com/400x400/1a1a1a/ffffff?text=iPhone+15+Pro',
        offers: [
          {
            retailerId: retailerData[0].id,
            price: 1199.0,
            url: 'https://amazon.com/iphone-15-pro-max',
          },
          {
            retailerId: retailerData[1].id,
            price: 1199.99,
            url: 'https://bestbuy.com/iphone-15-pro-max',
          },
          {
            retailerId: retailerData[3].id,
            price: 1199.0,
            url: 'https://target.com/iphone-15-pro-max',
          },
        ],
      },
      {
        name: 'Samsung Galaxy S24 Ultra',
        description: 'Samsung Galaxy S24 Ultra with Snapdragon 8 Gen 3, 512GB, S Pen included',
        category: 'Smartphones',
        imageUrl: 'https://via.placeholder.com/400x400/000000/ffffff?text=Galaxy+S24',
        offers: [
          {
            retailerId: retailerData[0].id,
            price: 1299.99,
            url: 'https://amazon.com/galaxy-s24-ultra',
          },
          {
            retailerId: retailerData[1].id,
            price: 1299.99,
            url: 'https://bestbuy.com/galaxy-s24-ultra',
          },
          {
            retailerId: retailerData[2].id,
            price: 1279.0,
            url: 'https://walmart.com/galaxy-s24-ultra',
          },
        ],
      },
      {
        name: 'MacBook Pro 16" M3 Max',
        description: 'Apple MacBook Pro 16-inch with M3 Max chip, 36GB RAM, 1TB SSD',
        category: 'Laptops',
        imageUrl: 'https://via.placeholder.com/400x400/2c2c2c/ffffff?text=MacBook+Pro',
        offers: [
          {
            retailerId: retailerData[0].id,
            price: 3499.0,
            url: 'https://amazon.com/macbook-pro-m3',
          },
          {
            retailerId: retailerData[1].id,
            price: 3499.99,
            url: 'https://bestbuy.com/macbook-pro-m3',
          },
        ],
      },
      {
        name: 'Dell XPS 15 (2024)',
        description: 'Dell XPS 15 with Intel Core i7-13700H, 32GB RAM, RTX 4060, 1TB SSD',
        category: 'Laptops',
        imageUrl: 'https://via.placeholder.com/400x400/1e1e1e/ffffff?text=Dell+XPS+15',
        offers: [
          { retailerId: retailerData[0].id, price: 1899.99, url: 'https://amazon.com/dell-xps-15' },
          {
            retailerId: retailerData[1].id,
            price: 1949.99,
            url: 'https://bestbuy.com/dell-xps-15',
          },
          { retailerId: retailerData[4].id, price: 1879.0, url: 'https://newegg.com/dell-xps-15' },
        ],
      },
      {
        name: 'Sony WH-1000XM5',
        description: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones, 30hr battery',
        category: 'Audio',
        imageUrl: 'https://via.placeholder.com/400x400/000000/ffffff?text=Sony+XM5',
        offers: [
          {
            retailerId: retailerData[0].id,
            price: 398.0,
            url: 'https://amazon.com/sony-wh1000xm5',
          },
          {
            retailerId: retailerData[1].id,
            price: 399.99,
            url: 'https://bestbuy.com/sony-wh1000xm5',
          },
          {
            retailerId: retailerData[2].id,
            price: 379.0,
            url: 'https://walmart.com/sony-wh1000xm5',
          },
          {
            retailerId: retailerData[3].id,
            price: 398.0,
            url: 'https://target.com/sony-wh1000xm5',
          },
        ],
      },
      {
        name: 'AirPods Pro (2nd Gen)',
        description: 'Apple AirPods Pro with Active Noise Cancellation, MagSafe charging case',
        category: 'Audio',
        imageUrl: 'https://via.placeholder.com/400x400/f5f5f5/000000?text=AirPods+Pro',
        offers: [
          { retailerId: retailerData[0].id, price: 249.0, url: 'https://amazon.com/airpods-pro' },
          { retailerId: retailerData[1].id, price: 249.99, url: 'https://bestbuy.com/airpods-pro' },
          { retailerId: retailerData[3].id, price: 249.0, url: 'https://target.com/airpods-pro' },
        ],
      },
      {
        name: 'iPad Air M2 (2024)',
        description: 'Apple iPad Air 11-inch with M2 chip, 256GB, Wi-Fi',
        category: 'Tablets',
        imageUrl: 'https://via.placeholder.com/400x400/e8e8e8/000000?text=iPad+Air',
        offers: [
          { retailerId: retailerData[0].id, price: 749.0, url: 'https://amazon.com/ipad-air-m2' },
          { retailerId: retailerData[1].id, price: 749.99, url: 'https://bestbuy.com/ipad-air-m2' },
          { retailerId: retailerData[3].id, price: 749.0, url: 'https://target.com/ipad-air-m2' },
        ],
      },
      {
        name: 'Samsung Tab S9 Ultra',
        description: 'Samsung Galaxy Tab S9 Ultra, 14.6" AMOLED, Snapdragon 8 Gen 2, 512GB',
        category: 'Tablets',
        imageUrl: 'https://via.placeholder.com/400x400/1a1a1a/ffffff?text=Tab+S9+Ultra',
        offers: [
          {
            retailerId: retailerData[0].id,
            price: 1199.99,
            url: 'https://amazon.com/tab-s9-ultra',
          },
          {
            retailerId: retailerData[1].id,
            price: 1199.99,
            url: 'https://bestbuy.com/tab-s9-ultra',
          },
        ],
      },
      {
        name: 'LG C3 OLED 65"',
        description: 'LG C3 65-inch OLED evo 4K TV with α9 AI Processor, 120Hz, HDMI 2.1',
        category: 'TVs',
        imageUrl: 'https://via.placeholder.com/400x400/000000/ffffff?text=LG+C3+OLED',
        offers: [
          { retailerId: retailerData[0].id, price: 1796.99, url: 'https://amazon.com/lg-c3-oled' },
          { retailerId: retailerData[1].id, price: 1799.99, url: 'https://bestbuy.com/lg-c3-oled' },
          { retailerId: retailerData[2].id, price: 1748.0, url: 'https://walmart.com/lg-c3-oled' },
        ],
      },
      {
        name: 'PlayStation 5 Slim',
        description: 'Sony PlayStation 5 Slim Console with 1TB SSD, DualSense controller',
        category: 'Gaming',
        imageUrl: 'https://via.placeholder.com/400x400/003087/ffffff?text=PS5+Slim',
        offers: [
          { retailerId: retailerData[0].id, price: 499.0, url: 'https://amazon.com/ps5-slim' },
          { retailerId: retailerData[1].id, price: 499.99, url: 'https://bestbuy.com/ps5-slim' },
          { retailerId: retailerData[2].id, price: 499.0, url: 'https://walmart.com/ps5-slim' },
          { retailerId: retailerData[3].id, price: 499.99, url: 'https://target.com/ps5-slim' },
        ],
      },
    ];

    for (const productData of productsData) {
      const { offers: offerData, ...productInfo } = productData;

      // Create product
      const [product] = await db.insert(products).values(productInfo).returning();

      // Create offers for this product
      for (const offer of offerData) {
        const [createdOffer] = await db
          .insert(productOffers)
          .values({
            productId: product.id,
            retailerId: offer.retailerId,
            price: offer.price.toString(),
            productUrl: offer.url,
            availability: 'in_stock',
          })
          .returning();

        // Add price history (simulate price changes over last 30 days)
        const today = new Date();
        for (let i = 30; i >= 0; i -= 5) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);

          // Simulate small price fluctuations
          const priceVariation = (Math.random() - 0.5) * 50; // ±$25
          const historicalPrice = offer.price + priceVariation;

          await db.insert(priceHistory).values({
            productOfferId: createdOffer.id,
            productId: product.id,
            retailerId: offer.retailerId,
            price: historicalPrice.toFixed(2),
            recordedAt: date,
          });
        }
      }

      log.info('Created product with offers', {
        productName: product.name,
        offerCount: offerData.length,
      });
    }

    log.info('Successfully seeded products', { count: productsData.length });
    log.info('Mock data seeding complete');
    log.info('You can now view products at: http://localhost:5001');

    process.exit(0);
  } catch (error) {
    log.error('Error seeding data', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

seedMockData();
