import { retailers, products, productOffers, type Retailer, type Product, type ProductOffer, type InsertRetailer, type InsertProduct, type InsertProductOffer, type ProductWithOffers, type SearchFilters } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, inArray, sql, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Retailers
  getRetailers(): Promise<Retailer[]>;
  createRetailer(retailer: InsertRetailer): Promise<Retailer>;
  
  // Products
  getProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  searchProducts(filters: SearchFilters): Promise<ProductWithOffers[]>;
  getProductById(id: number): Promise<ProductWithOffers | undefined>;
  
  // Product Offers
  getProductOffers(productId: number): Promise<(ProductOffer & { retailer: Retailer })[]>;
  createProductOffer(offer: InsertProductOffer): Promise<ProductOffer>;
}

export class MemStorage implements IStorage {
  private retailers: Map<number, Retailer>;
  private products: Map<number, Product>;
  private productOffers: Map<number, ProductOffer>;
  private currentRetailerId: number;
  private currentProductId: number;
  private currentOfferId: number;

  constructor() {
    this.retailers = new Map();
    this.products = new Map();
    this.productOffers = new Map();
    this.currentRetailerId = 1;
    this.currentProductId = 1;
    this.currentOfferId = 1;
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample retailers
    const sampleRetailers = [
      { name: "Amazon", logo: "https://logo.clearbit.com/amazon.com", website: "https://amazon.com", isActive: true },
      { name: "Best Buy", logo: "https://logo.clearbit.com/bestbuy.com", website: "https://bestbuy.com", isActive: true },
      { name: "Walmart", logo: "https://logo.clearbit.com/walmart.com", website: "https://walmart.com", isActive: true },
      { name: "Target", logo: "https://logo.clearbit.com/target.com", website: "https://target.com", isActive: true },
      { name: "B&H Photo", logo: "https://logo.clearbit.com/bhphotovideo.com", website: "https://bhphotovideo.com", isActive: true },
      { name: "Apple Store", logo: "https://logo.clearbit.com/apple.com", website: "https://apple.com", isActive: true },
    ];

    sampleRetailers.forEach(retailer => {
      const id = this.currentRetailerId++;
      this.retailers.set(id, { 
        ...retailer, 
        id,
        affiliateId: null,
        affiliateProgram: null,
        baseAffiliateUrl: null,
        commissionRate: null,
        affiliateStatus: 'inactive',
        affiliateConfig: null
      });
    });

    // Sample products
    const sampleProducts = [
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
    ];

    sampleProducts.forEach(product => {
      const id = this.currentProductId++;
      this.products.set(id, { ...product, id, createdAt: new Date() });
    });

    // Sample product offers
    const sampleOffers = [
      // iPhone 15 Pro offers
      { productId: 1, retailerId: 1, price: "999.99", originalPrice: "1199.99", availability: "in_stock", rating: "4.5", reviewCount: 2431, shippingInfo: "Free shipping", dealType: "best_price", productUrl: "https://amazon.com/iphone" },
      { productId: 1, retailerId: 2, price: "1049.99", originalPrice: "1199.99", availability: "in_stock", rating: "4.3", reviewCount: 1892, shippingInfo: "Store pickup available", dealType: null, productUrl: "https://bestbuy.com/iphone" },
      { productId: 1, retailerId: 3, price: "1079.99", originalPrice: "1199.99", availability: "limited_stock", rating: "4.1", reviewCount: 967, shippingInfo: "2-day shipping", dealType: null, productUrl: "https://walmart.com/iphone" },
      
      // Samsung Galaxy S24 Ultra offers
      { productId: 2, retailerId: 1, price: "1199.99", originalPrice: "1299.99", availability: "in_stock", rating: "4.4", reviewCount: 1567, shippingInfo: "Free shipping", dealType: null, productUrl: "https://amazon.com/galaxy" },
      { productId: 2, retailerId: 2, price: "1249.99", originalPrice: "1299.99", availability: "in_stock", rating: "4.2", reviewCount: 1234, shippingInfo: "Same day pickup", dealType: null, productUrl: "https://bestbuy.com/galaxy" },
      
      // MacBook Pro offers
      { productId: 3, retailerId: 6, price: "1999.99", originalPrice: "2199.99", availability: "in_stock", rating: "4.8", reviewCount: 892, shippingInfo: "Free shipping", dealType: "limited_time", productUrl: "https://apple.com/macbook" },
      { productId: 3, retailerId: 1, price: "2049.99", originalPrice: "2199.99", availability: "in_stock", rating: "4.6", reviewCount: 567, shippingInfo: "Free shipping", dealType: null, productUrl: "https://amazon.com/macbook" },
      
      // AirPods Pro offers
      { productId: 4, retailerId: 6, price: "249.99", originalPrice: "279.99", availability: "in_stock", rating: "4.7", reviewCount: 3421, shippingInfo: "Free shipping", dealType: null, productUrl: "https://apple.com/airpods" },
      { productId: 4, retailerId: 1, price: "229.99", originalPrice: "279.99", availability: "in_stock", rating: "4.5", reviewCount: 2876, shippingInfo: "Free shipping", dealType: "best_price", productUrl: "https://amazon.com/airpods" },
    ];

    sampleOffers.forEach(offer => {
      const id = this.currentOfferId++;
      this.productOffers.set(id, { 
        ...offer, 
        id, 
        lastUpdated: new Date(),
        affiliateUrl: null,
        linkHealthStatus: 'unknown',
        lastLinkCheck: null,
        clickCount: 0
      });
    });
  }

  async getRetailers(): Promise<Retailer[]> {
    return Array.from(this.retailers.values());
  }

  async createRetailer(retailer: InsertRetailer): Promise<Retailer> {
    const id = this.currentRetailerId++;
    const newRetailer: Retailer = { 
      ...retailer, 
      id,
      logo: retailer.logo ?? null,
      website: retailer.website ?? null,
      isActive: retailer.isActive ?? true,
      affiliateId: retailer.affiliateId ?? null,
      affiliateProgram: retailer.affiliateProgram ?? null,
      baseAffiliateUrl: retailer.baseAffiliateUrl ?? null,
      commissionRate: retailer.commissionRate ?? null,
      affiliateStatus: retailer.affiliateStatus ?? 'inactive',
      affiliateConfig: retailer.affiliateConfig ?? null
    };
    this.retailers.set(id, newRetailer);
    return newRetailer;
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const newProduct: Product = { 
      ...product, 
      id, 
      createdAt: new Date(),
      image: product.image || null,
      category: product.category || null,
      brand: product.brand || null,
      description: product.description || null,
      model: product.model || null
    };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async searchProducts(filters: SearchFilters): Promise<ProductWithOffers[]> {
    let filteredProducts = Array.from(this.products.values());

    // Apply search query filter
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filteredProducts = filteredProducts.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (filters.category) {
      filteredProducts = filteredProducts.filter(product => 
        product.category?.toLowerCase() === filters.category?.toLowerCase()
      );
    }

    // Get offers for filtered products
    const productsWithOffers = await Promise.all(
      filteredProducts.map(async (product) => {
        const offers = await this.getProductOffers(product.id);
        
        // Apply price filters
        let filteredOffers = offers;
        if (filters.minPrice) {
          filteredOffers = filteredOffers.filter(offer => parseFloat(offer.price) >= filters.minPrice!);
        }
        if (filters.maxPrice) {
          filteredOffers = filteredOffers.filter(offer => parseFloat(offer.price) <= filters.maxPrice!);
        }

        // Apply retailer filter
        if (filters.retailers && filters.retailers.length > 0) {
          filteredOffers = filteredOffers.filter(offer => filters.retailers!.includes(offer.retailerId));
        }

        // Apply rating filter
        if (filters.minRating) {
          filteredOffers = filteredOffers.filter(offer => 
            offer.rating && parseFloat(offer.rating) >= filters.minRating!
          );
        }

        // Apply availability filter
        if (filters.availability && filters.availability.length > 0) {
          filteredOffers = filteredOffers.filter(offer => 
            filters.availability!.includes(offer.availability || "in_stock")
          );
        }

        if (filteredOffers.length === 0) return null;

        const prices = filteredOffers.map(offer => parseFloat(offer.price));
        const bestPrice = Math.min(...prices);
        const originalPrices = filteredOffers
          .map(offer => offer.originalPrice ? parseFloat(offer.originalPrice) : null)
          .filter(price => price !== null) as number[];
        const avgOriginalPrice = originalPrices.length > 0 ? 
          originalPrices.reduce((sum, price) => sum + price, 0) / originalPrices.length : null;
        
        const savings = avgOriginalPrice ? avgOriginalPrice - bestPrice : null;
        const savingsPercentage = savings && avgOriginalPrice ? 
          Math.round((savings / avgOriginalPrice) * 100) : null;

        return {
          ...product,
          offers: filteredOffers,
          bestPrice,
          savings: savings || undefined,
          savingsPercentage: savingsPercentage || undefined,
        };
      })
    );

    // Filter out products with no matching offers
    const validProducts = productsWithOffers.filter(product => product !== null) as ProductWithOffers[];

    // Apply sorting
    if (filters.sortBy) {
      validProducts.sort((a, b) => {
        switch (filters.sortBy) {
          case "price_low":
            return (a.bestPrice || 0) - (b.bestPrice || 0);
          case "price_high":
            return (b.bestPrice || 0) - (a.bestPrice || 0);
          case "rating":
            const aRating = Math.max(...a.offers.map(offer => parseFloat(offer.rating || "0")));
            const bRating = Math.max(...b.offers.map(offer => parseFloat(offer.rating || "0")));
            return bRating - aRating;
          case "popularity":
            const aReviews = Math.max(...a.offers.map(offer => offer.reviewCount || 0));
            const bReviews = Math.max(...b.offers.map(offer => offer.reviewCount || 0));
            return bReviews - aReviews;
          default:
            return 0;
        }
      });
    }

    return validProducts;
  }

  async getProductById(id: number): Promise<ProductWithOffers | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

    const offers = await this.getProductOffers(id);
    const prices = offers.map(offer => parseFloat(offer.price));
    const bestPrice = prices.length > 0 ? Math.min(...prices) : undefined;

    return {
      ...product,
      offers,
      bestPrice,
    };
  }

  async getProductOffers(productId: number): Promise<(ProductOffer & { retailer: Retailer })[]> {
    const offers = Array.from(this.productOffers.values())
      .filter(offer => offer.productId === productId);

    return offers.map(offer => ({
      ...offer,
      retailer: this.retailers.get(offer.retailerId)!,
    }));
  }

  async createProductOffer(offer: InsertProductOffer): Promise<ProductOffer> {
    const id = this.currentOfferId++;
    const newOffer: ProductOffer = { 
      ...offer, 
      id, 
      lastUpdated: new Date(),
      availability: offer.availability ?? null,
      rating: offer.rating ?? null,
      originalPrice: offer.originalPrice ?? null,
      reviewCount: offer.reviewCount ?? null,
      shippingInfo: offer.shippingInfo ?? null,
      dealType: offer.dealType ?? null,
      productUrl: offer.productUrl ?? null,
      affiliateUrl: offer.affiliateUrl ?? null,
      linkHealthStatus: offer.linkHealthStatus ?? 'unknown',
      lastLinkCheck: offer.lastLinkCheck ?? null,
      clickCount: offer.clickCount ?? 0
    };
    this.productOffers.set(id, newOffer);
    return newOffer;
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getRetailers(): Promise<Retailer[]> {
    const result = await db.select().from(retailers).where(eq(retailers.isActive, true));
    return result;
  }

  async createRetailer(retailer: InsertRetailer): Promise<Retailer> {
    const [result] = await db
      .insert(retailers)
      .values({
        ...retailer,
        logo: retailer.logo || null,
        website: retailer.website || null,
        isActive: retailer.isActive ?? true
      })
      .returning();
    return result;
  }

  async getProducts(): Promise<Product[]> {
    const result = await db.select().from(products);
    return result;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [result] = await db
      .insert(products)
      .values({
        ...product,
        image: product.image || null,
        category: product.category || null,
        brand: product.brand || null,
        description: product.description || null,
        model: product.model || null
      })
      .returning();
    return result;
  }

  async searchProducts(filters: SearchFilters): Promise<ProductWithOffers[]> {
    // Build the base query conditions
    const conditions = [eq(retailers.isActive, true)];

    if (filters.query) {
      const searchTerm = `%${filters.query.toLowerCase()}%`;
      conditions.push(
        sql`(
          LOWER(${products.name}) LIKE ${searchTerm} OR
          LOWER(${products.description}) LIKE ${searchTerm} OR
          LOWER(${products.brand}) LIKE ${searchTerm} OR
          LOWER(${products.category}) LIKE ${searchTerm}
        )`
      );
    }

    if (filters.category) {
      conditions.push(eq(products.category, filters.category));
    }

    if (filters.minPrice) {
      conditions.push(gte(sql`CAST(${productOffers.price} AS DECIMAL)`, filters.minPrice));
    }

    if (filters.maxPrice) {
      conditions.push(lte(sql`CAST(${productOffers.price} AS DECIMAL)`, filters.maxPrice));
    }

    if (filters.retailers && filters.retailers.length > 0) {
      conditions.push(inArray(productOffers.retailerId, filters.retailers));
    }

    if (filters.minRating) {
      conditions.push(gte(sql`CAST(${productOffers.rating} AS DECIMAL)`, filters.minRating));
    }

    if (filters.availability && filters.availability.length > 0) {
      conditions.push(inArray(productOffers.availability, filters.availability));
    }

    // Build the complete query with conditions
    let baseQuery = db
      .select({
        product: products,
        offer: productOffers,
        retailer: retailers
      })
      .from(products)
      .innerJoin(productOffers, eq(products.id, productOffers.productId))
      .innerJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(and(...conditions));

    // Apply sorting by building a new query
    let results;
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case "price_low":
          results = await baseQuery.orderBy(asc(sql`CAST(${productOffers.price} AS DECIMAL)`));
          break;
        case "price_high":
          results = await baseQuery.orderBy(desc(sql`CAST(${productOffers.price} AS DECIMAL)`));
          break;
        case "rating":
          results = await baseQuery.orderBy(desc(sql`CAST(${productOffers.rating} AS DECIMAL)`));
          break;
        case "popularity":
          results = await baseQuery.orderBy(desc(productOffers.reviewCount));
          break;
        default:
          results = await baseQuery;
      }
    } else {
      results = await baseQuery;
    }

    // Group by product and calculate best prices
    const productMap = new Map<number, ProductWithOffers>();

    for (const row of results) {
      const { product, offer, retailer } = row;
      
      if (!productMap.has(product.id)) {
        productMap.set(product.id, {
          ...product,
          offers: []
        });
      }

      const productWithOffers = productMap.get(product.id)!;
      productWithOffers.offers.push({
        ...offer,
        retailer
      });
    }

    // Calculate best prices and savings
    const finalProducts = Array.from(productMap.values()).map(product => {
      const prices = product.offers.map(offer => parseFloat(offer.price));
      const bestPrice = Math.min(...prices);
      
      const originalPrices = product.offers
        .map(offer => offer.originalPrice ? parseFloat(offer.originalPrice) : null)
        .filter(price => price !== null) as number[];
      
      const avgOriginalPrice = originalPrices.length > 0 ? 
        originalPrices.reduce((sum, price) => sum + price, 0) / originalPrices.length : null;
      
      const savings = avgOriginalPrice ? avgOriginalPrice - bestPrice : null;
      const savingsPercentage = savings && avgOriginalPrice ? 
        Math.round((savings / avgOriginalPrice) * 100) : null;

      return {
        ...product,
        bestPrice,
        savings: savings || undefined,
        savingsPercentage: savingsPercentage || undefined,
      };
    });

    return finalProducts;
  }

  async getProductById(id: number): Promise<ProductWithOffers | undefined> {
    const productResult = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (productResult.length === 0) return undefined;

    const product = productResult[0];
    const offers = await this.getProductOffers(id);
    
    const prices = offers.map(offer => parseFloat(offer.price));
    const bestPrice = prices.length > 0 ? Math.min(...prices) : undefined;

    return {
      ...product,
      offers,
      bestPrice,
    };
  }

  async getProductOffers(productId: number): Promise<(ProductOffer & { retailer: Retailer })[]> {
    const result = await db
      .select({
        offer: productOffers,
        retailer: retailers
      })
      .from(productOffers)
      .innerJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(eq(productOffers.productId, productId));

    return result.map(row => ({
      ...row.offer,
      retailer: row.retailer
    }));
  }

  async createProductOffer(offer: InsertProductOffer): Promise<ProductOffer> {
    const [result] = await db
      .insert(productOffers)
      .values({
        ...offer,
        availability: offer.availability || null,
        rating: offer.rating || null,
        originalPrice: offer.originalPrice || null,
        reviewCount: offer.reviewCount || null,
        shippingInfo: offer.shippingInfo || null,
        dealType: offer.dealType || null,
        productUrl: offer.productUrl || null
      })
      .returning();
    return result;
  }
}

// Initialize storage - use database when DATABASE_URL is available
export const storage = process.env.DATABASE_URL 
  ? new DatabaseStorage() 
  : new MemStorage();
