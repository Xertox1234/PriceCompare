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
  ListPlus,
} from 'lucide-react';
import { TemplateHeader, TemplateFooter, ProductSection } from '@/components/template';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { MobileMenu, CompareModal, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { addToRecentlyViewed } from '@/components/template/recently-viewed';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn, getProductImageUrl, handleImageError } from '@/lib/utils';
import { ApiError } from '@/lib/queryClient';
import { useProductFull, useProductsByCategory, transformProduct } from '@/hooks/use-home-data';
import { useWatchLists, useAddProductToWatchList } from '@/hooks/use-community';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, BarChart3 } from 'lucide-react';
import { PriceHistoryChart } from '@/components/price-history/PriceHistoryChart';
import { PriceInsightsWidget } from '@/components/price-history/price-insights-widget';
import { usePriceHistory, usePriceStats } from '@/hooks/use-price-history';
import { RetailerComparisonTable } from '@/components/price-analytics/retailer-comparison-table';
import { BestDealBadge } from '@/components/price-analytics/best-deal-badge';
import { PriceTrendIndicator } from '@/components/price-analytics/price-trend-indicator';
import { PriceAlertModal } from '@/components/price-analytics/price-alert-modal';

function ProductDetailContent() {
  const params = useParams<{ id: string }>();
  const productId = parseInt(params.id || '0', 10);

  const { toggleWishlist, isInWishlist, toggleCompare, openCart } = useShop();
  const { toast } = useToast();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [watchlistDialogOpen, setWatchlistDialogOpen] = useState(false);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>('');
  const [priceAlertModalOpen, setPriceAlertModalOpen] = useState(false);
  const [prefilledAlertPrice, setPrefilledAlertPrice] = useState<number | undefined>(undefined);
  const [timeRangeDays, setTimeRangeDays] = useState<number>(30);

  // Fetch user's watchlists
  const { data: watchlistsData } = useWatchLists();
  const watchlists = watchlistsData || [];

  // Modern watchlist mutation
  const addToWatchList = useAddProductToWatchList();

  // Fetch product from API
  const { data: productData, isLoading, error } = useProductFull(productId || null);
  const product = productData;

  // Fetch related products (same category)
  const { data: relatedData } = useProductsByCategory(product?.category ?? '', 4);
  const relatedProducts =
    relatedData?.results
      ?.filter((p) => p.id !== productId)
      .slice(0, 4)
      .map(transformProduct) ?? [];

  // Get best offer for price analytics
  const bestOffer = product?.offers?.[0];

  // Price analytics data - hooks auto-enable when both IDs are available
  const { data: priceHistory, isLoading: historyLoading } = usePriceHistory(
    productId,
    bestOffer?.id,
    { days: timeRangeDays }
  );

  const { data: _priceStats, isLoading: statsLoading } = usePriceStats(
    productId,
    bestOffer?.id,
    365 // Full year for accurate trends
  );

  // Track product view
  useEffect(() => {
    if (product) {
      addToRecentlyViewed(product.id);
    }
  }, [product]);

  // Generate image gallery from product
  const images = product ? [getProductImageUrl(product.image)] : [];

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <span className="text-muted-foreground ml-2">Loading product...</span>
      </div>
    );
  }

  // Error state
  if (error || !product) {
    return (
      <div className="bg-background flex min-h-screen flex-col items-center justify-center">
        <p className="text-destructive mb-2 text-lg font-medium">Product not found</p>
        <Link href="/shop">
          <a className="text-primary hover:underline">Back to shop</a>
        </Link>
      </div>
    );
  }

  // Get best offer and price info
  // bestOffer is already declared earlier (line 84) for price analytics
  const price = product.bestPrice ?? (bestOffer ? parseFloat(bestOffer.price) : 0);
  const originalPrice = bestOffer?.originalPrice ? parseFloat(bestOffer.originalPrice) : undefined;
  const discount =
    originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : undefined;
  const rating = bestOffer?.rating ? parseFloat(bestOffer.rating) : 4.0;
  const reviewCount = bestOffer?.reviewCount ?? 0;
  const category = product.category ?? 'General';

  /**
   * Transform API price history to chart format
   * Hook returns PriceHistoryResponse: { data: PriceHistory[], count: number }
   */
  const transformPriceHistoryData = (history: typeof priceHistory, offer: typeof bestOffer) => {
    if (!history || !offer) return [];

    return history.data.map((h) => ({
      id: h.id,
      productId: productId,
      retailerId: offer.retailerId,
      retailerName: offer.retailer?.name ?? 'Unknown',
      retailerLogo: offer.retailer?.logo ?? null,
      price: h.price,
      recordedAt: h.recordedAt ?? h.createdAt ?? new Date(),
    }));
  };

  // Transform related products for display
  const relatedProductsData = relatedProducts.map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const inWishlist = product ? isInWishlist(product.id) : false;

  // Handle viewing the best offer at retailer
  const handleViewBestOffer = () => {
    const offerUrl = bestOffer?.affiliateUrl ?? bestOffer?.productUrl;
    if (offerUrl) {
      window.open(offerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Handle adding product to watchlist (modern watchlist manager API)
  const handleAddToWatchlist = async (watchlistId: string) => {
    try {
      // Use modern watchlist manager API
      await addToWatchList.mutateAsync({
        listId: parseInt(watchlistId, 10),
        productId,
      });

      // Show watchlist name in toast (better UX)
      const watchlist = watchlists.find(w => w.id === parseInt(watchlistId, 10));
      toast({
        title: 'Success',
        description: `Added to ${watchlist?.name ?? 'watchlist'}`,
      });

      setWatchlistDialogOpen(false);
      setSelectedWatchlistId('');
    } catch (error: unknown) {
      // Type-safe error handling
      if (error instanceof ApiError) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to add to watchlist',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
      }
    }
  };

  // Handle chart data point click to open price alert modal
  const handleChartClick = (price: number) => {
    setPrefilledAlertPrice(price);
    setPriceAlertModalOpen(true);
  };

  // Check if current offer is the best deal
  const isBestDeal = product?.offers && product.offers.length > 1
    ? product.offers.every((offer) => parseFloat(bestOffer?.price || '0') <= parseFloat(offer.price))
    : false;

  return (
    <div className="bg-background min-h-screen">
      <TemplateHeader
        onOpenCart={openCart}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCompare={() => setCompareOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Breadcrumbs */}
      <div className="border-border border-b py-4">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <Link
              href="/shop"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Shop
            </Link>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground line-clamp-1 font-medium">{product.name}</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Product Detail Grid */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left - Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="bg-muted relative aspect-square overflow-hidden rounded-2xl">
              <img
                src={images[selectedImageIndex]}
                alt={product.name}
                className="h-full w-full object-cover"
                onError={handleImageError}
              />
              {discount && discount > 0 && (
                <div className="bg-destructive absolute top-4 left-4 rounded-full px-3 py-1 text-sm font-medium text-white">
                  -{discount}% OFF
                </div>
              )}

              {/* Navigation Arrows */}
              <button
                type="button"
                onClick={() =>
                  setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
                }
                aria-label="Previous product image"
                className="absolute top-1/2 left-4 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-colors hover:bg-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
                }
                aria-label="Next product image"
                className="absolute top-1/2 right-4 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-colors hover:bg-white"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Thumbnails */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  aria-label={`View product image ${idx + 1}`}
                  className={cn(
                    'h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-colors',
                    selectedImageIndex === idx
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground'
                  )}
                >
                  <img src={img} alt={`${product.name} image ${idx + 1}`} className="h-full w-full object-cover" />
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
                className="text-primary text-sm hover:underline"
              >
                {category}
              </Link>
              <h1 className="text-foreground mt-2 text-2xl font-bold lg:text-3xl">
                {product.name}
              </h1>

              {/* Rating & Reviews */}
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < Math.floor(rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      )}
                    />
                  ))}
                  <span className="text-muted-foreground ml-1 text-sm">
                    {rating.toFixed(1)} ({reviewCount.toLocaleString()} reviews)
                  </span>
                </div>
                <span className="text-muted-foreground text-sm">|</span>
                <span className="text-success text-sm">In Stock</span>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-primary text-3xl font-bold">${price.toFixed(2)}</span>
                {originalPrice && originalPrice > price && (
                  <>
                    <span className="text-muted-foreground text-xl line-through">
                      ${originalPrice.toFixed(2)}
                    </span>
                    <span className="text-destructive text-sm font-medium">
                      Save ${(originalPrice - price).toFixed(2)}
                    </span>
                  </>
                )}
              </div>
              {isBestDeal && <BestDealBadge showIcon />}
            </div>

            {/* Brand */}
            <div className="border-border flex items-center gap-2 border-y py-3">
              <span className="text-muted-foreground">Brand:</span>
              <span className="text-foreground font-medium">{product.brand ?? 'Unknown'}</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={handleViewBestOffer}
                  disabled={!bestOffer?.affiliateUrl && !bestOffer?.productUrl}
                  className="bg-primary hover:bg-primary/90 flex-1 py-6 text-base"
                >
                  <ExternalLink className="mr-2 h-5 w-5" />
                  {bestOffer?.retailer?.name
                    ? `View at ${bestOffer.retailer.name}`
                    : 'View Best Offer'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart
                    className={cn('h-5 w-5', inWishlist && 'fill-destructive text-destructive')}
                  />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={() => {
                    toggleCompare(product.id);
                    setCompareOpen(true);
                  }}
                  aria-label="Compare product"
                >
                  <GitCompare className="h-5 w-5" />
                </Button>
              </div>

              {/* Add to Watchlist Button */}
              <Button
                variant="outline"
                onClick={() => setWatchlistDialogOpen(true)}
                className="w-full py-6 text-base"
              >
                <ListPlus className="mr-2 h-5 w-5" />
                Add to Watchlist
              </Button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="bg-muted/50 flex flex-col items-center rounded-xl p-4 text-center">
                <Truck className="text-primary mb-2 h-6 w-6" />
                <span className="text-muted-foreground text-xs">Free Shipping</span>
              </div>
              <div className="bg-muted/50 flex flex-col items-center rounded-xl p-4 text-center">
                <Shield className="text-primary mb-2 h-6 w-6" />
                <span className="text-muted-foreground text-xs">Secure Payment</span>
              </div>
              <div className="bg-muted/50 flex flex-col items-center rounded-xl p-4 text-center">
                <RotateCcw className="text-primary mb-2 h-6 w-6" />
                <span className="text-muted-foreground text-xs">30-Day Returns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Description */}
        <div className="bg-card border-border mt-12 rounded-2xl border p-6">
          <h2 className="mb-4 text-xl font-bold">About this item</h2>
          <ul className="text-muted-foreground space-y-2">
            {product.brand && (
              <li className="flex items-start gap-2">
                <Check className="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
                <span>Premium quality product from {product.brand}</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <Check className="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>Category: {category}</span>
            </li>
            {reviewCount > 0 && (
              <li className="flex items-start gap-2">
                <Check className="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
                <span>
                  Customer rating: {rating.toFixed(1)}/5 based on {reviewCount.toLocaleString()}{' '}
                  reviews
                </span>
              </li>
            )}
            {product.offers && product.offers.length > 1 && (
              <li className="flex items-start gap-2">
                <Check className="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
                <span>Price compared across {product.offers.length} retailers</span>
              </li>
            )}
          </ul>
        </div>

        {/* Price Analytics Section */}
        <Collapsible
          defaultOpen={false}
          className="bg-card border-border mt-12 rounded-2xl border"
        >
          <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Price Analytics & History</h2>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
          </CollapsibleTrigger>

          <CollapsibleContent className="px-6 pb-6">
            <div className="space-y-6 pt-4">
              {/* Loading State */}
              {(historyLoading || statsLoading) && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading price analytics...
                  </span>
                </div>
              )}

              {/* Content */}
              {!historyLoading && !statsLoading && (
                <div className="space-y-6">
                  {/* Price Trend Indicator */}
                  {priceHistory && priceHistory.data.length > 0 && (
                    <div className="flex items-center gap-4">
                      <PriceTrendIndicator
                        priceHistory={priceHistory.data.map((h) => ({
                          price: h.price,
                          recordedAt: h.recordedAt ?? h.createdAt ?? new Date(),
                        }))}
                        showPercentage
                      />
                    </div>
                  )}

                  {/* Charts Grid */}
                  {priceHistory && (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Price History Chart */}
                      <div className="lg:col-span-1" data-testid="price-chart">
                        <PriceHistoryChart
                          data={transformPriceHistoryData(priceHistory, bestOffer)}
                          productId={productId}
                          productName={product?.name}
                          isLoading={historyLoading}
                          timeRange={timeRangeDays}
                          onChartClick={handleChartClick}
                          onTimeRangeChange={setTimeRangeDays}
                        />
                      </div>

                      {/* Price Insights Widget */}
                      <div className="lg:col-span-1">
                        <PriceInsightsWidget
                          productId={productId}
                          offerId={bestOffer?.id}
                          className="h-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Cross-Retailer Comparison Table */}
                  {product?.offers && product.offers.length > 0 && (
                    <RetailerComparisonTable
                      offers={product.offers.map((offer) => ({
                        id: offer.id,
                        retailerId: offer.retailerId,
                        retailerName: offer.retailer?.name || 'Unknown',
                        retailerLogo: offer.retailer?.logo,
                        price: offer.price,
                        originalPrice: offer.originalPrice,
                        availability: offer.availability,
                        productUrl: offer.productUrl,
                        affiliateUrl: offer.affiliateUrl,
                        lastUpdated: offer.lastUpdated,
                      }))}
                    />
                  )}
                </div>
              )}

              {/* Empty State */}
              {!historyLoading && !priceHistory && (
                <div className="bg-muted/50 rounded-lg p-8 text-center">
                  <p className="text-muted-foreground">
                    Price tracking data will be available soon
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

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

      {/* Add to Watchlist Dialog */}
      <Dialog open={watchlistDialogOpen} onOpenChange={setWatchlistDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Watchlist</DialogTitle>
            <DialogDescription>Select a watchlist to add this product to</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="watchlist-select">Select watchlist</Label>
              <Select value={selectedWatchlistId} onValueChange={setSelectedWatchlistId}>
                <SelectTrigger id="watchlist-select">
                  <SelectValue placeholder="Choose a watchlist" />
                </SelectTrigger>
                <SelectContent>
                  {watchlists.map((watchlist) => (
                    <SelectItem
                      key={watchlist.id}
                      value={watchlist.id.toString()}
                    >
                      {watchlist.name} ({watchlist.watchCount || 0} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWatchlistDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleAddToWatchlist(selectedWatchlistId)}
              disabled={!selectedWatchlistId || addToWatchList.isPending}
            >
              {addToWatchList.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Alert Modal */}
      <PriceAlertModal
        productId={productId}
        productName={product?.name}
        prefilledPrice={prefilledAlertPrice}
        isOpen={priceAlertModalOpen}
        onClose={() => {
          setPriceAlertModalOpen(false);
          setPrefilledAlertPrice(undefined);
        }}
      />
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
