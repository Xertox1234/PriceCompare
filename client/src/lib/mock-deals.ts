/**
 * Mock Deals Data for Homepage Carousels
 * Comprehensive mock data for the "busy hub" homepage experience
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface MockRetailer {
  id: number;
  name: string;
  logo?: string;
}

export interface MockProduct {
  id: number;
  name: string;
  category: string;
  currentPrice: number;
  originalPrice: number;
  savingsPercent: number;
  rating: number;
  reviewCount: number;
  retailer: MockRetailer;
  imageUrl: string;
  // Optional properties for different card variants
  flashDealEndsAt?: Date;
  priceDroppedAt?: Date;
  watchCount?: number;
  brand?: string;
  description?: string;
}

// ============================================================================
// Retailer Data
// ============================================================================

export const retailers: MockRetailer[] = [
  { id: 1, name: "Amazon", logo: "https://logo.clearbit.com/amazon.com" },
  { id: 2, name: "Target", logo: "https://logo.clearbit.com/target.com" },
  { id: 3, name: "Best Buy", logo: "https://logo.clearbit.com/bestbuy.com" },
  { id: 4, name: "Walmart", logo: "https://logo.clearbit.com/walmart.com" },
  { id: 5, name: "Costco", logo: "https://logo.clearbit.com/costco.com" },
];

// ============================================================================
// Category Definitions
// ============================================================================

export const categories = [
  "Electronics",
  "Fashion",
  "Home",
  "Gaming",
  "Phones",
] as const;

export type ProductCategory = (typeof categories)[number];

// ============================================================================
// Mock Products Data
// ============================================================================

const getRetailer = (index: number): MockRetailer =>
  retailers[index % retailers.length];

const generateImageUrl = (seed: string): string =>
  `https://picsum.photos/seed/${seed.replace(/\s+/g, "-").toLowerCase()}/300/300`;

// Helper to create dates in the near future for flash deals
const hoursFromNow = (hours: number): Date => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

// Helper to create dates in the recent past for price drops
const hoursAgo = (hours: number): Date => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
};

export const mockProducts: MockProduct[] = [
  // Electronics (IDs 1-6)
  {
    id: 1,
    name: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
    category: 'Electronics',
    currentPrice: 278.00,
    originalPrice: 399.99,
    savingsPercent: 30,
    rating: 4.8,
    reviewCount: 15420,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('sony-headphones-xm5'),
    brand: 'Sony',
    flashDealEndsAt: hoursFromNow(4),
    watchCount: 892,
    description: 'Industry-leading noise cancellation with Auto NC Optimizer',
  },
  {
    id: 2,
    name: 'Apple AirPods Pro (2nd Generation)',
    category: 'Electronics',
    currentPrice: 189.99,
    originalPrice: 249.00,
    savingsPercent: 24,
    rating: 4.7,
    reviewCount: 28340,
    retailer: getRetailer(2),
    imageUrl: generateImageUrl('airpods-pro-2'),
    brand: 'Apple',
    watchCount: 2341,
    description: 'Active Noise Cancellation with Adaptive Transparency',
  },
  {
    id: 3,
    name: 'Samsung 65" OLED 4K Smart TV S95C',
    category: 'Electronics',
    currentPrice: 1797.99,
    originalPrice: 2999.99,
    savingsPercent: 40,
    rating: 4.6,
    reviewCount: 3240,
    retailer: getRetailer(3),
    imageUrl: generateImageUrl('samsung-oled-tv'),
    brand: 'Samsung',
    flashDealEndsAt: hoursFromNow(8),
    watchCount: 567,
    description: '4K OLED with Neural Quantum Processor',
  },
  {
    id: 4,
    name: 'Bose QuietComfort Ultra Earbuds',
    category: 'Electronics',
    currentPrice: 229.00,
    originalPrice: 299.00,
    savingsPercent: 23,
    rating: 4.5,
    reviewCount: 5621,
    retailer: getRetailer(1),
    imageUrl: generateImageUrl('bose-earbuds-ultra'),
    brand: 'Bose',
    priceDroppedAt: hoursAgo(3),
    description: 'World-class noise cancellation and immersive audio',
  },
  {
    id: 5,
    name: 'LG C3 55" OLED evo 4K Smart TV',
    category: 'Electronics',
    currentPrice: 1096.99,
    originalPrice: 1799.99,
    savingsPercent: 39,
    rating: 4.8,
    reviewCount: 8934,
    retailer: getRetailer(2),
    imageUrl: generateImageUrl('lg-c3-oled'),
    brand: 'LG',
    watchCount: 1245,
    description: 'Self-lit OLED pixels for perfect blacks',
  },
  {
    id: 6,
    name: 'JBL Charge 5 Portable Bluetooth Speaker',
    category: 'Electronics',
    currentPrice: 119.95,
    originalPrice: 179.95,
    savingsPercent: 33,
    rating: 4.7,
    reviewCount: 12890,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('jbl-charge-5'),
    brand: 'JBL',
    priceDroppedAt: hoursAgo(1),
    description: '20 hours of playtime with IP67 waterproof design',
  },

  // Fashion (IDs 7-12)
  {
    id: 7,
    name: "Levi's 501 Original Fit Jeans",
    category: 'Fashion',
    currentPrice: 49.99,
    originalPrice: 89.50,
    savingsPercent: 44,
    rating: 4.4,
    reviewCount: 23450,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('levis-501-jeans'),
    brand: "Levi's",
    flashDealEndsAt: hoursFromNow(6),
    description: 'The original jean since 1873',
  },
  {
    id: 8,
    name: 'Nike Air Max 270 Running Shoes',
    category: 'Fashion',
    currentPrice: 109.97,
    originalPrice: 160.00,
    savingsPercent: 31,
    rating: 4.6,
    reviewCount: 18920,
    retailer: getRetailer(4),
    imageUrl: generateImageUrl('nike-air-max-270'),
    brand: 'Nike',
    watchCount: 1876,
    description: 'Lifestyle shoe with largest Max Air unit',
  },
  {
    id: 9,
    name: 'The North Face Thermoball Eco Jacket',
    category: 'Fashion',
    currentPrice: 149.00,
    originalPrice: 230.00,
    savingsPercent: 35,
    rating: 4.5,
    reviewCount: 4560,
    retailer: getRetailer(1),
    imageUrl: generateImageUrl('north-face-thermoball'),
    brand: 'The North Face',
    priceDroppedAt: hoursAgo(5),
    description: 'Synthetic insulation from recycled materials',
  },
  {
    id: 10,
    name: 'Ray-Ban Wayfarer Classic Sunglasses',
    category: 'Fashion',
    currentPrice: 129.00,
    originalPrice: 178.00,
    savingsPercent: 28,
    rating: 4.7,
    reviewCount: 31200,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('rayban-wayfarer'),
    brand: 'Ray-Ban',
    watchCount: 543,
    description: 'Timeless style with G-15 lenses',
  },
  {
    id: 11,
    name: 'Adidas Ultraboost 22 Running Shoes',
    category: 'Fashion',
    currentPrice: 126.00,
    originalPrice: 190.00,
    savingsPercent: 34,
    rating: 4.6,
    reviewCount: 9870,
    retailer: getRetailer(2),
    imageUrl: generateImageUrl('adidas-ultraboost-22'),
    brand: 'Adidas',
    flashDealEndsAt: hoursFromNow(2),
    watchCount: 2134,
    description: 'Responsive Boost midsole cushioning',
  },
  {
    id: 12,
    name: 'Columbia Bugaboo II Fleece Interchange Jacket',
    category: 'Fashion',
    currentPrice: 139.99,
    originalPrice: 220.00,
    savingsPercent: 36,
    rating: 4.4,
    reviewCount: 6780,
    retailer: getRetailer(4),
    imageUrl: generateImageUrl('columbia-bugaboo-jacket'),
    brand: 'Columbia',
    description: '3-in-1 jacket with removable fleece liner',
  },

  // Home (IDs 13-18)
  {
    id: 13,
    name: 'Dyson V15 Detect Absolute Cordless Vacuum',
    category: 'Home',
    currentPrice: 549.99,
    originalPrice: 749.99,
    savingsPercent: 27,
    rating: 4.7,
    reviewCount: 7890,
    retailer: getRetailer(2),
    imageUrl: generateImageUrl('dyson-v15-vacuum'),
    brand: 'Dyson',
    flashDealEndsAt: hoursFromNow(12),
    watchCount: 1567,
    description: 'Laser reveals microscopic dust particles',
  },
  {
    id: 14,
    name: 'Instant Pot Duo 7-in-1 Electric Pressure Cooker 8Qt',
    category: 'Home',
    currentPrice: 79.95,
    originalPrice: 139.95,
    savingsPercent: 43,
    rating: 4.7,
    reviewCount: 45230,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('instant-pot-duo'),
    brand: 'Instant Pot',
    priceDroppedAt: hoursAgo(2),
    watchCount: 3421,
    description: '7 appliances in 1: pressure cooker, slow cooker, rice cooker, and more',
  },
  {
    id: 15,
    name: 'Ninja Foodi 12-in-1 Deluxe XL Air Fryer',
    category: 'Home',
    currentPrice: 179.99,
    originalPrice: 279.99,
    savingsPercent: 36,
    rating: 4.6,
    reviewCount: 12340,
    retailer: getRetailer(1),
    imageUrl: generateImageUrl('ninja-foodi-airfryer'),
    brand: 'Ninja',
    flashDealEndsAt: hoursFromNow(5),
    description: 'XL 8-qt capacity with TenderCrisp technology',
  },
  {
    id: 16,
    name: 'iRobot Roomba j7+ Self-Emptying Robot Vacuum',
    category: 'Home',
    currentPrice: 499.00,
    originalPrice: 799.99,
    savingsPercent: 38,
    rating: 4.4,
    reviewCount: 5670,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('roomba-j7-plus'),
    brand: 'iRobot',
    watchCount: 987,
    description: 'PrecisionVision Navigation identifies and avoids obstacles',
  },
  {
    id: 17,
    name: 'KitchenAid Professional 5qt Stand Mixer',
    category: 'Home',
    currentPrice: 349.99,
    originalPrice: 499.99,
    savingsPercent: 30,
    rating: 4.8,
    reviewCount: 28900,
    retailer: getRetailer(3),
    imageUrl: generateImageUrl('kitchenaid-mixer'),
    brand: 'KitchenAid',
    priceDroppedAt: hoursAgo(6),
    description: 'Professional-grade mixing with 10+ attachments available',
  },
  {
    id: 18,
    name: 'Casper Original Mattress - Queen',
    category: 'Home',
    currentPrice: 795.00,
    originalPrice: 1095.00,
    savingsPercent: 27,
    rating: 4.5,
    reviewCount: 15670,
    retailer: getRetailer(4),
    imageUrl: generateImageUrl('casper-mattress'),
    brand: 'Casper',
    watchCount: 432,
    description: 'Award-winning comfort with 100-night trial',
  },

  // Gaming (IDs 19-24)
  {
    id: 19,
    name: 'PlayStation 5 Console - God of War Ragnarok Bundle',
    category: 'Gaming',
    currentPrice: 449.99,
    originalPrice: 559.99,
    savingsPercent: 20,
    rating: 4.9,
    reviewCount: 34560,
    retailer: getRetailer(2),
    imageUrl: generateImageUrl('ps5-gow-bundle'),
    brand: 'Sony',
    flashDealEndsAt: hoursFromNow(3),
    watchCount: 5678,
    description: 'Console with ultra-high speed SSD and DualSense controller',
  },
  {
    id: 20,
    name: 'Xbox Series X 1TB Console',
    category: 'Gaming',
    currentPrice: 439.99,
    originalPrice: 499.99,
    savingsPercent: 12,
    rating: 4.8,
    reviewCount: 21340,
    retailer: getRetailer(3),
    imageUrl: generateImageUrl('xbox-series-x'),
    brand: 'Microsoft',
    watchCount: 3245,
    description: 'The most powerful Xbox ever with 4K gaming at 120fps',
  },
  {
    id: 21,
    name: 'Nintendo Switch OLED Model - White',
    category: 'Gaming',
    currentPrice: 299.99,
    originalPrice: 349.99,
    savingsPercent: 14,
    rating: 4.7,
    reviewCount: 18790,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('nintendo-switch-oled'),
    brand: 'Nintendo',
    priceDroppedAt: hoursAgo(4),
    description: '7-inch OLED screen with enhanced audio',
  },
  {
    id: 22,
    name: 'Razer BlackWidow V4 Pro Mechanical Gaming Keyboard',
    category: 'Gaming',
    currentPrice: 179.99,
    originalPrice: 229.99,
    savingsPercent: 22,
    rating: 4.6,
    reviewCount: 4560,
    retailer: getRetailer(2),
    imageUrl: generateImageUrl('razer-blackwidow-v4'),
    brand: 'Razer',
    flashDealEndsAt: hoursFromNow(7),
    description: 'Green mechanical switches with command dial',
  },
  {
    id: 23,
    name: 'Logitech G Pro X Superlight Wireless Gaming Mouse',
    category: 'Gaming',
    currentPrice: 109.99,
    originalPrice: 159.99,
    savingsPercent: 31,
    rating: 4.8,
    reviewCount: 8920,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('logitech-gpro-superlight'),
    brand: 'Logitech',
    watchCount: 1432,
    description: 'Ultra-lightweight design at less than 63 grams',
  },
  {
    id: 24,
    name: 'SteelSeries Arctis Nova Pro Wireless Headset',
    category: 'Gaming',
    currentPrice: 279.99,
    originalPrice: 349.99,
    savingsPercent: 20,
    rating: 4.5,
    reviewCount: 3240,
    retailer: getRetailer(1),
    imageUrl: generateImageUrl('steelseries-arctis-nova'),
    brand: 'SteelSeries',
    priceDroppedAt: hoursAgo(8),
    description: 'Active noise cancellation with dual wireless connectivity',
  },

  // Phones (IDs 25-30)
  {
    id: 25,
    name: 'Apple iPhone 15 Pro Max 256GB - Natural Titanium',
    category: 'Phones',
    currentPrice: 1099.00,
    originalPrice: 1199.00,
    savingsPercent: 8,
    rating: 4.8,
    reviewCount: 12340,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('iphone-15-pro-max'),
    brand: 'Apple',
    watchCount: 8765,
    description: 'A17 Pro chip with titanium design and Action button',
  },
  {
    id: 26,
    name: 'Samsung Galaxy S24 Ultra 512GB - Titanium Black',
    category: 'Phones',
    currentPrice: 1149.99,
    originalPrice: 1419.99,
    savingsPercent: 19,
    rating: 4.7,
    reviewCount: 8670,
    retailer: getRetailer(3),
    imageUrl: generateImageUrl('samsung-s24-ultra'),
    brand: 'Samsung',
    flashDealEndsAt: hoursFromNow(10),
    watchCount: 4532,
    description: 'Galaxy AI with S Pen and 200MP camera',
  },
  {
    id: 27,
    name: 'Google Pixel 8 Pro 256GB - Obsidian',
    category: 'Phones',
    currentPrice: 799.00,
    originalPrice: 999.00,
    savingsPercent: 20,
    rating: 4.6,
    reviewCount: 5430,
    retailer: getRetailer(2),
    imageUrl: generateImageUrl('pixel-8-pro'),
    brand: 'Google',
    priceDroppedAt: hoursAgo(1),
    watchCount: 2341,
    description: 'Google Tensor G3 chip with 7 years of updates',
  },
  {
    id: 28,
    name: 'OnePlus 12 256GB - Flowy Emerald',
    category: 'Phones',
    currentPrice: 699.99,
    originalPrice: 899.99,
    savingsPercent: 22,
    rating: 4.5,
    reviewCount: 3210,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('oneplus-12'),
    brand: 'OnePlus',
    flashDealEndsAt: hoursFromNow(6),
    description: 'Snapdragon 8 Gen 3 with Hasselblad camera',
  },
  {
    id: 29,
    name: 'Samsung Galaxy Z Fold 5 512GB - Phantom Black',
    category: 'Phones',
    currentPrice: 1499.99,
    originalPrice: 1919.99,
    savingsPercent: 22,
    rating: 4.4,
    reviewCount: 4560,
    retailer: getRetailer(1),
    imageUrl: generateImageUrl('galaxy-z-fold-5'),
    brand: 'Samsung',
    watchCount: 1234,
    description: 'Foldable 7.6" main screen with Flex Mode',
  },
  {
    id: 30,
    name: 'Apple iPhone 15 128GB - Blue',
    category: 'Phones',
    currentPrice: 729.00,
    originalPrice: 829.00,
    savingsPercent: 12,
    rating: 4.7,
    reviewCount: 18900,
    retailer: getRetailer(4),
    imageUrl: generateImageUrl('iphone-15-blue'),
    brand: 'Apple',
    priceDroppedAt: hoursAgo(12),
    description: 'Dynamic Island with A16 Bionic chip',
  },

  // Additional products for variety (IDs 31-35)
  {
    id: 31,
    name: 'Canon EOS R6 Mark II Mirrorless Camera Body',
    category: 'Electronics',
    currentPrice: 2299.00,
    originalPrice: 2499.00,
    savingsPercent: 8,
    rating: 4.8,
    reviewCount: 2340,
    retailer: getRetailer(2),
    imageUrl: generateImageUrl('canon-eos-r6-ii'),
    brand: 'Canon',
    flashDealEndsAt: hoursFromNow(16),
    watchCount: 678,
    description: '24.2MP Full-frame with 40fps continuous shooting',
  },
  {
    id: 32,
    name: 'Apple Watch Ultra 2 49mm - Orange Alpine Loop',
    category: 'Electronics',
    currentPrice: 749.00,
    originalPrice: 799.00,
    savingsPercent: 6,
    rating: 4.7,
    reviewCount: 6780,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('apple-watch-ultra-2'),
    brand: 'Apple',
    watchCount: 2345,
    description: 'Most rugged Apple Watch with 36-hour battery',
  },
  {
    id: 33,
    name: 'Ember Temperature Control Smart Mug 2 - 14oz',
    category: 'Home',
    currentPrice: 129.95,
    originalPrice: 169.95,
    savingsPercent: 24,
    rating: 4.3,
    reviewCount: 8920,
    retailer: getRetailer(0),
    imageUrl: generateImageUrl('ember-mug-2'),
    brand: 'Ember',
    priceDroppedAt: hoursAgo(3),
    description: 'Keep your drink at the perfect temperature for 1.5 hours',
  },
  {
    id: 34,
    name: 'Meta Quest 3 128GB VR Headset',
    category: 'Gaming',
    currentPrice: 449.99,
    originalPrice: 499.99,
    savingsPercent: 10,
    rating: 4.5,
    reviewCount: 4560,
    retailer: getRetailer(2),
    imageUrl: generateImageUrl('meta-quest-3'),
    brand: 'Meta',
    flashDealEndsAt: hoursFromNow(9),
    watchCount: 3456,
    description: 'Mixed reality experiences with breakthrough graphics',
  },
  {
    id: 35,
    name: "Patagonia Men's Better Sweater Fleece Jacket",
    category: 'Fashion',
    currentPrice: 109.00,
    originalPrice: 149.00,
    savingsPercent: 27,
    rating: 4.6,
    reviewCount: 11230,
    retailer: getRetailer(4),
    imageUrl: generateImageUrl('patagonia-better-sweater'),
    brand: 'Patagonia',
    watchCount: 876,
    description: '100% recycled polyester fleece with Fair Trade Certified sewn',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all products with active flash deals (ends in the future)
 */
export function getFlashDeals(): MockProduct[] {
  const now = new Date();
  return mockProducts
    .filter((p) => p.flashDealEndsAt && p.flashDealEndsAt > now)
    .sort((a, b) => {
      // Sort by ending soonest first
      const aTime = a.flashDealEndsAt?.getTime() || 0;
      const bTime = b.flashDealEndsAt?.getTime() || 0;
      return aTime - bTime;
    });
}

/**
 * Get products filtered by category
 */
export function getProductsByCategory(category: ProductCategory): MockProduct[] {
  return mockProducts.filter((p) => p.category === category);
}

/**
 * Get trending products sorted by watch count
 */
export function getTrendingProducts(): MockProduct[] {
  return mockProducts
    .filter((p) => p.watchCount !== undefined && p.watchCount > 0)
    .sort((a, b) => (b.watchCount || 0) - (a.watchCount || 0));
}

/**
 * Get products with recent price drops
 */
export function getPriceDrops(): MockProduct[] {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  return mockProducts
    .filter((p) => p.priceDroppedAt && p.priceDroppedAt > oneDayAgo)
    .sort((a, b) => {
      // Sort by most recent price drop first
      const aTime = a.priceDroppedAt?.getTime() || 0;
      const bTime = b.priceDroppedAt?.getTime() || 0;
      return bTime - aTime;
    });
}

/**
 * Get top deals by savings percentage
 */
export function getTopDeals(limit = 10): MockProduct[] {
  return [...mockProducts]
    .sort((a, b) => b.savingsPercent - a.savingsPercent)
    .slice(0, limit);
}

/**
 * Get products by multiple categories
 */
export function getProductsByCategoriesArray(cats: ProductCategory[]): MockProduct[] {
  return mockProducts.filter((p) => cats.includes(p.category as ProductCategory));
}

/**
 * Search products by name or brand
 */
export function searchProducts(query: string): MockProduct[] {
  const lowerQuery = query.toLowerCase();
  return mockProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.brand?.toLowerCase().includes(lowerQuery) ||
      p.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get products by retailer
 */
export function getProductsByRetailer(retailerId: number): MockProduct[] {
  return mockProducts.filter((p) => p.retailer.id === retailerId);
}

/**
 * Get products within a price range
 */
export function getProductsByPriceRange(
  minPrice: number,
  maxPrice: number
): MockProduct[] {
  return mockProducts.filter(
    (p) => p.currentPrice >= minPrice && p.currentPrice <= maxPrice
  );
}

/**
 * Get products with high ratings (4.5+)
 */
export function getHighlyRatedProducts(): MockProduct[] {
  return mockProducts
    .filter((p) => p.rating >= 4.5)
    .sort((a, b) => b.rating - a.rating);
}

/**
 * Get a random selection of products
 */
export function getRandomProducts(count: number): MockProduct[] {
  const shuffled = [...mockProducts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
