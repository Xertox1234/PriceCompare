import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { ChevronRight, X, ShoppingCart, Trash2, Check, Heart, Bell, TrendingDown, TrendingUp, Minus, ExternalLink } from 'lucide-react';
import { TemplateHeader } from '@/components/template/header';
import { TemplateFooter } from '@/components/template/footer';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { CartModal, MobileMenu, CompareModal, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  allProducts,
  type TemplateProduct,
} from '@/data/template-data';

function WishlistContent() {
  const {
    wishlist,
    toggleWishlist,
    addSimpleToCart,
    openCart,
    isCartOpen,
    isInCart,
  } = useShop();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Get wishlist items from allProducts
  const wishlistItems = useMemo(() => {
    return allProducts.filter((p) => wishlist.includes(p.id));
  }, [wishlist]);

  const handleAddToCart = (product: TemplateProduct) => {
    addSimpleToCart({
      id: product.id,
      name: product.title,
      price: product.price,
      image: product.imgSrc,
      quantity: 1,
    });
    openCart();
  };

  const handleAddAllToCart = () => {
    wishlistItems.forEach((product) => {
      if (!isInCart(product.id)) {
        addSimpleToCart({
          id: product.id,
          name: product.title,
          price: product.price,
          image: product.imgSrc,
          quantity: 1,
        });
      }
    });
    openCart();
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
            <span className="text-foreground font-medium">Wishlist</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Heart className="h-7 w-7 text-destructive fill-destructive" />
              My Wishlist
            </h1>
            <p className="text-muted-foreground mt-1">
              {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>
          {wishlistItems.length > 0 && (
            <Button
              onClick={handleAddAllToCart}
              className="bg-primary hover:bg-primary-hover"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add All to Cart
            </Button>
          )}
        </div>

        {wishlistItems.length > 0 ? (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-12 p-4"></th>
                    <th className="w-24 p-4"></th>
                    <th className="text-left p-4 font-semibold text-sm">Product Name</th>
                    <th className="text-center p-4 font-semibold text-sm">Unit Price</th>
                    <th className="text-center p-4 font-semibold text-sm">Price Trend</th>
                    <th className="text-center p-4 font-semibold text-sm">Stock Status</th>
                    <th className="text-center p-4 font-semibold text-sm w-40"></th>
                  </tr>
                </thead>
                <tbody>
                  {wishlistItems.map((product) => {
                    const inCart = isInCart(product.id);
                    const hasPriceDrop = product.oldPrice && product.price < product.oldPrice;
                    const priceChangePercent = product.oldPrice
                      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
                      : 0;

                    return (
                      <tr key={product.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                        {/* Remove */}
                        <td className="p-4">
                          <button
                            onClick={() => toggleWishlist(product.id)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>

                        {/* Image */}
                        <td className="p-4">
                          <Link href={`/product/${product.id}`}>
                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted">
                              <img
                                src={product.imgSrc}
                                alt={product.title}
                                className="w-full h-full object-cover hover:scale-105 transition-transform"
                              />
                            </div>
                          </Link>
                        </td>

                        {/* Product Info */}
                        <td className="p-4">
                          <Link href={`/product/${product.id}`} className="hover:text-primary transition-colors">
                            <h3 className="font-semibold text-foreground line-clamp-2">
                              {product.title}
                            </h3>
                          </Link>
                          <p className="text-sm text-muted-foreground mt-1">{product.brand}</p>
                        </td>

                        {/* Price */}
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-lg font-bold text-primary">
                              ${product.price.toFixed(2)}
                            </span>
                            {product.oldPrice && (
                              <span className="text-sm text-muted-foreground line-through">
                                ${product.oldPrice.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Price Trend */}
                        <td className="p-4 text-center">
                          {hasPriceDrop ? (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
                              <TrendingDown className="h-3 w-3" />
                              <span>-{priceChangePercent}%</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground rounded-full text-sm">
                              <Minus className="h-3 w-3" />
                              <span>Stable</span>
                            </div>
                          )}
                        </td>

                        {/* Stock */}
                        <td className="p-4 text-center">
                          {product.inStock !== false ? (
                            <span className="inline-flex items-center gap-1 text-success text-sm font-medium">
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
                          <Button
                            onClick={() => handleAddToCart(product)}
                            className={cn(
                              "w-full",
                              inCart
                                ? "bg-success hover:bg-success/90"
                                : "bg-primary hover:bg-primary-hover"
                            )}
                            disabled={product.inStock === false}
                          >
                            {inCart ? (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Added
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Add to Cart
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {wishlistItems.map((product) => {
                const inCart = isInCart(product.id);
                const hasPriceDrop = product.oldPrice && product.price < product.oldPrice;
                const priceChangePercent = product.oldPrice
                  ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
                  : 0;

                return (
                  <div key={product.id} className="p-4">
                    <div className="flex gap-4">
                      {/* Image */}
                      <Link href={`/product/${product.id}`}>
                        <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                          <img
                            src={product.imgSrc}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/product/${product.id}`} className="hover:text-primary transition-colors">
                            <h3 className="font-semibold text-foreground line-clamp-2 text-sm">
                              {product.title}
                            </h3>
                          </Link>
                          <button
                            onClick={() => toggleWishlist(product.id)}
                            className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <p className="text-xs text-muted-foreground mt-1">{product.brand}</p>

                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-bold text-primary">
                            ${product.price.toFixed(2)}
                          </span>
                          {product.oldPrice && (
                            <span className="text-xs text-muted-foreground line-through">
                              ${product.oldPrice.toFixed(2)}
                            </span>
                          )}
                          {hasPriceDrop && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-success/10 text-success rounded text-xs font-medium">
                              <TrendingDown className="h-3 w-3" />
                              -{priceChangePercent}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleAddToCart(product)}
                      className={cn(
                        "w-full mt-3",
                        inCart
                          ? "bg-success hover:bg-success/90"
                          : "bg-primary hover:bg-primary-hover"
                      )}
                      size="sm"
                      disabled={product.inStock === false}
                    >
                      {inCart ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Added to Cart
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Add to Cart
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Your wishlist is empty</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start adding your favorite products to your wishlist! Click the heart icon on any product to save it here.
            </p>
            <Link href="/shop">
              <Button className="bg-primary hover:bg-primary-hover">
                <ExternalLink className="h-4 w-4 mr-2" />
                Explore Products
              </Button>
            </Link>
          </div>
        )}

        {/* Price Alert Section */}
        {wishlistItems.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6 border border-primary/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Get Price Drop Alerts</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    We'll notify you when prices drop on your wishlist items
                  </p>
                </div>
              </div>
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                <Bell className="h-4 w-4 mr-2" />
                Enable Alerts
              </Button>
            </div>
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

export default function WishlistPage() {
  return (
    <ShopProvider>
      <WishlistContent />
    </ShopProvider>
  );
}
