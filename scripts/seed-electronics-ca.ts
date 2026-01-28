/**
 * Seed Script: Canadian Electronics Catalog
 *
 * Seeds the database with curated Canadian electronics products from popular retailers.
 * This provides the "cold start" data needed for the homepage to display real products.
 *
 * Products are organized by category:
 * - Smartphones (10 products)
 * - Laptops (10 products)
 * - Gaming (10 products)
 * - Audio (10 products)
 * - TVs & Monitors (10 products)
 *
 * Retailers (Canadian):
 * - Best Buy Canada (bestbuy.ca) - CAD
 * - Amazon Canada (amazon.ca) - CAD
 * - Canada Computers (canadacomputers.com) - CAD
 *
 * Usage:
 *   npx tsx scripts/seed-electronics-ca.ts
 */

import { db } from '../server/db';
import { retailers, products, productOffers, priceHistory } from '../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

// ============================================================================
// Canadian Retailers Data
// ============================================================================

const CANADIAN_RETAILERS = [
  {
    name: 'Best Buy Canada',
    logo: 'https://logo.clearbit.com/bestbuy.ca',
    website: 'https://www.bestbuy.ca',
    isActive: true,
    countryCode: 'CA',
    currency: 'CAD',
    affiliateProgram: 'impact',
    affiliateStatus: 'pending',
  },
  {
    name: 'Amazon Canada',
    logo: 'https://logo.clearbit.com/amazon.ca',
    website: 'https://www.amazon.ca',
    isActive: true,
    countryCode: 'CA',
    currency: 'CAD',
    affiliateProgram: 'amazon_associates',
    affiliateStatus: 'pending',
  },
  {
    name: 'Canada Computers',
    logo: 'https://logo.clearbit.com/canadacomputers.com',
    website: 'https://www.canadacomputers.com',
    isActive: true,
    countryCode: 'CA',
    currency: 'CAD',
    affiliateProgram: 'none',
    affiliateStatus: 'inactive',
  },
  {
    name: 'Memory Express',
    logo: 'https://logo.clearbit.com/memoryexpress.com',
    website: 'https://www.memoryexpress.com',
    isActive: true,
    countryCode: 'CA',
    currency: 'CAD',
    affiliateProgram: 'none',
    affiliateStatus: 'inactive',
  },
  {
    name: 'Newegg Canada',
    logo: 'https://logo.clearbit.com/newegg.ca',
    website: 'https://www.newegg.ca',
    isActive: true,
    countryCode: 'CA',
    currency: 'CAD',
    affiliateProgram: 'newegg_affiliate',
    affiliateStatus: 'pending',
  },
];

// ============================================================================
// Electronics Products Data - Curated for Canadian Market
// ============================================================================

interface ProductSeed {
  name: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  image: string;
  // Price ranges for generating realistic offers (in CAD)
  priceRange: { min: number; max: number };
}

const ELECTRONICS_PRODUCTS: ProductSeed[] = [
  // ===== SMARTPHONES (10) =====
  {
    name: 'Apple iPhone 15 Pro 256GB',
    description:
      'Latest iPhone with A17 Pro chip, titanium design, Action button, and 48MP camera system',
    category: 'Electronics',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=300&fit=crop',
    priceRange: { min: 1549, max: 1699 },
  },
  {
    name: 'Apple iPhone 15 128GB',
    description:
      'iPhone 15 with Dynamic Island, A16 Bionic chip, and 48MP main camera',
    category: 'Electronics',
    brand: 'Apple',
    model: 'iPhone 15',
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=300&fit=crop',
    priceRange: { min: 1129, max: 1249 },
  },
  {
    name: 'Samsung Galaxy S24 Ultra 256GB',
    description:
      'Premium Android with Galaxy AI, S Pen, 200MP camera, and Snapdragon 8 Gen 3',
    category: 'Electronics',
    brand: 'Samsung',
    model: 'Galaxy S24 Ultra',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop',
    priceRange: { min: 1649, max: 1799 },
  },
  {
    name: 'Samsung Galaxy S24 128GB',
    description: 'Galaxy S24 with Galaxy AI, 50MP camera, and all-day battery',
    category: 'Electronics',
    brand: 'Samsung',
    model: 'Galaxy S24',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop',
    priceRange: { min: 1099, max: 1199 },
  },
  {
    name: 'Google Pixel 8 Pro 256GB',
    description: 'Google flagship with Tensor G3, 7 years of updates, and best-in-class AI features',
    category: 'Electronics',
    brand: 'Google',
    model: 'Pixel 8 Pro',
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&h=300&fit=crop',
    priceRange: { min: 1179, max: 1299 },
  },
  {
    name: 'Google Pixel 8 128GB',
    description: 'Google Pixel 8 with Tensor G3 chip and 7 years of OS updates',
    category: 'Electronics',
    brand: 'Google',
    model: 'Pixel 8',
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&h=300&fit=crop',
    priceRange: { min: 899, max: 999 },
  },
  {
    name: 'Samsung Galaxy A54 5G 128GB',
    description: 'Mid-range Galaxy with 120Hz display, 50MP camera, and water resistance',
    category: 'Electronics',
    brand: 'Samsung',
    model: 'Galaxy A54',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop',
    priceRange: { min: 499, max: 579 },
  },
  {
    name: 'OnePlus 12 256GB',
    description: 'OnePlus flagship with Snapdragon 8 Gen 3, Hasselblad cameras, and 100W charging',
    category: 'Electronics',
    brand: 'OnePlus',
    model: 'OnePlus 12',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop',
    priceRange: { min: 1099, max: 1199 },
  },
  {
    name: 'Apple iPhone 14 128GB',
    description: 'iPhone 14 with A15 Bionic, crash detection, and emergency SOS via satellite',
    category: 'Electronics',
    brand: 'Apple',
    model: 'iPhone 14',
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=300&fit=crop',
    priceRange: { min: 979, max: 1099 },
  },
  {
    name: 'Samsung Galaxy Z Fold5 256GB',
    description: 'Foldable phone with 7.6" main display, Flex Mode, and S Pen support',
    category: 'Electronics',
    brand: 'Samsung',
    model: 'Galaxy Z Fold5',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop',
    priceRange: { min: 2259, max: 2399 },
  },

  // ===== LAPTOPS (10) =====
  {
    name: 'Apple MacBook Pro 14" M3',
    description: 'Professional laptop with M3 chip, Liquid Retina XDR display, and 18-hour battery',
    category: 'Electronics',
    brand: 'Apple',
    model: 'MacBook Pro 14',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',
    priceRange: { min: 2299, max: 2499 },
  },
  {
    name: 'Apple MacBook Air 15" M3',
    description: 'Thin and light MacBook Air with M3 chip and 15.3" Liquid Retina display',
    category: 'Electronics',
    brand: 'Apple',
    model: 'MacBook Air 15',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',
    priceRange: { min: 1799, max: 1999 },
  },
  {
    name: 'Dell XPS 15 (2024)',
    description: 'Premium Windows laptop with Intel Core Ultra, OLED display option',
    category: 'Electronics',
    brand: 'Dell',
    model: 'XPS 15',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',
    priceRange: { min: 1899, max: 2199 },
  },
  {
    name: 'Dell XPS 13 Plus',
    description: 'Ultra-portable XPS with edge-to-edge keyboard and capacitive function row',
    category: 'Electronics',
    brand: 'Dell',
    model: 'XPS 13 Plus',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',
    priceRange: { min: 1549, max: 1799 },
  },
  {
    name: 'Lenovo ThinkPad X1 Carbon Gen 11',
    description: 'Business ultrabook with Intel vPro, military-grade durability, and 28-hour battery',
    category: 'Electronics',
    brand: 'Lenovo',
    model: 'ThinkPad X1 Carbon',
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400&h=300&fit=crop',
    priceRange: { min: 2199, max: 2599 },
  },
  {
    name: 'ASUS ROG Zephyrus G14 (2024)',
    description: 'Gaming laptop with AMD Ryzen 9, RTX 4070, and Nebula HDR display',
    category: 'Electronics',
    brand: 'ASUS',
    model: 'ROG Zephyrus G14',
    image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&h=300&fit=crop',
    priceRange: { min: 2199, max: 2499 },
  },
  {
    name: 'HP Spectre x360 14',
    description: 'Premium 2-in-1 convertible with OLED display and Intel Evo certification',
    category: 'Electronics',
    brand: 'HP',
    model: 'Spectre x360 14',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',
    priceRange: { min: 1699, max: 1999 },
  },
  {
    name: 'Acer Swift Go 14',
    description: 'Lightweight laptop with Intel Core Ultra and 2.8K OLED display',
    category: 'Electronics',
    brand: 'Acer',
    model: 'Swift Go 14',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',
    priceRange: { min: 1099, max: 1299 },
  },
  {
    name: 'Apple MacBook Air 13" M3',
    description: 'Fanless MacBook Air with M3 chip and 18-hour battery life',
    category: 'Electronics',
    brand: 'Apple',
    model: 'MacBook Air 13',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',
    priceRange: { min: 1499, max: 1649 },
  },
  {
    name: 'ASUS Zenbook 14 OLED',
    description: 'Ultralight laptop with 14" OLED display and Intel Core Ultra',
    category: 'Electronics',
    brand: 'ASUS',
    model: 'Zenbook 14 OLED',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',
    priceRange: { min: 1199, max: 1399 },
  },

  // ===== GAMING (10) =====
  {
    name: 'Sony PlayStation 5 Console',
    description: 'Next-gen gaming console with ultra-high speed SSD and DualSense controller',
    category: 'Electronics',
    brand: 'Sony',
    model: 'PlayStation 5',
    image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=300&fit=crop',
    priceRange: { min: 629, max: 699 },
  },
  {
    name: 'Sony PlayStation 5 Digital Edition',
    description: 'PS5 Digital Edition with no disc drive for all-digital gaming',
    category: 'Electronics',
    brand: 'Sony',
    model: 'PlayStation 5 Digital',
    image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=300&fit=crop',
    priceRange: { min: 549, max: 599 },
  },
  {
    name: 'Microsoft Xbox Series X',
    description: '4K gaming at 120fps with 1TB SSD and backwards compatibility',
    category: 'Electronics',
    brand: 'Microsoft',
    model: 'Xbox Series X',
    image: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=400&h=300&fit=crop',
    priceRange: { min: 599, max: 649 },
  },
  {
    name: 'Microsoft Xbox Series S',
    description: 'Compact next-gen Xbox with 512GB SSD for digital gaming',
    category: 'Electronics',
    brand: 'Microsoft',
    model: 'Xbox Series S',
    image: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=400&h=300&fit=crop',
    priceRange: { min: 379, max: 429 },
  },
  {
    name: 'Nintendo Switch OLED',
    description: '7-inch OLED screen with enhanced audio and 64GB internal storage',
    category: 'Electronics',
    brand: 'Nintendo',
    model: 'Switch OLED',
    image: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=400&h=300&fit=crop',
    priceRange: { min: 449, max: 479 },
  },
  {
    name: 'Valve Steam Deck OLED 512GB',
    description: 'Portable PC gaming with HDR OLED display and SteamOS',
    category: 'Electronics',
    brand: 'Valve',
    model: 'Steam Deck OLED',
    image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=300&fit=crop',
    priceRange: { min: 649, max: 729 },
  },
  {
    name: 'Meta Quest 3 128GB',
    description: 'Mixed reality VR headset with breakthrough graphics and passthrough',
    category: 'Electronics',
    brand: 'Meta',
    model: 'Quest 3',
    image: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=400&h=300&fit=crop',
    priceRange: { min: 649, max: 699 },
  },
  {
    name: 'Razer BlackWidow V4 Pro Keyboard',
    description: 'Mechanical gaming keyboard with command dial and Razer Green switches',
    category: 'Electronics',
    brand: 'Razer',
    model: 'BlackWidow V4 Pro',
    image: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=400&h=300&fit=crop',
    priceRange: { min: 279, max: 329 },
  },
  {
    name: 'Logitech G Pro X Superlight 2',
    description: 'Ultra-lightweight wireless gaming mouse at 60 grams',
    category: 'Electronics',
    brand: 'Logitech',
    model: 'G Pro X Superlight 2',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=300&fit=crop',
    priceRange: { min: 199, max: 229 },
  },
  {
    name: 'SteelSeries Arctis Nova Pro Wireless',
    description: 'Premium gaming headset with active noise cancellation and dual wireless',
    category: 'Electronics',
    brand: 'SteelSeries',
    model: 'Arctis Nova Pro',
    image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=300&fit=crop',
    priceRange: { min: 449, max: 499 },
  },

  // ===== AUDIO (10) =====
  {
    name: 'Apple AirPods Pro (2nd Gen)',
    description: 'Active noise cancellation with Adaptive Transparency and USB-C',
    category: 'Electronics',
    brand: 'Apple',
    model: 'AirPods Pro 2',
    image: 'https://images.unsplash.com/photo-1606041008023-472dfb5e530f?w=400&h=300&fit=crop',
    priceRange: { min: 299, max: 349 },
  },
  {
    name: 'Apple AirPods Max',
    description: 'Over-ear headphones with computational audio and spatial audio',
    category: 'Electronics',
    brand: 'Apple',
    model: 'AirPods Max',
    image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=300&fit=crop',
    priceRange: { min: 699, max: 779 },
  },
  {
    name: 'Sony WH-1000XM5',
    description: 'Industry-leading noise cancellation with 30-hour battery life',
    category: 'Electronics',
    brand: 'Sony',
    model: 'WH-1000XM5',
    image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=300&fit=crop',
    priceRange: { min: 449, max: 499 },
  },
  {
    name: 'Sony WF-1000XM5',
    description: 'Truly wireless earbuds with best-in-class noise cancellation',
    category: 'Electronics',
    brand: 'Sony',
    model: 'WF-1000XM5',
    image: 'https://images.unsplash.com/photo-1606041008023-472dfb5e530f?w=400&h=300&fit=crop',
    priceRange: { min: 379, max: 429 },
  },
  {
    name: 'Bose QuietComfort Ultra Headphones',
    description: 'Premium noise cancelling headphones with immersive audio',
    category: 'Electronics',
    brand: 'Bose',
    model: 'QuietComfort Ultra',
    image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=300&fit=crop',
    priceRange: { min: 499, max: 549 },
  },
  {
    name: 'Bose QuietComfort Ultra Earbuds',
    description: 'Wireless earbuds with Bose Immersive Audio and world-class ANC',
    category: 'Electronics',
    brand: 'Bose',
    model: 'QC Ultra Earbuds',
    image: 'https://images.unsplash.com/photo-1606041008023-472dfb5e530f?w=400&h=300&fit=crop',
    priceRange: { min: 379, max: 429 },
  },
  {
    name: 'Samsung Galaxy Buds2 Pro',
    description: 'Premium earbuds with 24-bit Hi-Fi audio and intelligent ANC',
    category: 'Electronics',
    brand: 'Samsung',
    model: 'Galaxy Buds2 Pro',
    image: 'https://images.unsplash.com/photo-1606041008023-472dfb5e530f?w=400&h=300&fit=crop',
    priceRange: { min: 239, max: 279 },
  },
  {
    name: 'Sonos Era 300',
    description: 'Spatial audio speaker with Dolby Atmos support',
    category: 'Electronics',
    brand: 'Sonos',
    model: 'Era 300',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&h=300&fit=crop',
    priceRange: { min: 549, max: 599 },
  },
  {
    name: 'JBL Charge 5',
    description: 'Portable Bluetooth speaker with 20-hour battery and IP67 rating',
    category: 'Electronics',
    brand: 'JBL',
    model: 'Charge 5',
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=300&fit=crop',
    priceRange: { min: 179, max: 219 },
  },
  {
    name: 'Apple HomePod (2nd Gen)',
    description: 'Smart speaker with spatial audio, Siri, and smart home hub',
    category: 'Electronics',
    brand: 'Apple',
    model: 'HomePod',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&h=300&fit=crop',
    priceRange: { min: 399, max: 449 },
  },

  // ===== TVs & MONITORS (10) =====
  {
    name: 'LG C4 65" OLED evo 4K TV',
    description: 'OLED TV with α9 AI Processor, Dolby Vision, and webOS 24',
    category: 'Electronics',
    brand: 'LG',
    model: 'C4 OLED 65',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=300&fit=crop',
    priceRange: { min: 2299, max: 2599 },
  },
  {
    name: 'LG C4 55" OLED evo 4K TV',
    description: 'Self-lit OLED pixels with perfect blacks and infinite contrast',
    category: 'Electronics',
    brand: 'LG',
    model: 'C4 OLED 55',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=300&fit=crop',
    priceRange: { min: 1699, max: 1999 },
  },
  {
    name: 'Samsung QN90C 65" Neo QLED 4K',
    description: 'Mini LED TV with Neural Quantum Processor and anti-glare screen',
    category: 'Electronics',
    brand: 'Samsung',
    model: 'QN90C 65',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=300&fit=crop',
    priceRange: { min: 2199, max: 2499 },
  },
  {
    name: 'Sony A95L 65" QD-OLED 4K TV',
    description: 'Flagship QD-OLED TV with Cognitive Processor XR',
    category: 'Electronics',
    brand: 'Sony',
    model: 'A95L 65',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=300&fit=crop',
    priceRange: { min: 3799, max: 4199 },
  },
  {
    name: 'Samsung S95D 55" OLED 4K TV',
    description: 'OLED TV with anti-glare coating and AI upscaling',
    category: 'Electronics',
    brand: 'Samsung',
    model: 'S95D 55',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=300&fit=crop',
    priceRange: { min: 2399, max: 2699 },
  },
  {
    name: 'Dell UltraSharp U2723QE 27" 4K Monitor',
    description: 'Professional 4K monitor with IPS Black technology and USB-C hub',
    category: 'Electronics',
    brand: 'Dell',
    model: 'UltraSharp U2723QE',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop',
    priceRange: { min: 799, max: 899 },
  },
  {
    name: 'Apple Studio Display',
    description: '27-inch 5K Retina display with Center Stage camera and spatial audio',
    category: 'Electronics',
    brand: 'Apple',
    model: 'Studio Display',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop',
    priceRange: { min: 1999, max: 2199 },
  },
  {
    name: 'ASUS ProArt PA32UCG-K 32" 4K HDR',
    description: 'Professional HDR monitor with mini LED and Dolby Vision',
    category: 'Electronics',
    brand: 'ASUS',
    model: 'ProArt PA32UCG',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop',
    priceRange: { min: 4499, max: 4999 },
  },
  {
    name: 'Samsung Odyssey G9 49" Gaming Monitor',
    description: 'Dual QHD curved gaming monitor with 240Hz and 1ms response',
    category: 'Electronics',
    brand: 'Samsung',
    model: 'Odyssey G9',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop',
    priceRange: { min: 1599, max: 1799 },
  },
  {
    name: 'LG 27GP950-B 27" 4K Gaming Monitor',
    description: '4K Nano IPS gaming monitor with 144Hz and HDMI 2.1',
    category: 'Electronics',
    brand: 'LG',
    model: '27GP950-B',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop',
    priceRange: { min: 799, max: 899 },
  },
];

// ============================================================================
// Seeding Functions
// ============================================================================

/**
 * Generate a realistic price within the given range
 */
function generatePrice(min: number, max: number): string {
  const price = min + Math.random() * (max - min);
  // Round to .99 pricing (common retail pattern)
  return (Math.floor(price) + 0.99).toFixed(2);
}

/**
 * Generate an original price (10-25% higher than current)
 */
function generateOriginalPrice(currentPrice: number): string | null {
  // 70% chance of having an original price (on sale)
  if (Math.random() > 0.3) {
    const markup = 1.1 + Math.random() * 0.15; // 10-25% higher
    return (Math.floor(currentPrice * markup) + 0.99).toFixed(2);
  }
  return null;
}

/**
 * Generate a realistic rating (3.5 - 5.0)
 */
function generateRating(): string {
  const rating = 3.5 + Math.random() * 1.5;
  return rating.toFixed(1);
}

/**
 * Generate review count (100 - 15000)
 */
function generateReviewCount(): number {
  return Math.floor(100 + Math.random() * 14900);
}

/**
 * Main seeding function
 */
async function seedElectronicsCA() {
  console.log('🇨🇦 Starting Canadian Electronics Seed...\n');

  try {
    // Step 1: Insert/update Canadian retailers
    console.log('📦 Seeding Canadian retailers...');

    const insertedRetailers: { id: number; name: string }[] = [];

    for (const retailer of CANADIAN_RETAILERS) {
      // Check if retailer already exists
      const existing = await db
        .select()
        .from(retailers)
        .where(eq(retailers.name, retailer.name))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ✓ ${retailer.name} already exists (ID: ${existing[0].id})`);
        insertedRetailers.push({ id: existing[0].id, name: retailer.name });
      } else {
        const [inserted] = await db.insert(retailers).values(retailer).returning();
        console.log(`  + Created ${retailer.name} (ID: ${inserted.id})`);
        insertedRetailers.push({ id: inserted.id, name: inserted.name });
      }
    }

    console.log(`\n✅ ${insertedRetailers.length} Canadian retailers ready\n`);

    // Step 2: Insert products
    console.log('📱 Seeding electronics products...');

    const insertedProducts: { id: number; name: string; priceRange: { min: number; max: number } }[] = [];

    for (const product of ELECTRONICS_PRODUCTS) {
      // Check if product already exists
      const existing = await db
        .select()
        .from(products)
        .where(and(eq(products.name, product.name), eq(products.brand, product.brand)))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ✓ ${product.name} already exists`);
        insertedProducts.push({
          id: existing[0].id,
          name: existing[0].name,
          priceRange: product.priceRange,
        });
      } else {
        const [inserted] = await db
          .insert(products)
          .values({
            name: product.name,
            description: product.description,
            category: product.category,
            brand: product.brand,
            model: product.model,
            image: product.image,
          })
          .returning();
        console.log(`  + Created ${product.name} (ID: ${inserted.id})`);
        insertedProducts.push({
          id: inserted.id,
          name: inserted.name,
          priceRange: product.priceRange,
        });
      }
    }

    console.log(`\n✅ ${insertedProducts.length} products ready\n`);

    // Step 3: Create product offers for each product from random retailers
    console.log('💰 Creating product offers...');

    let offersCreated = 0;
    let offersSkipped = 0;

    for (const product of insertedProducts) {
      // Each product gets offers from 2-4 random retailers
      const numOffers = 2 + Math.floor(Math.random() * 3);
      const shuffledRetailers = [...insertedRetailers].sort(() => Math.random() - 0.5);
      const selectedRetailers = shuffledRetailers.slice(0, numOffers);

      for (const retailer of selectedRetailers) {
        // Check if offer already exists
        const existingOffer = await db
          .select()
          .from(productOffers)
          .where(
            and(
              eq(productOffers.productId, product.id),
              eq(productOffers.retailerId, retailer.id)
            )
          )
          .limit(1);

        if (existingOffer.length > 0) {
          offersSkipped++;
          continue;
        }

        const currentPrice = parseFloat(generatePrice(product.priceRange.min, product.priceRange.max));
        const originalPrice = generateOriginalPrice(currentPrice);

        const offerData = {
          productId: product.id,
          retailerId: retailer.id,
          price: currentPrice.toFixed(2),
          originalPrice: originalPrice,
          availability: Math.random() > 0.1 ? 'in_stock' : 'limited_stock',
          rating: generateRating(),
          reviewCount: generateReviewCount(),
          shippingInfo: 'Free shipping',
          dealType: originalPrice ? (Math.random() > 0.5 ? 'best_price' : null) : null,
          productUrl: `https://${retailer.name.toLowerCase().replace(/\s+/g, '')}.ca/product/${product.id}`,
        };

        await db.insert(productOffers).values(offerData);
        offersCreated++;

        // Also create initial price history entry
        await db.insert(priceHistory).values({
          productOfferId: 0, // Will be updated
          productId: product.id,
          retailerId: retailer.id,
          price: offerData.price,
          originalPrice: offerData.originalPrice,
          availability: offerData.availability,
          rating: offerData.rating,
          reviewCount: offerData.reviewCount,
          source: 'seed',
          confidence: '1.00',
          recordedAt: new Date(),
        });
      }
    }

    console.log(`\n✅ ${offersCreated} offers created (${offersSkipped} skipped - already exist)\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Canadian Electronics Seed Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📦 Retailers: ${insertedRetailers.length}`);
    console.log(`📱 Products:  ${insertedProducts.length}`);
    console.log(`💰 Offers:    ${offersCreated} new, ${offersSkipped} existing`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedElectronicsCA()
    .then(() => {
      console.log('\n✨ Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedElectronicsCA };
