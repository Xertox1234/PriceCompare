// Template Data - Mock data for Home 5 Template
// Matches the structure from Onsus template

export interface TemplateProduct {
  id: number;
  title: string;
  slug: string;
  imgSrc: string;
  imgHover?: string;
  price: number;
  oldPrice?: number;
  salePercentage?: string;
  rating: number;
  reviewCount: number;
  category: string;
  brand: string;
  inStock: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  isHot?: boolean;
  // Deal of the day specific
  countdownTimer?: number; // seconds until deal ends
  sold?: number;
  available?: number;
}

export interface TemplateCategory {
  id: number;
  name: string;
  slug: string;
  image: string;
  productCount: number;
  icon?: string;
}

export interface TemplateBanner {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  image: string;
  link: string;
  buttonText: string;
  badge?: string;
  price?: number;
  discount?: string;
}

export interface TemplateBlog {
  id: number;
  title: string;
  slug: string;
  image: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
}

export interface TemplateBrand {
  id: number;
  name: string;
  logo: string;
  link: string;
}

export interface TemplateFeature {
  id: number;
  icon: string;
  title: string;
  description: string;
}

// =============================================================================
// PRODUCTS DATA
// =============================================================================

export const dealOfTheDayProducts: TemplateProduct[] = [
  {
    id: 1,
    title: 'Apple Watch Series 9 GPS 45mm Midnight Aluminum Case',
    slug: 'apple-watch-series-9',
    imgSrc: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&q=80',
    price: 329,
    oldPrice: 429,
    salePercentage: '23%',
    rating: 4.9,
    reviewCount: 2543,
    category: 'Smartwatches',
    brand: 'Apple',
    inStock: true,
    countdownTimer: 86400, // 24 hours
    sold: 57,
    available: 43,
  },
  {
    id: 2,
    title: 'Canon EOS R6 Mark II Full-Frame Mirrorless Camera',
    slug: 'canon-eos-r6-mark-ii',
    imgSrc: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&q=80',
    price: 2299,
    oldPrice: 2499,
    salePercentage: '8%',
    rating: 4.8,
    reviewCount: 892,
    category: 'Cameras',
    brand: 'Canon',
    inStock: true,
    countdownTimer: 43200, // 12 hours
    sold: 32,
    available: 18,
  },
  {
    id: 3,
    title: 'Samsung Galaxy S24 Ultra 256GB Titanium Black',
    slug: 'samsung-galaxy-s24-ultra',
    imgSrc: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&q=80',
    price: 1099,
    oldPrice: 1299,
    salePercentage: '15%',
    rating: 4.7,
    reviewCount: 3421,
    category: 'Smartphones',
    brand: 'Samsung',
    inStock: true,
    countdownTimer: 72000, // 20 hours
    sold: 124,
    available: 76,
  },
  {
    id: 4,
    title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    slug: 'sony-wh-1000xm5',
    imgSrc: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&q=80',
    price: 328,
    oldPrice: 399,
    salePercentage: '18%',
    rating: 4.9,
    reviewCount: 4521,
    category: 'Audio',
    brand: 'Sony',
    inStock: true,
    countdownTimer: 54000, // 15 hours
    sold: 89,
    available: 61,
  },
];

export const bestSellerProducts: TemplateProduct[] = [
  {
    id: 5,
    title: 'MacBook Pro 14" M3 Pro 512GB Space Black',
    slug: 'macbook-pro-14-m3-pro',
    imgSrc: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&q=80',
    price: 1799,
    oldPrice: 1999,
    salePercentage: '10%',
    rating: 4.9,
    reviewCount: 1892,
    category: 'Laptops',
    brand: 'Apple',
    inStock: true,
    isBestSeller: true,
  },
  {
    id: 6,
    title: 'PlayStation 5 Console Slim Edition',
    slug: 'playstation-5-slim',
    imgSrc: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600&q=80',
    price: 449,
    oldPrice: 499,
    salePercentage: '10%',
    rating: 4.8,
    reviewCount: 5632,
    category: 'Gaming',
    brand: 'Sony',
    inStock: true,
    isBestSeller: true,
  },
  {
    id: 7,
    title: 'iPad Pro 12.9" M2 256GB WiFi Space Gray',
    slug: 'ipad-pro-12-9-m2',
    imgSrc: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=600&q=80',
    price: 999,
    oldPrice: 1099,
    salePercentage: '9%',
    rating: 4.8,
    reviewCount: 2341,
    category: 'Tablets',
    brand: 'Apple',
    inStock: true,
    isBestSeller: true,
  },
  {
    id: 8,
    title: 'LG C3 65" OLED evo 4K Smart TV',
    slug: 'lg-c3-65-oled',
    imgSrc: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1461151304267-38535e780c79?w=600&q=80',
    price: 1496,
    oldPrice: 1799,
    salePercentage: '17%',
    rating: 4.8,
    reviewCount: 2134,
    category: 'TVs',
    brand: 'LG',
    inStock: true,
    isBestSeller: true,
  },
  {
    id: 9,
    title: 'AirPods Pro 2nd Generation with MagSafe Case',
    slug: 'airpods-pro-2',
    imgSrc: 'https://images.unsplash.com/photo-1588423771073-b8903fba77ac?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&q=80',
    price: 199,
    oldPrice: 249,
    salePercentage: '20%',
    rating: 4.8,
    reviewCount: 8765,
    category: 'Audio',
    brand: 'Apple',
    inStock: true,
    isBestSeller: true,
  },
  {
    id: 10,
    title: 'Nintendo Switch OLED Model White',
    slug: 'nintendo-switch-oled',
    imgSrc: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=600&q=80',
    price: 299,
    oldPrice: 349,
    salePercentage: '14%',
    rating: 4.9,
    reviewCount: 4532,
    category: 'Gaming',
    brand: 'Nintendo',
    inStock: true,
    isBestSeller: true,
  },
  {
    id: 11,
    title: 'Dyson V15 Detect Cordless Vacuum',
    slug: 'dyson-v15-detect',
    imgSrc: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&q=80',
    price: 599,
    oldPrice: 749,
    salePercentage: '20%',
    rating: 4.6,
    reviewCount: 1234,
    category: 'Home',
    brand: 'Dyson',
    inStock: true,
    isBestSeller: true,
  },
  {
    id: 12,
    title: 'Bose QuietComfort Ultra Headphones',
    slug: 'bose-quietcomfort-ultra',
    imgSrc: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&q=80',
    price: 379,
    oldPrice: 429,
    salePercentage: '12%',
    rating: 4.7,
    reviewCount: 1567,
    category: 'Audio',
    brand: 'Bose',
    inStock: true,
    isBestSeller: true,
  },
];

export const newArrivalsProducts: TemplateProduct[] = [
  {
    id: 13,
    title: 'GoPro Hero 12 Black Action Camera',
    slug: 'gopro-hero-12',
    imgSrc: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=600&q=80',
    price: 349,
    oldPrice: 399,
    salePercentage: '13%',
    rating: 4.6,
    reviewCount: 876,
    category: 'Cameras',
    brand: 'GoPro',
    inStock: true,
    isNew: true,
  },
  {
    id: 14,
    title: 'DJI Mini 4 Pro Drone with RC 2',
    slug: 'dji-mini-4-pro',
    imgSrc: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=600&q=80',
    price: 759,
    oldPrice: 899,
    salePercentage: '16%',
    rating: 4.7,
    reviewCount: 654,
    category: 'Drones',
    brand: 'DJI',
    inStock: true,
    isNew: true,
  },
  {
    id: 15,
    title: 'Sonos Era 300 Spatial Audio Speaker',
    slug: 'sonos-era-300',
    imgSrc: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1507646227500-4d389b0012be?w=600&q=80',
    price: 399,
    oldPrice: 449,
    salePercentage: '11%',
    rating: 4.5,
    reviewCount: 432,
    category: 'Audio',
    brand: 'Sonos',
    inStock: true,
    isNew: true,
  },
  {
    id: 16,
    title: 'Garmin Fenix 8 Solar Smartwatch',
    slug: 'garmin-fenix-8',
    imgSrc: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&q=80',
    price: 899,
    oldPrice: 999,
    salePercentage: '10%',
    rating: 4.8,
    reviewCount: 321,
    category: 'Smartwatches',
    brand: 'Garmin',
    inStock: true,
    isNew: true,
  },
];

export const trendingProducts: TemplateProduct[] = [
  {
    id: 17,
    title: 'Xbox Series X 1TB Console',
    slug: 'xbox-series-x',
    imgSrc: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1605901309584-818e25960a8f?w=600&q=80',
    price: 449,
    oldPrice: 499,
    rating: 4.7,
    reviewCount: 3421,
    category: 'Gaming',
    brand: 'Microsoft',
    inStock: true,
    isHot: true,
  },
  {
    id: 18,
    title: 'Samsung 990 Pro 2TB NVMe SSD',
    slug: 'samsung-990-pro',
    imgSrc: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1531492746076-161ca9bcad09?w=600&q=80',
    price: 169,
    oldPrice: 229,
    salePercentage: '26%',
    rating: 4.9,
    reviewCount: 2134,
    category: 'Storage',
    brand: 'Samsung',
    inStock: true,
    isHot: true,
  },
  {
    id: 19,
    title: 'Logitech MX Master 3S Wireless Mouse',
    slug: 'logitech-mx-master-3s',
    imgSrc: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&q=80',
    price: 89,
    oldPrice: 99,
    rating: 4.8,
    reviewCount: 4532,
    category: 'Accessories',
    brand: 'Logitech',
    inStock: true,
    isHot: true,
  },
  {
    id: 20,
    title: 'ASUS ROG Strix Gaming Monitor 27" 4K',
    slug: 'asus-rog-strix-monitor',
    imgSrc: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1585792180666-f7347c490ee2?w=600&q=80',
    price: 699,
    oldPrice: 849,
    salePercentage: '18%',
    rating: 4.6,
    reviewCount: 876,
    category: 'Monitors',
    brand: 'ASUS',
    inStock: true,
    isHot: true,
  },
];

// =============================================================================
// CATEGORIES DATA
// =============================================================================

export const categories: TemplateCategory[] = [
  {
    id: 1,
    name: 'Smartphones',
    slug: 'smartphones',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80',
    productCount: 342,
    icon: 'smartphone',
  },
  {
    id: 2,
    name: 'Laptops',
    slug: 'laptops',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80',
    productCount: 218,
    icon: 'laptop',
  },
  {
    id: 3,
    name: 'Cameras',
    slug: 'cameras',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80',
    productCount: 156,
    icon: 'camera',
  },
  {
    id: 4,
    name: 'Audio',
    slug: 'audio',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
    productCount: 287,
    icon: 'headphones',
  },
  {
    id: 5,
    name: 'Gaming',
    slug: 'gaming',
    image: 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&q=80',
    productCount: 423,
    icon: 'gamepad-2',
  },
  {
    id: 6,
    name: 'TVs',
    slug: 'tvs',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&q=80',
    productCount: 98,
    icon: 'tv',
  },
  {
    id: 7,
    name: 'Smartwatches',
    slug: 'smartwatches',
    image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=400&q=80',
    productCount: 176,
    icon: 'watch',
  },
  {
    id: 8,
    name: 'Home',
    slug: 'home',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80',
    productCount: 534,
    icon: 'home',
  },
  {
    id: 9,
    name: 'Tablets',
    slug: 'tablets',
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80',
    productCount: 124,
    icon: 'tablet',
  },
  {
    id: 10,
    name: 'Monitors',
    slug: 'monitors',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80',
    productCount: 189,
    icon: 'monitor',
  },
  {
    id: 11,
    name: 'Drones',
    slug: 'drones',
    image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400&q=80',
    productCount: 67,
    icon: 'plane',
  },
  {
    id: 12,
    name: 'Storage',
    slug: 'storage',
    image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80',
    productCount: 234,
    icon: 'hard-drive',
  },
  {
    id: 13,
    name: 'Accessories',
    slug: 'accessories',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80',
    productCount: 567,
    icon: 'mouse',
  },
  {
    id: 14,
    name: 'Networking',
    slug: 'networking',
    image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80',
    productCount: 145,
    icon: 'wifi',
  },
];

// =============================================================================
// BANNERS DATA
// =============================================================================

export const heroBanners: TemplateBanner[] = [
  {
    id: 1,
    title: 'Amazfit GTS 3 Smartwatch',
    subtitle: 'Let power flow through you',
    description: 'Advanced health tracking with premium design',
    image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=1200&q=80',
    link: '/products?category=smartwatches',
    buttonText: 'Now Available',
    price: 450,
  },
  {
    id: 2,
    title: 'Catch Big Deals on Cameras',
    subtitle: 'Up to 70% off',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
    link: '/products?category=cameras',
    buttonText: 'Shop Now',
    discount: '70%',
    badge: 'Sale',
  },
  {
    id: 3,
    title: 'Premium Audio Experience',
    subtitle: 'Best in class sound',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    link: '/products?category=audio',
    buttonText: 'Explore',
    discount: '40%',
    badge: 'Hot',
  },
];

export const promoBanners: TemplateBanner[] = [
  {
    id: 1,
    title: 'Gaming Week Sale',
    subtitle: 'Save up to $200 on consoles',
    image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&q=80',
    link: '/products?category=gaming',
    buttonText: 'Shop Gaming',
    badge: 'Limited Time',
  },
  {
    id: 2,
    title: 'Smart Home Essentials',
    subtitle: 'Automate your life',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
    link: '/products?category=home',
    buttonText: 'Discover More',
    discount: '30%',
  },
];

// =============================================================================
// FEATURES DATA
// =============================================================================

export const features: TemplateFeature[] = [
  {
    id: 1,
    icon: 'truck',
    title: 'Free Shipping',
    description: 'On orders over $99',
  },
  {
    id: 2,
    icon: 'shield-check',
    title: 'Secure Payment',
    description: '100% secure checkout',
  },
  {
    id: 3,
    icon: 'refresh-cw',
    title: 'Easy Returns',
    description: '30 day return policy',
  },
  {
    id: 4,
    icon: 'headphones',
    title: '24/7 Support',
    description: 'Dedicated support team',
  },
];

// =============================================================================
// BRANDS DATA
// =============================================================================

export const brands: TemplateBrand[] = [
  {
    id: 1,
    name: 'Apple',
    logo: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/apple.svg',
    link: '/products?brand=apple',
  },
  {
    id: 2,
    name: 'Samsung',
    logo: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/samsung.svg',
    link: '/products?brand=samsung',
  },
  {
    id: 3,
    name: 'Sony',
    logo: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/sony.svg',
    link: '/products?brand=sony',
  },
  {
    id: 4,
    name: 'Microsoft',
    logo: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/microsoft.svg',
    link: '/products?brand=microsoft',
  },
  {
    id: 5,
    name: 'LG',
    logo: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/lg.svg',
    link: '/products?brand=lg',
  },
  {
    id: 6,
    name: 'Canon',
    logo: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/canon.svg',
    link: '/products?brand=canon',
  },
];

// =============================================================================
// BLOGS DATA
// =============================================================================

export const blogs: TemplateBlog[] = [
  {
    id: 1,
    title: 'Best Budget Smartphones of 2024',
    slug: 'best-budget-smartphones-2024',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80',
    excerpt:
      'Discover the top affordable smartphones that offer premium features without breaking the bank.',
    category: 'Smartphones',
    author: 'Tech Team',
    date: '2024-03-15',
    readTime: '5 min read',
  },
  {
    id: 2,
    title: 'Gaming Monitor Buying Guide',
    slug: 'gaming-monitor-buying-guide',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&q=80',
    excerpt: 'Everything you need to know before buying your next gaming monitor.',
    category: 'Gaming',
    author: 'Gaming Expert',
    date: '2024-03-10',
    readTime: '8 min read',
  },
  {
    id: 3,
    title: 'Wireless Earbuds Comparison',
    slug: 'wireless-earbuds-comparison',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80',
    excerpt: 'We compare the top wireless earbuds from Apple, Sony, and Samsung.',
    category: 'Audio',
    author: 'Audio Reviewer',
    date: '2024-03-05',
    readTime: '6 min read',
  },
];

// =============================================================================
// MENU DATA
// =============================================================================

export interface MenuItem {
  id: number;
  label: string;
  link: string;
  megaMenu?: {
    categories: {
      title: string;
      items: { label: string; link: string }[];
    }[];
    featured?: {
      image: string;
      title: string;
      link: string;
    };
  };
}

export const menuItems: MenuItem[] = [
  {
    id: 1,
    label: 'Electronics',
    link: '/shop?category=electronics',
    megaMenu: {
      categories: [
        {
          title: 'Computers',
          items: [
            { label: 'Laptops', link: '/shop?category=laptops' },
            { label: 'Desktops', link: '/shop?category=desktops' },
            { label: 'Monitors', link: '/shop?category=monitors' },
            { label: 'Accessories', link: '/shop?category=computer-accessories' },
          ],
        },
        {
          title: 'Mobile',
          items: [
            { label: 'Smartphones', link: '/shop?category=smartphones' },
            { label: 'Tablets', link: '/shop?category=tablets' },
            { label: 'Cases & Covers', link: '/shop?category=cases' },
            { label: 'Chargers', link: '/shop?category=chargers' },
          ],
        },
        {
          title: 'Audio',
          items: [
            { label: 'Headphones', link: '/shop?category=headphones' },
            { label: 'Speakers', link: '/shop?category=speakers' },
            { label: 'Earbuds', link: '/shop?category=earbuds' },
            { label: 'Soundbars', link: '/shop?category=soundbars' },
          ],
        },
      ],
      featured: {
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80',
        title: 'MacBook Pro M3',
        link: '/product/1',
      },
    },
  },
  {
    id: 2,
    label: 'Gaming',
    link: '/shop?category=gaming',
    megaMenu: {
      categories: [
        {
          title: 'Consoles',
          items: [
            { label: 'PlayStation', link: '/shop?brand=playstation' },
            { label: 'Xbox', link: '/shop?brand=xbox' },
            { label: 'Nintendo', link: '/shop?brand=nintendo' },
          ],
        },
        {
          title: 'PC Gaming',
          items: [
            { label: 'Gaming Laptops', link: '/shop?category=gaming-laptops' },
            { label: 'Gaming Desktops', link: '/shop?category=gaming-desktops' },
            { label: 'Graphics Cards', link: '/shop?category=gpus' },
          ],
        },
        {
          title: 'Accessories',
          items: [
            { label: 'Controllers', link: '/shop?category=controllers' },
            { label: 'Gaming Headsets', link: '/shop?category=gaming-headsets' },
            { label: 'Gaming Chairs', link: '/shop?category=gaming-chairs' },
          ],
        },
      ],
    },
  },
  {
    id: 3,
    label: 'Cameras',
    link: '/shop?category=cameras',
  },
  {
    id: 4,
    label: 'Audio',
    link: '/shop?category=audio',
  },
  {
    id: 5,
    label: 'Smart Home',
    link: '/shop?category=smart-home',
  },
  {
    id: 6,
    label: 'Deals',
    link: '/shop?deals=true',
  },
];

// =============================================================================
// LAPTOPS & COMPUTERS PRODUCTS
// =============================================================================

export const laptopsProducts: TemplateProduct[] = [
  {
    id: 21,
    title: 'Dell XPS 15 OLED 15.6" Intel Core i7',
    slug: 'dell-xps-15-oled',
    imgSrc: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&q=80',
    price: 1599,
    oldPrice: 1899,
    salePercentage: '16%',
    rating: 4.7,
    reviewCount: 892,
    category: 'Laptops',
    brand: 'Dell',
    inStock: true,
  },
  {
    id: 22,
    title: 'ASUS ROG Zephyrus G14 Gaming Laptop',
    slug: 'asus-rog-zephyrus-g14',
    imgSrc: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&q=80',
    price: 1449,
    oldPrice: 1699,
    salePercentage: '15%',
    rating: 4.8,
    reviewCount: 1234,
    category: 'Laptops',
    brand: 'ASUS',
    inStock: true,
  },
  {
    id: 23,
    title: 'Surface Pro 9 with Keyboard 13" i5',
    slug: 'surface-pro-9',
    imgSrc: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80',
    price: 1299,
    oldPrice: 1499,
    rating: 4.6,
    reviewCount: 654,
    category: 'Tablets',
    brand: 'Microsoft',
    inStock: true,
  },
  {
    id: 24,
    title: 'HP Spectre x360 16" 2-in-1 Laptop',
    slug: 'hp-spectre-x360',
    imgSrc: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&q=80',
    price: 1399,
    oldPrice: 1599,
    rating: 4.5,
    reviewCount: 432,
    category: 'Laptops',
    brand: 'HP',
    inStock: true,
  },
];

// =============================================================================
// SMART HOME PRODUCTS
// =============================================================================

export const smartHomeProducts: TemplateProduct[] = [
  {
    id: 25,
    title: 'Amazon Echo Show 10 3rd Gen Smart Display',
    slug: 'echo-show-10',
    imgSrc: 'https://images.unsplash.com/photo-1543512214-318c7553f230?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1558089687-f282ffcbc126?w=600&q=80',
    price: 199,
    oldPrice: 249,
    salePercentage: '20%',
    rating: 4.5,
    reviewCount: 3245,
    category: 'Home',
    brand: 'Amazon',
    inStock: true,
  },
  {
    id: 26,
    title: 'Google Nest Hub Max 10" Smart Display',
    slug: 'nest-hub-max',
    imgSrc: 'https://images.unsplash.com/photo-1558089687-f282ffcbc126?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1543512214-318c7553f230?w=600&q=80',
    price: 179,
    oldPrice: 229,
    rating: 4.6,
    reviewCount: 2134,
    category: 'Home',
    brand: 'Google',
    inStock: true,
  },
  {
    id: 27,
    title: 'Philips Hue Starter Kit E26 White & Color',
    slug: 'philips-hue-starter',
    imgSrc: 'https://images.unsplash.com/photo-1557825835-70d97c4aa567?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=600&q=80',
    price: 149,
    oldPrice: 199,
    salePercentage: '25%',
    rating: 4.7,
    reviewCount: 4532,
    category: 'Home',
    brand: 'Philips',
    inStock: true,
  },
  {
    id: 28,
    title: 'Ring Video Doorbell Pro 2 with Chime',
    slug: 'ring-doorbell-pro-2',
    imgSrc: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80',
    price: 219,
    oldPrice: 279,
    rating: 4.4,
    reviewCount: 1876,
    category: 'Home',
    brand: 'Ring',
    inStock: true,
  },
  {
    id: 29,
    title: 'Roomba j7+ Robot Vacuum with Auto-Empty',
    slug: 'roomba-j7-plus',
    imgSrc: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&q=80',
    price: 699,
    oldPrice: 849,
    salePercentage: '18%',
    rating: 4.6,
    reviewCount: 2341,
    category: 'Home',
    brand: 'iRobot',
    inStock: true,
  },
  {
    id: 30,
    title: 'Ecobee Smart Thermostat Premium',
    slug: 'ecobee-premium',
    imgSrc: 'https://images.unsplash.com/photo-1567769541715-8c71fe49fd43?w=600&q=80',
    imgHover: 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=600&q=80',
    price: 229,
    oldPrice: 279,
    rating: 4.5,
    reviewCount: 987,
    category: 'Home',
    brand: 'Ecobee',
    inStock: true,
  },
];

// =============================================================================
// ALL PRODUCTS (Combined)
// =============================================================================

// Remove duplicate products by ID and combine all arrays
const seenIds = new Set<number>();
export const allProducts: TemplateProduct[] = [
  ...dealOfTheDayProducts,
  ...bestSellerProducts,
  ...newArrivalsProducts,
  ...trendingProducts,
  ...laptopsProducts,
  ...smartHomeProducts,
].filter((product) => {
  if (seenIds.has(product.id)) {
    return false;
  }
  seenIds.add(product.id);
  return true;
});
