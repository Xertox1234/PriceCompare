import { db } from "../server/db";
import { retailers, products, productOffers } from "../shared/schema";

async function seedDatabase() {
  console.log("Starting database seeding...");

  try {
    // Clear existing data
    console.log("Clearing existing data...");
    await db.delete(productOffers);
    await db.delete(products);
    await db.delete(retailers);

    // Seed retailers
    console.log("Seeding retailers...");
    const retailerData = [
      { name: "Amazon", logo: "https://logo.clearbit.com/amazon.com", website: "https://amazon.com", isActive: true },
      { name: "Best Buy", logo: "https://logo.clearbit.com/bestbuy.com", website: "https://bestbuy.com", isActive: true },
      { name: "Walmart", logo: "https://logo.clearbit.com/walmart.com", website: "https://walmart.com", isActive: true },
      { name: "Target", logo: "https://logo.clearbit.com/target.com", website: "https://target.com", isActive: true },
      { name: "B&H Photo", logo: "https://logo.clearbit.com/bhphotovideo.com", website: "https://bhphotovideo.com", isActive: true },
      { name: "Apple Store", logo: "https://logo.clearbit.com/apple.com", website: "https://apple.com", isActive: true },
    ];

    const insertedRetailers = await db.insert(retailers).values(retailerData).returning();
    console.log(`Inserted ${insertedRetailers.length} retailers`);

    // Seed products
    console.log("Seeding products...");
    const productData = [
      {
        name: "iPhone 15 Pro 128GB",
        description: "Latest iPhone with titanium design and advanced camera system",
        category: "Smartphones",
        image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Apple",
        model: "iPhone 15 Pro",
      },
      {
        name: "Samsung Galaxy S24 Ultra",
        description: "Premium Android smartphone with S Pen and advanced AI features",
        category: "Smartphones",
        image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Samsung",
        model: "Galaxy S24 Ultra",
      },
      {
        name: "MacBook Pro 14-inch M3",
        description: "Professional laptop with M3 chip and Liquid Retina XDR display",
        category: "Laptops",
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Apple",
        model: "MacBook Pro 14",
      },
      {
        name: "AirPods Pro (3rd Gen)",
        description: "Active noise cancelling wireless earbuds with spatial audio",
        category: "Audio",
        image: "https://images.unsplash.com/photo-1606041008023-472dfb5e530f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Apple",
        model: "AirPods Pro",
      },
      {
        name: "Sony WH-1000XM5",
        description: "Industry-leading noise canceling wireless headphones",
        category: "Audio",
        image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Sony",
        model: "WH-1000XM5",
      },
      {
        name: "Dell XPS 13",
        description: "Ultra-portable laptop with InfinityEdge display",
        category: "Laptops",
        image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Dell",
        model: "XPS 13",
      },
    ];

    const insertedProducts = await db.insert(products).values(productData).returning();
    console.log(`Inserted ${insertedProducts.length} products`);

    // Seed product offers
    console.log("Seeding product offers...");
    const offerData = [
      // iPhone 15 Pro offers
      { productId: insertedProducts[0].id, retailerId: insertedRetailers[0].id, price: "999.99", originalPrice: "1199.99", availability: "in_stock", rating: "4.5", reviewCount: 2431, shippingInfo: "Free shipping", dealType: "best_price", productUrl: "https://amazon.com/iphone" },
      { productId: insertedProducts[0].id, retailerId: insertedRetailers[1].id, price: "1049.99", originalPrice: "1199.99", availability: "in_stock", rating: "4.3", reviewCount: 1892, shippingInfo: "Store pickup available", dealType: null, productUrl: "https://bestbuy.com/iphone" },
      { productId: insertedProducts[0].id, retailerId: insertedRetailers[5].id, price: "1199.99", originalPrice: null, availability: "in_stock", rating: "4.8", reviewCount: 3421, shippingInfo: "Free shipping", dealType: null, productUrl: "https://apple.com/iphone" },
      
      // Samsung Galaxy S24 Ultra offers
      { productId: insertedProducts[1].id, retailerId: insertedRetailers[0].id, price: "1199.99", originalPrice: "1299.99", availability: "in_stock", rating: "4.4", reviewCount: 1567, shippingInfo: "Free shipping", dealType: null, productUrl: "https://amazon.com/galaxy" },
      { productId: insertedProducts[1].id, retailerId: insertedRetailers[1].id, price: "1249.99", originalPrice: "1299.99", availability: "in_stock", rating: "4.2", reviewCount: 1234, shippingInfo: "Same day pickup", dealType: null, productUrl: "https://bestbuy.com/galaxy" },
      
      // MacBook Pro offers
      { productId: insertedProducts[2].id, retailerId: insertedRetailers[5].id, price: "1999.99", originalPrice: "2199.99", availability: "in_stock", rating: "4.8", reviewCount: 892, shippingInfo: "Free shipping", dealType: "limited_time", productUrl: "https://apple.com/macbook" },
      { productId: insertedProducts[2].id, retailerId: insertedRetailers[0].id, price: "2049.99", originalPrice: "2199.99", availability: "in_stock", rating: "4.6", reviewCount: 567, shippingInfo: "Free shipping", dealType: null, productUrl: "https://amazon.com/macbook" },
      { productId: insertedProducts[2].id, retailerId: insertedRetailers[4].id, price: "1979.99", originalPrice: "2199.99", availability: "limited_stock", rating: "4.7", reviewCount: 234, shippingInfo: "Free shipping", dealType: "best_price", productUrl: "https://bhphotovideo.com/macbook" },
      
      // AirPods Pro offers
      { productId: insertedProducts[3].id, retailerId: insertedRetailers[5].id, price: "249.99", originalPrice: "279.99", availability: "in_stock", rating: "4.7", reviewCount: 3421, shippingInfo: "Free shipping", dealType: null, productUrl: "https://apple.com/airpods" },
      { productId: insertedProducts[3].id, retailerId: insertedRetailers[0].id, price: "229.99", originalPrice: "279.99", availability: "in_stock", rating: "4.5", reviewCount: 2876, shippingInfo: "Free shipping", dealType: "best_price", productUrl: "https://amazon.com/airpods" },
      { productId: insertedProducts[3].id, retailerId: insertedRetailers[1].id, price: "239.99", originalPrice: "279.99", availability: "in_stock", rating: "4.4", reviewCount: 1543, shippingInfo: "Store pickup", dealType: null, productUrl: "https://bestbuy.com/airpods" },

      // Sony WH-1000XM5 offers
      { productId: insertedProducts[4].id, retailerId: insertedRetailers[0].id, price: "329.99", originalPrice: "399.99", availability: "in_stock", rating: "4.6", reviewCount: 1892, shippingInfo: "Free shipping", dealType: "best_price", productUrl: "https://amazon.com/sony-headphones" },
      { productId: insertedProducts[4].id, retailerId: insertedRetailers[1].id, price: "349.99", originalPrice: "399.99", availability: "in_stock", rating: "4.5", reviewCount: 967, shippingInfo: "Store pickup available", dealType: null, productUrl: "https://bestbuy.com/sony-headphones" },
      { productId: insertedProducts[4].id, retailerId: insertedRetailers[4].id, price: "339.99", originalPrice: "399.99", availability: "limited_stock", rating: "4.7", reviewCount: 456, shippingInfo: "Free shipping", dealType: null, productUrl: "https://bhphotovideo.com/sony-headphones" },

      // Dell XPS 13 offers
      { productId: insertedProducts[5].id, retailerId: insertedRetailers[0].id, price: "1199.99", originalPrice: "1399.99", availability: "in_stock", rating: "4.3", reviewCount: 743, shippingInfo: "Free shipping", dealType: "best_price", productUrl: "https://amazon.com/dell-xps" },
      { productId: insertedProducts[5].id, retailerId: insertedRetailers[1].id, price: "1249.99", originalPrice: "1399.99", availability: "in_stock", rating: "4.2", reviewCount: 521, shippingInfo: "Store pickup available", dealType: null, productUrl: "https://bestbuy.com/dell-xps" },
      { productId: insertedProducts[5].id, retailerId: insertedRetailers[2].id, price: "1279.99", originalPrice: "1399.99", availability: "limited_stock", rating: "4.1", reviewCount: 298, shippingInfo: "2-day shipping", dealType: null, productUrl: "https://walmart.com/dell-xps" },
    ];

    const insertedOffers = await db.insert(productOffers).values(offerData).returning();
    console.log(`Inserted ${insertedOffers.length} product offers`);

    console.log("Database seeding completed successfully!");
    
    // Display summary
    console.log("\nSeeding Summary:");
    console.log(`- ${insertedRetailers.length} retailers`);
    console.log(`- ${insertedProducts.length} products`);
    console.log(`- ${insertedOffers.length} product offers`);

  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log("Seeding complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

export { seedDatabase };