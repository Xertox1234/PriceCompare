import * as React from 'react';
import { useState } from 'react';
import { useParams, Link } from 'wouter';
import {
  Star,
  Heart,
  BarChart2,
  Share2,
  Truck,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  Check,
  TrendingDown,
  Bell,
  Store,
  Package
} from 'lucide-react';
import { TemplateHeader } from '@/components/template/header';
import { TemplateFooter } from '@/components/template/footer';
import { ProductCard } from '@/components/template/product-card';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { ShopProvider } from '@/context/shop-context';
import { useShop } from '@/hooks/use-shop';
import { cn } from '@/lib/utils';
import {
  bestSellerProducts,
  dealOfTheDayProducts,
} from '@/data/template-data';

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
      { name: 'Amazon', price: 329, logo: 'https://logo.clearbit.com/amazon.com', shipping: 'Free shipping' },
      { name: 'Best Buy', price: 349, logo: 'https://logo.clearbit.com/bestbuy.com', shipping: '$5.99 shipping' },
      { name: 'Walmart', price: 339, logo: 'https://logo.clearbit.com/walmart.com', shipping: 'Free shipping' },
      { name: 'Apple', price: 399, logo: 'https://logo.clearbit.com/apple.com', shipping: 'Free shipping' },
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
  const templateProduct = [...dealOfTheDayProducts, ...bestSellerProducts].find(p => p.id === numId);
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
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews' | 'prices'>('description');

  const { toggleWishlist, isInWishlist, addSimpleToCart, isInCart, toggleCompare, openCart } = useShop();

  const discountPercent = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const handleAddToCart = () => {
    addSimpleToCart({
      id: product.id,
      name: product.title,
      price: product.price,
      image: product.images[0],
      quantity,
    });
    openCart();
  };

  // Related products
  const relatedProducts = bestSellerProducts.slice(0, 4).map(p => ({
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
    <div className="min-h-screen bg-background">
      <TemplateHeader onOpenCart={openCart} />
      <CartSidebar />

      {/* Breadcrumb */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">Home</Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Link href="/products" className="text-muted-foreground hover:text-foreground">{product.category}</Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground truncate max-w-[200px]">{product.title}</span>
          </nav>
        </div>
      </div>

      {/* Main Product Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

            {/* Product Images */}
            <div className="space-y-4">
              {/* Main Image */}
              <div className="relative aspect-square bg-muted rounded-2xl overflow-hidden">
                <img
                  src={product.images[selectedImage]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
                {discountPercent > 0 && (
                  <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground text-sm font-bold px-3 py-1 rounded-lg">
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
                      "w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                      selectedImage === idx
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              {/* Category & Title */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Category: <Link href={`/products?category=${product.category}`} className="text-primary hover:underline">{product.category}</Link>
                </p>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                  {product.title}
                </h1>
              </div>

              {/* Rating & Sold */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4",
                        i < Math.floor(product.rating) ? "fill-warning text-warning" : "text-muted"
                      )}
                    />
                  ))}
                  <span className="text-muted-foreground ml-1">({product.reviewCount.toLocaleString()} reviews)</span>
                </div>
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground">Sold: {product.sold}</span>
                <Link href={`/products?brand=${product.brand}`} className="text-primary hover:underline">
                  View shop
                </Link>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary">${product.price.toFixed(2)}</span>
                {product.oldPrice && (
                  <span className="text-xl text-muted-foreground line-through">${product.oldPrice.toFixed(2)}</span>
                )}
                {discountPercent > 0 && (
                  <span className="text-sm font-medium text-success flex items-center gap-1">
                    <TrendingDown className="h-4 w-4" />
                    Save ${(product.oldPrice! - product.price).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-xl">
                {product.features.map((feature, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-sm font-medium text-foreground">{feature.label}</span>
                    <span className="text-sm text-muted-foreground">{feature.value}</span>
                  </div>
                ))}
              </div>

              {/* Color Selection */}
              {product.colors && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">
                    Color: <span className="text-muted-foreground">{product.colors[selectedColor]}</span>
                  </p>
                  <div className="flex gap-2">
                    {product.colors.map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedColor(idx)}
                        className={cn(
                          "px-4 py-2 rounded-lg border text-sm transition-all",
                          selectedColor === idx
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground text-foreground"
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
                  <p className="text-sm font-medium text-foreground mb-3">
                    Size: <span className="text-muted-foreground">{product.sizes[selectedSize]}</span>
                  </p>
                  <div className="flex gap-2">
                    {product.sizes.map((size, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedSize(idx)}
                        className={cn(
                          "px-4 py-2 rounded-lg border text-sm transition-all",
                          selectedSize === idx
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground text-foreground"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity & Add to Cart */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Quantity */}
                <div className="flex items-center border border-border rounded-lg">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="p-3 hover:bg-muted transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="p-3 hover:bg-muted transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  className={cn(
                    "flex-1 py-3 px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2",
                    isInCart(product.id)
                      ? "bg-success text-white"
                      : "bg-primary hover:bg-primary-hover text-white"
                  )}
                >
                  {isInCart(product.id) ? (
                    <>
                      <Check className="h-5 w-5" />
                      Added to Cart
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5" />
                      Add to Cart
                    </>
                  )}
                </button>

                {/* Buy Now */}
                <Link href="/checkout">
                  <button className="py-3 px-6 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all">
                    Buy Now
                  </button>
                </Link>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => toggleWishlist(product.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm",
                    isInWishlist(product.id)
                      ? "border-destructive text-destructive bg-destructive/10"
                      : "border-border hover:border-muted-foreground text-foreground"
                  )}
                >
                  <Heart className={cn("h-4 w-4", isInWishlist(product.id) && "fill-current")} />
                  {isInWishlist(product.id) ? 'In Wishlist' : 'Add to Wishlist'}
                </button>
                <button
                  onClick={() => toggleCompare(product.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-muted-foreground text-foreground transition-all text-sm"
                >
                  <BarChart2 className="h-4 w-4" />
                  Compare
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-muted-foreground text-foreground transition-all text-sm">
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>

              {/* Shipping Info */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Free Shipping</p>
                    <p className="text-sm text-muted-foreground">Delivery in 2-5 business days</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Easy Returns</p>
                    <p className="text-sm text-muted-foreground">30 day return policy</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Secure Payment</p>
                    <p className="text-sm text-muted-foreground">100% protected checkout</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Price Comparison Section */}
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Compare Prices Across Retailers
          </h2>
          <div className="grid gap-3">
            {product.retailers.map((retailer, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all",
                  idx === 0
                    ? "bg-success/10 border-success"
                    : "bg-card border-border hover:border-primary"
                )}
              >
                <div className="flex items-center gap-4">
                  <img
                    src={retailer.logo}
                    alt={retailer.name}
                    className="w-10 h-10 object-contain rounded"
                  />
                  <div>
                    <p className="font-medium text-foreground">{retailer.name}</p>
                    <p className="text-sm text-muted-foreground">{retailer.shipping}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground">${retailer.price.toFixed(2)}</p>
                    {idx === 0 && (
                      <span className="text-xs font-medium text-success">Best Price</span>
                    )}
                  </div>
                  <a
                    href="#"
                    className={cn(
                      "px-4 py-2 rounded-lg font-medium text-sm transition-all",
                      idx === 0
                        ? "bg-success hover:bg-success/90 text-white"
                        : "bg-primary hover:bg-primary-hover text-white"
                    )}
                  >
                    Go to Store
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Price Alert */}
          <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Set a Price Alert</p>
                <p className="text-sm text-muted-foreground">Get notified when the price drops below your target</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium text-sm transition-all">
              Set Alert
            </button>
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          {/* Tab Headers */}
          <div className="flex gap-1 border-b border-border mb-6">
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
                  "px-6 py-3 font-medium text-sm transition-all border-b-2 -mb-[2px]",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
                <h3 className="text-lg font-semibold text-foreground">About this item</h3>
                <ul className="space-y-2">
                  {product.about.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="grid md:grid-cols-2 gap-4">
                {product.features.map((feature, idx) => (
                  <div key={idx} className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium text-foreground">{feature.label}</span>
                    <span className="text-muted-foreground">{feature.value}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Reviews coming soon...</p>
              </div>
            )}

            {activeTab === 'prices' && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Price history chart coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Related Products */}
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            You May Also Like
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {relatedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onWatchlist={() => toggleWishlist(product.id)}
                onCompare={() => toggleCompare(product.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <TemplateFooter />
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <ShopProvider>
      <ProductDetailContent />
    </ShopProvider>
  );
}
