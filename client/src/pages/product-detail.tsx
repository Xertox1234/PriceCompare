import * as React from 'react';
import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { Helmet } from 'react-helmet-async';
import {
  Star,
  BarChart2,
  Share2,
  Truck,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  Check,
  TrendingDown,
  Bell,
  Store,
  Package,
  ExternalLink,
} from 'lucide-react';
import { TemplateHeader } from '@/components/template/header';
import { TemplateFooter } from '@/components/template/footer';
import { ProductCard } from '@/components/template/TemplateProductCard';
// NOTE: Cart functionality removed - PriceCompare is a price comparison platform (TODO 269)
// Users click through to retailers to purchase
import { ShopProvider } from '@/context/shop-context';
import { useShop } from '@/hooks/use-shop';
import { cn } from '@/lib/utils';
import { bestSellerProducts, dealOfTheDayProducts } from '@/data/template-data';
import { WatchlistToggleButton } from '@/components/watchlist/WatchlistToggleButton';

// Mock product data with more details
const mockProductDetails = {
  1: {
    id: 1,
    title: 'Apple Watch Series 9 GPS 45mm Midnight Aluminum Case',
    category: 'Smartwatches',
    brand: 'Apple',
    price: 329,
    oldPrice: 429,
    rating: 4.9,
    reviewCount: 2543,
    sold: 349,
    images: [
      'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800&q=80',
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&q=80',
      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&q=80',
    ],
    colors: ['Midnight', 'Starlight', 'Silver', 'Red'],
    sizes: ['41mm', '45mm'],
    features: [
      { label: 'Brand', value: 'Apple' },
      { label: 'Display', value: 'Always-On Retina' },
      { label: 'Water Resistance', value: '50m' },
      { label: 'Battery Life', value: '18 hours' },
    ],
    about: [
      'The most powerful Apple Watch yet with S9 chip',
      'Double tap gesture for easy one-handed control',
      'Precision Finding for iPhone with Ultra Wideband',
      'Carbon neutral with Sport Loop band',
      'Advanced health features including ECG and Blood Oxygen',
    ],
    retailers: [
      {
        name: 'Amazon',
        price: 329,
        logo: 'https://logo.clearbit.com/amazon.com',
        shipping: 'Free shipping',
      },
      {
        name: 'Best Buy',
        price: 349,
        logo: 'https://logo.clearbit.com/bestbuy.com',
        shipping: '$5.99 shipping',
      },
      {
        name: 'Walmart',
        price: 339,
        logo: 'https://logo.clearbit.com/walmart.com',
        shipping: 'Free shipping',
      },
      {
        name: 'Apple',
        price: 399,
        logo: 'https://logo.clearbit.com/apple.com',
        shipping: 'Free shipping',
      },
    ],
    priceHistory: [
      { date: '2024-01', price: 429 },
      { date: '2024-02', price: 399 },
      { date: '2024-03', price: 379 },
      { date: '2024-04', price: 349 },
      { date: '2024-05', price: 329 },
    ],
  },
};

// Get default product for demo
const getProductById = (id: string) => {
  const numId = parseInt(id);
  if (mockProductDetails[numId as keyof typeof mockProductDetails]) {
    return mockProductDetails[numId as keyof typeof mockProductDetails];
  }
  // Return mock data based on template products
  const templateProduct = [...dealOfTheDayProducts, ...bestSellerProducts].find(
    (p) => p.id === numId
  );
  if (templateProduct) {
    return {
      ...mockProductDetails[1],
      id: templateProduct.id,
      title: templateProduct.title,
      category: templateProduct.category,
      brand: templateProduct.brand,
      price: templateProduct.price,
      oldPrice: templateProduct.oldPrice,
      rating: templateProduct.rating,
      reviewCount: templateProduct.reviewCount,
      images: [templateProduct.imgSrc, templateProduct.imgHover || templateProduct.imgSrc],
    };
  }
  return mockProductDetails[1];
};

function ProductDetailContent() {
  const params = useParams();
  const productId = params.id || '1';
  const product = getProductById(productId);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews' | 'prices'>(
    'description'
  );

  const { toggleCompare } = useShop();

  const discountPercent = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  // Get the best price retailer for the CTA
  const bestRetailer = product.retailers[0];

  // Related products
  const relatedProducts = bestSellerProducts.slice(0, 4).map((p) => ({
    id: p.id,
    name: p.title,
    category: p.category,
    price: p.price,
    originalPrice: p.oldPrice,
    image: p.imgSrc,
    hoverImage: p.imgHover,
    rating: p.rating,
    reviewCount: p.reviewCount,
    retailer: p.brand,
  }));

  return (
    <>
      <Helmet>
        <title>{product.title} | PriceCompare</title>
        <meta
          name="description"
          content={`Compare prices for ${product.title}. Find the best deals from top retailers. ${product.category} - Starting at $${product.price}`}
        />
      </Helmet>

      <div className="bg-background min-h-screen">
      <TemplateHeader />

      {/* Breadcrumb */}
      <div className="border-border border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <Link href="/products" className="text-muted-foreground hover:text-foreground">
              {product.category}
            </Link>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground max-w-[200px] truncate">{product.title}</span>
          </nav>
        </div>
      </div>

      {/* Main Product Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Product Images */}
            <div className="space-y-4">
              {/* Main Image */}
              <div className="bg-muted relative aspect-square overflow-hidden rounded-2xl">
                <img
                  src={product.images[selectedImage]}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
                {discountPercent > 0 && (
                  <div className="bg-destructive text-destructive-foreground absolute top-4 left-4 rounded-lg px-3 py-1 text-sm font-bold">
                    -{discountPercent}%
                  </div>
                )}
              </div>

              {/* Thumbnail Images */}
              <div className="flex gap-3">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={cn(
                      'h-20 w-20 overflow-hidden rounded-lg border-2 transition-all',
                      selectedImage === idx
                        ? 'border-primary ring-primary/20 ring-2'
                        : 'border-border hover:border-muted-foreground'
                    )}
                  >
                    <img src={img} alt={`Product thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              {/* Category & Title */}
              <div>
                <p className="text-muted-foreground mb-2 text-sm">
                  Category:{' '}
                  <Link
                    href={`/products?category=${product.category}`}
                    className="text-primary hover:underline"
                  >
                    {product.category}
                  </Link>
                </p>
                <h1 className="text-foreground text-2xl font-bold lg:text-3xl">{product.title}</h1>
              </div>

              {/* Rating & Sold */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < Math.floor(product.rating) ? 'fill-warning text-warning' : 'text-muted'
                      )}
                    />
                  ))}
                  <span className="text-muted-foreground ml-1">
                    ({product.reviewCount.toLocaleString()} reviews)
                  </span>
                </div>
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground">Sold: {product.sold}</span>
                <Link
                  href={`/products?brand=${product.brand}`}
                  className="text-primary hover:underline"
                >
                  View shop
                </Link>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-primary text-3xl font-bold">${product.price.toFixed(2)}</span>
                {product.oldPrice && (
                  <span className="text-muted-foreground text-xl line-through">
                    ${product.oldPrice.toFixed(2)}
                  </span>
                )}
                {discountPercent > 0 && product.oldPrice && (
                  <span className="text-success flex items-center gap-1 text-sm font-medium">
                    <TrendingDown className="h-4 w-4" />
                    Save ${(product.oldPrice - product.price).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Features */}
              <div className="bg-muted/50 grid grid-cols-2 gap-3 rounded-xl p-4">
                {product.features.map((feature, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-foreground text-sm font-medium">{feature.label}</span>
                    <span className="text-muted-foreground text-sm">{feature.value}</span>
                  </div>
                ))}
              </div>

              {/* Color Selection */}
              {product.colors && (
                <div>
                  <p className="text-foreground mb-3 text-sm font-medium">
                    Color:{' '}
                    <span className="text-muted-foreground">{product.colors[selectedColor]}</span>
                  </p>
                  <div className="flex gap-2">
                    {product.colors.map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedColor(idx)}
                        className={cn(
                          'rounded-lg border px-4 py-2 text-sm transition-all',
                          selectedColor === idx
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-muted-foreground text-foreground'
                        )}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              {product.sizes && (
                <div>
                  <p className="text-foreground mb-3 text-sm font-medium">
                    Size:{' '}
                    <span className="text-muted-foreground">{product.sizes[selectedSize]}</span>
                  </p>
                  <div className="flex gap-2">
                    {product.sizes.map((size, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedSize(idx)}
                        className={cn(
                          'rounded-lg border px-4 py-2 text-sm transition-all',
                          selectedSize === idx
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-muted-foreground text-foreground'
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Best Price CTA */}
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* View Best Price Button */}
                <a
                  href="#price-comparison"
                  className="bg-primary hover:bg-primary-hover flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition-all"
                >
                  <TrendingDown className="h-5 w-5" />
                  Compare Prices Below
                </a>

                {/* Go to Best Retailer */}
                {bestRetailer && (
                  <a
                    href={bestRetailer.logo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-6 py-3 font-semibold text-white transition-all hover:bg-slate-700"
                  >
                    <ExternalLink className="h-5 w-5" />
                    ${bestRetailer.price} at {bestRetailer.name}
                  </a>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <WatchlistToggleButton
                  productId={product.id}
                  variant="outline"
                  size="default"
                  showText={true}
                />
                <button
                  onClick={() => toggleCompare(product.id)}
                  className="border-border hover:border-muted-foreground text-foreground flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all"
                >
                  <BarChart2 className="h-4 w-4" />
                  Compare
                </button>
                <button className="border-border hover:border-muted-foreground text-foreground flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all">
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>

              {/* Shipping Info */}
              <div className="bg-muted/50 space-y-3 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Truck className="text-primary h-5 w-5" />
                  <div>
                    <p className="text-foreground font-medium">Free Shipping</p>
                    <p className="text-muted-foreground text-sm">Delivery in 2-5 business days</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RefreshCw className="text-primary h-5 w-5" />
                  <div>
                    <p className="text-foreground font-medium">Easy Returns</p>
                    <p className="text-muted-foreground text-sm">30 day return policy</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-primary h-5 w-5" />
                  <div>
                    <p className="text-foreground font-medium">Secure Payment</p>
                    <p className="text-muted-foreground text-sm">100% protected checkout</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Price Comparison Section */}
      <section id="price-comparison" className="bg-muted/30 py-8 scroll-mt-4">
        <div className="container mx-auto px-4">
          <h2 className="text-foreground mb-6 flex items-center gap-2 text-xl font-bold">
            <Store className="text-primary h-5 w-5" />
            Compare Prices Across Retailers
          </h2>
          <div className="grid gap-3">
            {product.retailers.map((retailer, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-4 transition-all',
                  idx === 0
                    ? 'bg-success/10 border-success'
                    : 'bg-card border-border hover:border-primary'
                )}
              >
                <div className="flex items-center gap-4">
                  <img
                    src={retailer.logo}
                    alt={retailer.name}
                    className="h-10 w-10 rounded object-contain"
                  />
                  <div>
                    <p className="text-foreground font-medium">{retailer.name}</p>
                    <p className="text-muted-foreground text-sm">{retailer.shipping}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-foreground text-xl font-bold">
                      ${retailer.price.toFixed(2)}
                    </p>
                    {idx === 0 && (
                      <span className="text-success text-xs font-medium">Best Price</span>
                    )}
                  </div>
                  <a
                    href="#"
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-medium transition-all',
                      idx === 0
                        ? 'bg-success hover:bg-success/90 text-white'
                        : 'bg-primary hover:bg-primary-hover text-white'
                    )}
                  >
                    Go to Store
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Price Alert */}
          <div className="bg-primary/10 border-primary/20 mt-6 flex items-center justify-between rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <Bell className="text-primary h-5 w-5" />
              <div>
                <p className="text-foreground font-medium">Set a Price Alert</p>
                <p className="text-muted-foreground text-sm">
                  Get notified when the price drops below your target
                </p>
              </div>
            </div>
            <button className="bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 text-sm font-medium text-white transition-all">
              Set Alert
            </button>
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          {/* Tab Headers */}
          <div className="border-border mb-6 flex gap-1 border-b">
            {[
              { id: 'description', label: 'About This Item' },
              { id: 'specs', label: 'Specifications' },
              { id: 'reviews', label: `Reviews (${product.reviewCount})` },
              { id: 'prices', label: 'Price History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  '-mb-[2px] border-b-2 px-6 py-3 text-sm font-medium transition-all',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[200px]">
            {activeTab === 'description' && (
              <div className="space-y-4">
                <h3 className="text-foreground text-lg font-semibold">About this item</h3>
                <ul className="space-y-2">
                  {product.about.map((item, idx) => (
                    <li key={idx} className="text-muted-foreground flex items-start gap-2">
                      <Check className="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="grid gap-4 md:grid-cols-2">
                {product.features.map((feature, idx) => (
                  <div key={idx} className="bg-muted/50 flex justify-between rounded-lg p-3">
                    <span className="text-foreground font-medium">{feature.label}</span>
                    <span className="text-muted-foreground">{feature.value}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Reviews coming soon...</p>
              </div>
            )}

            {activeTab === 'prices' && (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Price history chart coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Related Products */}
      <section className="bg-muted/30 py-8">
        <div className="container mx-auto px-4">
          <h2 className="text-foreground mb-6 flex items-center gap-2 text-xl font-bold">
            <Package className="text-primary h-5 w-5" />
            You May Also Like
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {relatedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onCompare={() => toggleCompare(product.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <TemplateFooter />
    </div>
    </>
  );
}

export default function ProductDetailPage() {
  return (
    <ShopProvider>
      <ProductDetailContent />
    </ShopProvider>
  );
}
