import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import {
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  Heart,
  GitCompare,
  Star,
  Truck,
  Shield,
  RotateCcw,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Check,
} from 'lucide-react';
import { TemplateHeader, TemplateFooter, ProductSection, type ProductData } from '@/components/template';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { MobileMenu, CompareModal, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { addToRecentlyViewed } from '@/components/template/recently-viewed';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  allProducts,
  type TemplateProduct,
} from '@/data/template-data';

function toProductData(products: TemplateProduct[]): ProductData[] {
  return products.map((p) => ({
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
    discount: p.salePercentage ? parseInt(p.salePercentage) : undefined,
  }));
}

function ProductDetailContent() {
  const params = useParams<{ id: string }>();
  const productId = parseInt(params.id || '1', 10);

  const {
    toggleWishlist,
    isInWishlist,
    toggleCompare,
    addSimpleToCart,
    openCart,
    isInCart,
  } = useShop();

  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Find product from data
  const product = allProducts.find((p) => p.id === productId) || allProducts[0];

  // Track product view
  useEffect(() => {
    if (product) {
      addToRecentlyViewed(product.id);
    }
  }, [product]);

  // Generate image gallery (using main image + hover image)
  const images = [
    product.imgSrc,
    product.imgHover || product.imgSrc,
    product.imgSrc, // Placeholder for more images
  ].filter(Boolean);

  // Related products (same category or random)
  const relatedProducts = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const relatedProductsData = toProductData(
    relatedProducts.length > 0 ? relatedProducts : allProducts.slice(0, 4)
  ).map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const handleAddToCart = () => {
    addSimpleToCart({
      id: product.id,
      name: product.title,
      price: product.price,
      image: product.imgSrc,
      quantity,
    });
    openCart();
  };

  const inCart = isInCart(product.id);
  const inWishlist = isInWishlist(product.id);
  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <TemplateHeader
        onOpenCart={openCart}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCompare={() => setCompareOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Breadcrumbs */}
      <div className="border-b border-border py-4">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Link href="/shop" className="text-muted-foreground hover:text-primary transition-colors">
              Shop
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground font-medium line-clamp-1">{product.title}</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Product Detail Grid */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left - Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square bg-muted rounded-2xl overflow-hidden">
              <img
                src={images[selectedImageIndex]}
                alt={product.title}
                className="w-full h-full object-cover"
              />
              {discount > 0 && (
                <div className="absolute top-4 left-4 bg-destructive text-white px-3 py-1 rounded-full text-sm font-medium">
                  -{discount}% OFF
                </div>
              )}
              {product.isNew && (
                <div className="absolute top-4 right-4 bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                  NEW
                </div>
              )}

              {/* Navigation Arrows */}
              <button
                onClick={() => setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Thumbnails */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={cn(
                    'w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-colors',
                    selectedImageIndex === idx ? 'border-primary' : 'border-border hover:border-muted-foreground'
                  )}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Right - Product Info */}
          <div className="space-y-6">
            {/* Category & Title */}
            <div>
              <Link
                href={`/shop?category=${product.category.toLowerCase()}`}
                className="text-sm text-primary hover:underline"
              >
                {product.category}
              </Link>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-2">
                {product.title}
              </h1>

              {/* Rating & Reviews */}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < Math.floor(product.rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-muted-foreground'
                      )}
                    />
                  ))}
                  <span className="ml-1 text-sm text-muted-foreground">
                    {product.rating} ({product.reviewCount.toLocaleString()} reviews)
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">|</span>
                <span className="text-sm text-success">In Stock</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                ${product.price.toFixed(2)}
              </span>
              {product.oldPrice && (
                <>
                  <span className="text-xl text-muted-foreground line-through">
                    ${product.oldPrice.toFixed(2)}
                  </span>
                  <span className="text-sm font-medium text-destructive">
                    Save ${(product.oldPrice - product.price).toFixed(2)}
                  </span>
                </>
              )}
            </div>

            {/* Brand */}
            <div className="flex items-center gap-2 py-3 border-y border-border">
              <span className="text-muted-foreground">Brand:</span>
              <span className="font-medium text-foreground">{product.brand}</span>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="space-y-4">
              {/* Quantity Selector */}
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">Quantity:</span>
                <div className="flex items-center border border-border rounded-lg">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-3 hover:bg-muted transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-6 font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-3 hover:bg-muted transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleAddToCart}
                  className={cn(
                    'flex-1 py-6 text-base',
                    inCart ? 'bg-success hover:bg-success/90' : 'bg-primary hover:bg-primary-hover'
                  )}
                >
                  {inCart ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Added to Cart
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Add to Cart
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={() => toggleWishlist(product.id)}
                >
                  <Heart className={cn('h-5 w-5', inWishlist && 'fill-destructive text-destructive')} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={() => {
                    toggleCompare(product.id);
                    setCompareOpen(true);
                  }}
                >
                  <GitCompare className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-xl">
                <Truck className="h-6 w-6 text-primary mb-2" />
                <span className="text-xs text-muted-foreground">Free Shipping</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-xl">
                <Shield className="h-6 w-6 text-primary mb-2" />
                <span className="text-xs text-muted-foreground">Secure Payment</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-xl">
                <RotateCcw className="h-6 w-6 text-primary mb-2" />
                <span className="text-xs text-muted-foreground">30-Day Returns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Description */}
        <div className="mt-12 p-6 bg-card rounded-2xl border border-border">
          <h2 className="text-xl font-bold mb-4">About this item</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <span>Premium quality product from {product.brand}</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <span>Category: {product.category}</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <span>Customer rating: {product.rating}/5 based on {product.reviewCount.toLocaleString()} reviews</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <span>Free shipping on orders over $99</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <span>1 year warranty included</span>
            </li>
          </ul>
        </div>

        {/* Related Products */}
        {relatedProductsData.length > 0 && (
          <div className="mt-12">
            <ProductSection
              title="Related Products"
              subtitle="You might also like"
              products={relatedProductsData}
              columns={4}
              onWatchlist={(p) => toggleWishlist(p.id)}
              onCompare={(p) => {
                toggleCompare(p.id);
                setCompareOpen(true);
              }}
            />
          </div>
        )}
      </main>

      <TemplateFooter />

      {/* Modals */}
      <CartSidebar />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <CompareModal isOpen={compareOpen} onClose={() => setCompareOpen(false)} />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
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
