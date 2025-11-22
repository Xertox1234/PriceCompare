import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { ChevronRight, X, ShoppingCart, BarChart2, Check, Star, Trash2, Plus, ExternalLink, TrendingDown } from 'lucide-react';
import { TemplateHeader } from '@/components/template/header';
import { TemplateFooter } from '@/components/template/footer';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { CartModal, MobileMenu, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  allProducts,
  type TemplateProduct,
} from '@/data/template-data';

// Spec labels for comparison
const specLabels = [
  { key: 'brand', label: 'Brand' },
  { key: 'category', label: 'Category' },
  { key: 'sku', label: 'SKU' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'weight', label: 'Weight' },
  { key: 'warranty', label: 'Warranty' },
];

// Mock specs data
const mockSpecs: Record<number, Record<string, string>> = {
  1: { sku: 'APL-001', dimensions: '44mm x 38mm', weight: '38.8g', warranty: '1 Year' },
  2: { sku: 'SAM-002', dimensions: '44mm x 43mm', weight: '42.3g', warranty: '1 Year' },
  3: { sku: 'SNY-003', dimensions: '215mm x 175mm', weight: '250g', warranty: '2 Years' },
  4: { sku: 'BSE-004', dimensions: '200mm x 170mm', weight: '260g', warranty: '2 Years' },
  5: { sku: 'APL-005', dimensions: '134mm x 64mm', weight: '172g', warranty: '1 Year' },
};

function CompareContent() {
  const {
    compare,
    toggleCompare,
    clearCompare,
    addSimpleToCart,
    openCart,
    isInCart,
  } = useShop();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Get compare items from allProducts
  const compareItems = useMemo(() => {
    return allProducts.filter((p) => compare.includes(p.id));
  }, [compare]);

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

  const emptySlots = Math.max(0, 4 - compareItems.length);

  return (
    <div className="min-h-screen bg-background">
      <TemplateHeader
        onOpenCart={openCart}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCompare={() => {}}
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
            <span className="text-foreground font-medium">Compare Products</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <BarChart2 className="h-7 w-7 text-primary" />
              Compare Products
            </h1>
            <p className="text-muted-foreground mt-1">
              {compareItems.length} of 4 products selected
            </p>
          </div>
          {compareItems.length > 0 && (
            <Button
              variant="outline"
              onClick={clearCompare}
              className="text-destructive border-destructive hover:bg-destructive hover:text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {compareItems.length > 0 ? (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <tbody>
                  {/* Product Name Row */}
                  <tr className="border-b border-border">
                    <td className="p-4 bg-muted/50 w-40 font-semibold text-sm sticky left-0 z-10">
                      Product Name
                    </td>
                    {compareItems.map((product) => (
                      <td key={product.id} className="p-4 min-w-[200px] relative group">
                        <button
                          onClick={() => toggleCompare(product.id)}
                          className="absolute top-2 right-2 p-1 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <Link href={`/product/${product.id}`} className="hover:text-primary transition-colors">
                          <h3 className="font-semibold text-foreground line-clamp-2 pr-6">
                            {product.title}
                          </h3>
                        </Link>
                      </td>
                    ))}
                    {[...Array(emptySlots)].map((_, i) => (
                      <td key={`empty-name-${i}`} className="p-4 min-w-[200px]">
                        <div className="text-muted-foreground text-sm">-</div>
                      </td>
                    ))}
                  </tr>

                  {/* Image Row */}
                  <tr className="border-b border-border">
                    <td className="p-4 bg-muted/50 w-40 font-semibold text-sm sticky left-0 z-10">
                      Image
                    </td>
                    {compareItems.map((product) => (
                      <td key={product.id} className="p-4">
                        <Link href={`/product/${product.id}`}>
                          <div className="w-32 h-32 mx-auto rounded-xl overflow-hidden bg-muted">
                            <img
                              src={product.imgSrc}
                              alt={product.title}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                            />
                          </div>
                        </Link>
                      </td>
                    ))}
                    {[...Array(emptySlots)].map((_, i) => (
                      <td key={`empty-img-${i}`} className="p-4">
                        <div className="w-32 h-32 mx-auto rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                          <Link href="/shop">
                            <div className="text-center p-4 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer">
                              <Plus className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Add product</span>
                            </div>
                          </Link>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Price Row */}
                  <tr className="border-b border-border">
                    <td className="p-4 bg-muted/50 w-40 font-semibold text-sm sticky left-0 z-10">
                      Price
                    </td>
                    {compareItems.map((product) => {
                      const hasPriceDrop = product.oldPrice && product.price < product.oldPrice;
                      const priceChangePercent = product.oldPrice
                        ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
                        : 0;

                      return (
                        <td key={product.id} className="p-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-xl font-bold text-primary">
                              ${product.price.toFixed(2)}
                            </span>
                            {product.oldPrice && (
                              <span className="text-sm text-muted-foreground line-through">
                                ${product.oldPrice.toFixed(2)}
                              </span>
                            )}
                            {hasPriceDrop && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 mt-1 bg-success/10 text-success rounded-full text-xs font-medium">
                                <TrendingDown className="h-3 w-3" />
                                Save {priceChangePercent}%
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {[...Array(emptySlots)].map((_, i) => (
                      <td key={`empty-price-${i}`} className="p-4 text-center text-muted-foreground">-</td>
                    ))}
                  </tr>

                  {/* Rating Row */}
                  <tr className="border-b border-border">
                    <td className="p-4 bg-muted/50 w-40 font-semibold text-sm sticky left-0 z-10">
                      Rating
                    </td>
                    {compareItems.map((product) => (
                      <td key={product.id} className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-4 w-4",
                                i < Math.floor(product.rating || 0)
                                  ? "fill-warning text-warning"
                                  : "text-muted"
                              )}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          ({product.reviewCount || 0} reviews)
                        </p>
                      </td>
                    ))}
                    {[...Array(emptySlots)].map((_, i) => (
                      <td key={`empty-rating-${i}`} className="p-4 text-center text-muted-foreground">-</td>
                    ))}
                  </tr>

                  {/* Spec Rows */}
                  {specLabels.map((spec) => (
                    <tr key={spec.key} className="border-b border-border">
                      <td className="p-4 bg-muted/50 w-40 font-semibold text-sm sticky left-0 z-10">
                        {spec.label}
                      </td>
                      {compareItems.map((product) => {
                        let value = '-';
                        if (spec.key === 'brand') value = product.brand || '-';
                        else if (spec.key === 'category') value = product.category || '-';
                        else value = mockSpecs[product.id]?.[spec.key] || '-';

                        return (
                          <td key={product.id} className="p-4 text-center text-sm">
                            {value}
                          </td>
                        );
                      })}
                      {[...Array(emptySlots)].map((_, i) => (
                        <td key={`empty-${spec.key}-${i}`} className="p-4 text-center text-muted-foreground">-</td>
                      ))}
                    </tr>
                  ))}

                  {/* Stock Status Row */}
                  <tr className="border-b border-border">
                    <td className="p-4 bg-muted/50 w-40 font-semibold text-sm sticky left-0 z-10">
                      Stock Status
                    </td>
                    {compareItems.map((product) => (
                      <td key={product.id} className="p-4 text-center">
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
                    ))}
                    {[...Array(emptySlots)].map((_, i) => (
                      <td key={`empty-stock-${i}`} className="p-4 text-center text-muted-foreground">-</td>
                    ))}
                  </tr>

                  {/* Action Row */}
                  <tr>
                    <td className="p-4 bg-muted/50 w-40 font-semibold text-sm sticky left-0 z-10">
                      Action
                    </td>
                    {compareItems.map((product) => {
                      const inCart = isInCart(product.id);
                      return (
                        <td key={product.id} className="p-4 text-center">
                          <Button
                            onClick={() => handleAddToCart(product)}
                            className={cn(
                              "w-full max-w-[180px]",
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
                      );
                    })}
                    {[...Array(emptySlots)].map((_, i) => (
                      <td key={`empty-action-${i}`} className="p-4 text-center">
                        <Link href="/shop">
                          <Button variant="outline" className="w-full max-w-[180px]">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Product
                          </Button>
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <BarChart2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No products to compare</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Add products to compare by clicking the compare icon on product cards. You can compare up to 4 products at once.
            </p>
            <Link href="/shop">
              <Button className="bg-primary hover:bg-primary-hover">
                <ExternalLink className="h-4 w-4 mr-2" />
                Browse Products
              </Button>
            </Link>
          </div>
        )}

        {/* Compare Tips */}
        {compareItems.length > 0 && compareItems.length < 4 && (
          <div className="mt-8 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6 border border-primary/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Add more products to compare</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can compare up to 4 products side by side. Add {4 - compareItems.length} more!
                  </p>
                </div>
              </div>
              <Link href="/shop">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Products
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      <TemplateFooter />

      {/* Modals */}
      <CartSidebar />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function ComparePage() {
  return (
    <ShopProvider>
      <CompareContent />
    </ShopProvider>
  );
}
