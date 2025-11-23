import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import {
  ChevronRight,
  Heart,
  GitCompare,
  Star,
  Truck,
  Shield,
  RotateCcw,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { TemplateHeader, TemplateFooter, ProductSection } from '@/components/template';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { MobileMenu, CompareModal, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { addToRecentlyViewed } from '@/components/template/recently-viewed';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProductFull, useProductsByCategory, transformProduct } from '@/hooks/use-home-data';

function ProductDetailContent() {
  const params = useParams<{ id: string }>();
  const productId = parseInt(params.id || '0', 10);

  const {
    toggleWishlist,
    isInWishlist,
    toggleCompare,
    openCart,
  } = useShop();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Fetch product from API
  const { data: productData, isLoading, error } = useProductFull(productId || null);
  const product = productData?.data;

  // Fetch related products (same category)
  const { data: relatedData } = useProductsByCategory(product?.category ?? '', 4);
  const relatedProducts = relatedData?.results
    ?.filter(p => p.id !== productId)
    .slice(0, 4)
    .map(transformProduct) ?? [];

  // Track product view
  useEffect(() => {
    if (product) {
      addToRecentlyViewed(product.id);
    }
  }, [product]);

  // Generate image gallery from product
  const images = product ? [
    product.image ?? '/placeholder-product.png',
  ] : [];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading product...</span>
      </div>
    );
  }

  // Error state
  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <p className="text-lg font-medium text-destructive mb-2">Product not found</p>
        <Link href="/shop">
          <a className="text-primary hover:underline">Back to shop</a>
        </Link>
      </div>
    );
  }

  // Get best offer and price info
  const bestOffer = product.offers?.[0];
  const price = product.bestPrice ?? (bestOffer ? parseFloat(bestOffer.price) : 0);
  const originalPrice = bestOffer?.originalPrice ? parseFloat(bestOffer.originalPrice) : undefined;
  const discount = originalPrice && originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : undefined;
  const rating = bestOffer?.rating ? parseFloat(bestOffer.rating) : 4.0;
  const reviewCount = bestOffer?.reviewCount ?? 0;
  const category = product.category ?? 'General';

  // Transform related products for display
  const relatedProductsData = relatedProducts.map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const inWishlist = isInWishlist(product.id);

  // Handle viewing the best offer at retailer
  const handleViewBestOffer = () => {
    const offerUrl = bestOffer?.affiliateUrl ?? bestOffer?.productUrl;
    if (offerUrl) {
      window.open(offerUrl, '_blank', 'noopener,noreferrer');
    }
  };

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
            <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
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
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {discount && discount > 0 && (
                <div className="absolute top-4 left-4 bg-destructive text-white px-3 py-1 rounded-full text-sm font-medium">
                  -{discount}% OFF
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
                href={`/shop?category=${category.toLowerCase()}`}
                className="text-sm text-primary hover:underline"
              >
                {category}
              </Link>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-2">
                {product.name}
              </h1>

              {/* Rating & Reviews */}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < Math.floor(rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-muted-foreground'
                      )}
                    />
                  ))}
                  <span className="ml-1 text-sm text-muted-foreground">
                    {rating.toFixed(1)} ({reviewCount.toLocaleString()} reviews)
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">|</span>
                <span className="text-sm text-success">In Stock</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                ${price.toFixed(2)}
              </span>
              {originalPrice && originalPrice > price && (
                <>
                  <span className="text-xl text-muted-foreground line-through">
                    ${originalPrice.toFixed(2)}
                  </span>
                  <span className="text-sm font-medium text-destructive">
                    Save ${(originalPrice - price).toFixed(2)}
                  </span>
                </>
              )}
            </div>

            {/* Brand */}
            <div className="flex items-center gap-2 py-3 border-y border-border">
              <span className="text-muted-foreground">Brand:</span>
              <span className="font-medium text-foreground">{product.brand ?? 'Unknown'}</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={handleViewBestOffer}
                  disabled={!bestOffer?.affiliateUrl && !bestOffer?.productUrl}
                  className="flex-1 py-6 text-base bg-primary hover:bg-primary/90"
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  {bestOffer?.retailer?.name ? `View at ${bestOffer.retailer.name}` : 'View Best Offer'}
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
            {product.brand && (
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <span>Premium quality product from {product.brand}</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <span>Category: {category}</span>
            </li>
            {reviewCount > 0 && (
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <span>Customer rating: {rating.toFixed(1)}/5 based on {reviewCount.toLocaleString()} reviews</span>
              </li>
            )}
            {product.offers && product.offers.length > 1 && (
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <span>Price compared across {product.offers.length} retailers</span>
              </li>
            )}
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
