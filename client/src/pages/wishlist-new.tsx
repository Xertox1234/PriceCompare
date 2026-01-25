import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import {
  ChevronRight,
  X,
  Check,
  Heart,
  Bell,
  TrendingDown,
  Minus,
  ExternalLink,
} from 'lucide-react';
import { TemplateHeader } from '@/components/template/header';
import { TemplateFooter } from '@/components/template/footer';
// NOTE: CartSidebar removed - not applicable for price comparison platform (TODO 269)
import { MobileMenu, CompareModal, SearchModal } from '@/components/template/modals';
import { useShop } from '@/context/shop-context';
import { Button } from '@/components/ui/button';
import { allProducts } from '@/data/template-data';

function WishlistContent() {
  const {
    wishlist,
    toggleWishlist,
  } = useShop();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Get wishlist items from allProducts
  const wishlistItems = useMemo(() => {
    return allProducts.filter((p) => wishlist.includes(p.id));
  }, [wishlist]);

  return (
    <>
      <Helmet>
        <title>My Wishlist | PriceCompare</title>
        <meta name="description" content="View and manage your saved products. Get notified when prices drop." />
      </Helmet>
      <div className="bg-background min-h-screen">
        <TemplateHeader
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
            <span className="text-foreground font-medium">Wishlist</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <Heart className="text-destructive fill-destructive h-7 w-7" />
              My Wishlist
            </h1>
            <p className="text-muted-foreground mt-1">
              {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>
        </div>

        {wishlistItems.length > 0 ? (
          <div className="bg-card border-border overflow-hidden rounded-2xl border">
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-border bg-muted/50 border-b">
                    <th className="w-12 p-4"></th>
                    <th className="w-24 p-4"></th>
                    <th className="p-4 text-left text-sm font-semibold">Product Name</th>
                    <th className="p-4 text-center text-sm font-semibold">Unit Price</th>
                    <th className="p-4 text-center text-sm font-semibold">Price Trend</th>
                    <th className="p-4 text-center text-sm font-semibold">Stock Status</th>
                    <th className="w-40 p-4 text-center text-sm font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {wishlistItems.map((product) => {
                    const hasPriceDrop = product.oldPrice && product.price < product.oldPrice;
                    const priceChangePercent = product.oldPrice
                      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
                      : 0;

                    return (
                      <tr
                        key={product.id}
                        className="border-border hover:bg-muted/30 border-b transition-colors last:border-b-0"
                      >
                        {/* Remove */}
                        <td className="p-4">
                          <button
                            onClick={() => toggleWishlist(product.id)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full p-2 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>

                        {/* Image */}
                        <td className="p-4">
                          <Link href={`/product/${product.id}`}>
                            <div className="bg-muted h-20 w-20 overflow-hidden rounded-xl">
                              <img
                                src={product.imgSrc}
                                alt={product.title}
                                className="h-full w-full object-cover transition-transform hover:scale-105"
                              />
                            </div>
                          </Link>
                        </td>

                        {/* Product Info */}
                        <td className="p-4">
                          <Link
                            href={`/product/${product.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            <h3 className="text-foreground line-clamp-2 font-semibold">
                              {product.title}
                            </h3>
                          </Link>
                          <p className="text-muted-foreground mt-1 text-sm">{product.brand}</p>
                        </td>

                        {/* Price */}
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-primary text-lg font-bold">
                              ${product.price.toFixed(2)}
                            </span>
                            {product.oldPrice && (
                              <span className="text-muted-foreground text-sm line-through">
                                ${product.oldPrice.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Price Trend */}
                        <td className="p-4 text-center">
                          {hasPriceDrop ? (
                            <div className="bg-success/10 text-success inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium">
                              <TrendingDown className="h-3 w-3" />
                              <span>-{priceChangePercent}%</span>
                            </div>
                          ) : (
                            <div className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm">
                              <Minus className="h-3 w-3" />
                              <span>Stable</span>
                            </div>
                          )}
                        </td>

                        {/* Stock */}
                        <td className="p-4 text-center">
                          {product.inStock !== false ? (
                            <span className="text-success inline-flex items-center gap-1 text-sm font-medium">
                              <Check className="h-4 w-4" />
                              In Stock
                            </span>
                          ) : (
                            <span className="text-destructive text-sm font-medium">
                              Out of Stock
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="p-4 text-center">
                          <Link href={`/product/${product.id}`}>
                            <Button className="bg-primary hover:bg-primary-hover w-full">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Compare Prices
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-border divide-y md:hidden">
              {wishlistItems.map((product) => {
                const hasPriceDrop = product.oldPrice && product.price < product.oldPrice;
                const priceChangePercent = product.oldPrice
                  ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
                  : 0;

                return (
                  <div key={product.id} className="p-4">
                    <div className="flex gap-4">
                      {/* Image */}
                      <Link href={`/product/${product.id}`}>
                        <div className="bg-muted h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl">
                          <img
                            src={product.imgSrc}
                            alt={product.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </Link>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/product/${product.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            <h3 className="text-foreground line-clamp-2 text-sm font-semibold">
                              {product.title}
                            </h3>
                          </Link>
                          <button
                            onClick={() => toggleWishlist(product.id)}
                            className="text-muted-foreground hover:text-destructive flex-shrink-0 p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <p className="text-muted-foreground mt-1 text-xs">{product.brand}</p>

                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-primary font-bold">
                            ${product.price.toFixed(2)}
                          </span>
                          {product.oldPrice && (
                            <span className="text-muted-foreground text-xs line-through">
                              ${product.oldPrice.toFixed(2)}
                            </span>
                          )}
                          {hasPriceDrop && (
                            <span className="bg-success/10 text-success inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium">
                              <TrendingDown className="h-3 w-3" />-{priceChangePercent}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Link href={`/product/${product.id}`}>
                      <Button
                        className="bg-primary hover:bg-primary-hover mt-3 w-full"
                        size="sm"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Compare Prices
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="bg-card border-border rounded-2xl border py-16 text-center">
            <Heart className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
            <h2 className="text-foreground mb-2 text-xl font-semibold">Your wishlist is empty</h2>
            <p className="text-muted-foreground mx-auto mb-6 max-w-md">
              Start adding your favorite products to your wishlist! Click the heart icon on any
              product to save it here.
            </p>
            <Link href="/shop">
              <Button className="bg-primary hover:bg-primary-hover">
                <ExternalLink className="mr-2 h-4 w-4" />
                Explore Products
              </Button>
            </Link>
          </div>
        )}

        {/* Price Alert Section */}
        {wishlistItems.length > 0 && (
          <div className="from-primary/10 to-secondary/10 border-primary/20 mt-8 rounded-2xl border bg-gradient-to-r p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 rounded-xl p-3">
                  <Bell className="text-primary h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold">Get Price Drop Alerts</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    We'll notify you when prices drop on your wishlist items
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-white"
              >
                <Bell className="mr-2 h-4 w-4" />
                Enable Alerts
              </Button>
            </div>
          </div>
        )}
      </main>

      <TemplateFooter />

      {/* Modals */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <CompareModal isOpen={compareOpen} onClose={() => setCompareOpen(false)} />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </>
  );
}

export default function WishlistPage() {
  return <WishlistContent />;
}
