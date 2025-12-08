import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  ChevronRight,
  X,
  ShoppingCart,
  BarChart2,
  Check,
  Star,
  Trash2,
  Plus,
  ExternalLink,
  TrendingDown,
} from 'lucide-react';
import { TemplateHeader } from '@/components/template/header';
import { TemplateFooter } from '@/components/template/footer';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { MobileMenu, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { allProducts, type TemplateProduct } from '@/data/template-data';

/**
 * Creates a typed array of undefined values for iteration purposes.
 * Alternative to [...Array(n)] which creates 'any' typed elements.
 */
function createFillerArray(length: number): undefined[] {
  return Array.from({ length });
}

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
  const { compare, toggleCompare, clearCompare, addSimpleToCart, openCart, isInCart } = useShop();

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
    <div className="bg-background min-h-screen">
      <TemplateHeader
        onOpenCart={openCart}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCompare={() => {}}
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
            <span className="text-foreground font-medium">Compare Products</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <BarChart2 className="text-primary h-7 w-7" />
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
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {compareItems.length > 0 ? (
          <div className="bg-card border-border overflow-hidden rounded-2xl border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <tbody>
                  {/* Product Name Row */}
                  <tr className="border-border border-b">
                    <td className="bg-muted/50 sticky left-0 z-10 w-40 p-4 text-sm font-semibold">
                      Product Name
                    </td>
                    {compareItems.map((product) => (
                      <td key={product.id} className="group relative min-w-[200px] p-4">
                        <button
                          onClick={() => toggleCompare(product.id)}
                          className="bg-destructive/10 hover:bg-destructive text-destructive absolute top-2 right-2 rounded-full p-1 opacity-0 transition-all group-hover:opacity-100 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/product/${product.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          <h3 className="text-foreground line-clamp-2 pr-6 font-semibold">
                            {product.title}
                          </h3>
                        </Link>
                      </td>
                    ))}
                    {createFillerArray(emptySlots).map((_, i) => (
                      <td key={`empty-name-${i}`} className="min-w-[200px] p-4">
                        <div className="text-muted-foreground text-sm">-</div>
                      </td>
                    ))}
                  </tr>

                  {/* Image Row */}
                  <tr className="border-border border-b">
                    <td className="bg-muted/50 sticky left-0 z-10 w-40 p-4 text-sm font-semibold">
                      Image
                    </td>
                    {compareItems.map((product) => (
                      <td key={product.id} className="p-4">
                        <Link href={`/product/${product.id}`}>
                          <div className="bg-muted mx-auto h-32 w-32 overflow-hidden rounded-xl">
                            <img
                              src={product.imgSrc}
                              alt={product.title}
                              className="h-full w-full object-cover transition-transform hover:scale-105"
                            />
                          </div>
                        </Link>
                      </td>
                    ))}
                    {createFillerArray(emptySlots).map((_, i) => (
                      <td key={`empty-img-${i}`} className="p-4">
                        <div className="border-border mx-auto flex h-32 w-32 items-center justify-center rounded-xl border-2 border-dashed">
                          <Link href="/shop">
                            <div className="hover:bg-muted/50 cursor-pointer rounded-lg p-4 text-center transition-colors">
                              <Plus className="text-muted-foreground mx-auto mb-1 h-6 w-6" />
                              <span className="text-muted-foreground text-xs">Add product</span>
                            </div>
                          </Link>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Price Row */}
                  <tr className="border-border border-b">
                    <td className="bg-muted/50 sticky left-0 z-10 w-40 p-4 text-sm font-semibold">
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
                            <span className="text-primary text-xl font-bold">
                              ${product.price.toFixed(2)}
                            </span>
                            {product.oldPrice && (
                              <span className="text-muted-foreground text-sm line-through">
                                ${product.oldPrice.toFixed(2)}
                              </span>
                            )}
                            {hasPriceDrop && (
                              <span className="bg-success/10 text-success mt-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium">
                                <TrendingDown className="h-3 w-3" />
                                Save {priceChangePercent}%
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {createFillerArray(emptySlots).map((_, i) => (
                      <td
                        key={`empty-price-${i}`}
                        className="text-muted-foreground p-4 text-center"
                      >
                        -
                      </td>
                    ))}
                  </tr>

                  {/* Rating Row */}
                  <tr className="border-border border-b">
                    <td className="bg-muted/50 sticky left-0 z-10 w-40 p-4 text-sm font-semibold">
                      Rating
                    </td>
                    {compareItems.map((product) => (
                      <td key={product.id} className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {createFillerArray(5).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                'h-4 w-4',
                                i < Math.floor(product.rating || 0)
                                  ? 'fill-warning text-warning'
                                  : 'text-muted'
                              )}
                            />
                          ))}
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          ({product.reviewCount || 0} reviews)
                        </p>
                      </td>
                    ))}
                    {createFillerArray(emptySlots).map((_, i) => (
                      <td
                        key={`empty-rating-${i}`}
                        className="text-muted-foreground p-4 text-center"
                      >
                        -
                      </td>
                    ))}
                  </tr>

                  {/* Spec Rows */}
                  {specLabels.map((spec) => (
                    <tr key={spec.key} className="border-border border-b">
                      <td className="bg-muted/50 sticky left-0 z-10 w-40 p-4 text-sm font-semibold">
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
                      {createFillerArray(emptySlots).map((_, i) => (
                        <td
                          key={`empty-${spec.key}-${i}`}
                          className="text-muted-foreground p-4 text-center"
                        >
                          -
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Stock Status Row */}
                  <tr className="border-border border-b">
                    <td className="bg-muted/50 sticky left-0 z-10 w-40 p-4 text-sm font-semibold">
                      Stock Status
                    </td>
                    {compareItems.map((product) => (
                      <td key={product.id} className="p-4 text-center">
                        {product.inStock !== false ? (
                          <span className="text-success inline-flex items-center gap-1 text-sm font-medium">
                            <Check className="h-4 w-4" />
                            In Stock
                          </span>
                        ) : (
                          <span className="text-destructive text-sm font-medium">Out of Stock</span>
                        )}
                      </td>
                    ))}
                    {createFillerArray(emptySlots).map((_, i) => (
                      <td
                        key={`empty-stock-${i}`}
                        className="text-muted-foreground p-4 text-center"
                      >
                        -
                      </td>
                    ))}
                  </tr>

                  {/* Action Row */}
                  <tr>
                    <td className="bg-muted/50 sticky left-0 z-10 w-40 p-4 text-sm font-semibold">
                      Action
                    </td>
                    {compareItems.map((product) => {
                      const inCart = isInCart(product.id);
                      return (
                        <td key={product.id} className="p-4 text-center">
                          <Button
                            onClick={() => handleAddToCart(product)}
                            className={cn(
                              'w-full max-w-[180px]',
                              inCart
                                ? 'bg-success hover:bg-success/90'
                                : 'bg-primary hover:bg-primary-hover'
                            )}
                            disabled={product.inStock === false}
                          >
                            {inCart ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Added
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Add to Cart
                              </>
                            )}
                          </Button>
                        </td>
                      );
                    })}
                    {createFillerArray(emptySlots).map((_, i) => (
                      <td key={`empty-action-${i}`} className="p-4 text-center">
                        <Link href="/shop">
                          <Button variant="outline" className="w-full max-w-[180px]">
                            <Plus className="mr-2 h-4 w-4" />
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
          <div className="bg-card border-border rounded-2xl border py-16 text-center">
            <BarChart2 className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
            <h2 className="text-foreground mb-2 text-xl font-semibold">No products to compare</h2>
            <p className="text-muted-foreground mx-auto mb-6 max-w-md">
              Add products to compare by clicking the compare icon on product cards. You can compare
              up to 4 products at once.
            </p>
            <Link href="/shop">
              <Button className="bg-primary hover:bg-primary-hover">
                <ExternalLink className="mr-2 h-4 w-4" />
                Browse Products
              </Button>
            </Link>
          </div>
        )}

        {/* Compare Tips */}
        {compareItems.length > 0 && compareItems.length < 4 && (
          <div className="from-primary/10 to-secondary/10 border-primary/20 mt-8 rounded-2xl border bg-gradient-to-r p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 rounded-xl p-3">
                  <Plus className="text-primary h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold">Add more products to compare</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    You can compare up to 4 products side by side. Add {4 - compareItems.length}{' '}
                    more!
                  </p>
                </div>
              </div>
              <Link href="/shop">
                <Button
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
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
