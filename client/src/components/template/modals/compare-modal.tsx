import { X, Trash2, Star } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useShop } from '@/context/shop-context';
import { cn } from '@/lib/utils';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock product data for comparison (in real app, this would come from API)
const mockProductDetails: Record<
  number,
  {
    id: number;
    name: string;
    image: string;
    price: number;
    originalPrice?: number;
    rating: number;
    reviewCount: number;
    category: string;
    retailer: string;
    specs: Record<string, string>;
  }
> = {
  1: {
    id: 1,
    name: 'Apple Watch Series 9',
    image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=400&q=80',
    price: 399,
    originalPrice: 499,
    rating: 4.8,
    reviewCount: 1256,
    category: 'Wearables',
    retailer: 'Amazon',
    specs: { Display: '45mm OLED', Battery: '18 hours', 'Water Resistant': '50m', Storage: '64GB' },
  },
  2: {
    id: 2,
    name: 'Samsung Galaxy Watch 6',
    image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400&q=80',
    price: 349,
    originalPrice: 399,
    rating: 4.5,
    reviewCount: 892,
    category: 'Wearables',
    retailer: 'Best Buy',
    specs: {
      Display: '44mm AMOLED',
      Battery: '40 hours',
      'Water Resistant': '50m',
      Storage: '16GB',
    },
  },
  3: {
    id: 3,
    name: 'Sony WH-1000XM5',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
    price: 279,
    originalPrice: 399,
    rating: 4.9,
    reviewCount: 2341,
    category: 'Audio',
    retailer: 'Amazon',
    specs: { Driver: '30mm', Battery: '30 hours', ANC: 'Yes', Bluetooth: '5.2' },
  },
  4: {
    id: 4,
    name: 'Bose QuietComfort Ultra',
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&q=80',
    price: 329,
    originalPrice: 429,
    rating: 4.7,
    reviewCount: 1089,
    category: 'Audio',
    retailer: 'Bose',
    specs: { Driver: '35mm', Battery: '24 hours', ANC: 'Yes', Bluetooth: '5.3' },
  },
};

export function CompareModal({ isOpen, onClose }: CompareModalProps) {
  const { compare, toggleCompare, clearCompare } = useShop();

  const compareProducts = compare.map((id) => mockProductDetails[id]).filter(Boolean);

  // Get all unique spec keys from compared products
  const allSpecs = Array.from(new Set(compareProducts.flatMap((p) => Object.keys(p.specs))));

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-slate-900 transition-opacity duration-300',
          isOpen ? 'opacity-80' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl shadow-2xl transition-all duration-300',
          isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        )}
        style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Compare Products</h2>
            <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-1 text-xs font-bold">
              {compare.length} of 4
            </span>
          </div>
          <div className="flex items-center gap-2">
            {compare.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCompare}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Clear All
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {compare.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <p className="text-foreground mb-2 text-lg font-medium">No products to compare</p>
              <p className="text-muted-foreground mb-6 text-sm">
                Add products to compare by clicking the compare icon on product cards
              </p>
              <Button
                onClick={onClose}
                className="bg-template-primary hover:bg-template-primary-hover"
              >
                Browse Products
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="bg-muted sticky left-0 w-40 p-3 text-left">
                      <span className="text-muted-foreground text-sm font-medium">Product</span>
                    </th>
                    {compareProducts.map((product) => (
                      <th key={product.id} className="min-w-[180px] p-3 text-center">
                        <div className="group relative">
                          {/* Remove Button */}
                          <button
                            onClick={() => toggleCompare(product.id)}
                            className="bg-destructive hover:bg-destructive text-destructive-foreground absolute -top-1 -right-1 z-10 rounded-full p-1 opacity-0 transition-all group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>

                          {/* Product Image */}
                          <Link href={`/product/${product.id}`} onClick={onClose}>
                            <div className="bg-muted mx-auto mb-3 h-24 w-24 overflow-hidden rounded-lg">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </Link>

                          {/* Product Name */}
                          <Link href={`/product/${product.id}`} onClick={onClose}>
                            <h3 className="text-foreground hover:text-template-primary line-clamp-2 text-sm font-medium transition-colors">
                              {product.name}
                            </h3>
                          </Link>
                        </div>
                      </th>
                    ))}
                    {/* Empty slots */}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <th key={`empty-${i}`} className="min-w-[180px] p-3 text-center">
                        <div className="bg-muted border-border mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed">
                          <span className="text-muted-foreground text-xs">Add product</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Price Row */}
                  <tr className="border-border border-t">
                    <td className="bg-muted sticky left-0 p-3 text-sm font-medium">Price</td>
                    {compareProducts.map((product) => (
                      <td key={product.id} className="p-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-template-primary text-lg font-bold">
                            ${product.price.toFixed(2)}
                          </span>
                          {product.originalPrice && (
                            <span className="text-muted-foreground text-sm line-through">
                              ${product.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <td
                        key={`empty-price-${i}`}
                        className="text-muted-foreground p-3 text-center"
                      >
                        -
                      </td>
                    ))}
                  </tr>

                  {/* Rating Row */}
                  <tr className="border-border border-t">
                    <td className="bg-muted sticky left-0 p-3 text-sm font-medium">Rating</td>
                    {compareProducts.map((product) => (
                      <td key={product.id} className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="flex">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  'h-3 w-3',
                                  i < Math.floor(product.rating)
                                    ? 'fill-template-gold text-template-gold'
                                    : 'text-muted'
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-muted-foreground text-xs">
                            ({product.reviewCount})
                          </span>
                        </div>
                      </td>
                    ))}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <td
                        key={`empty-rating-${i}`}
                        className="text-muted-foreground p-3 text-center"
                      >
                        -
                      </td>
                    ))}
                  </tr>

                  {/* Retailer Row */}
                  <tr className="border-border border-t">
                    <td className="bg-muted sticky left-0 p-3 text-sm font-medium">Retailer</td>
                    {compareProducts.map((product) => (
                      <td key={product.id} className="p-3 text-center">
                        <span className="text-template-secondary text-sm">{product.retailer}</span>
                      </td>
                    ))}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <td
                        key={`empty-retailer-${i}`}
                        className="text-muted-foreground p-3 text-center"
                      >
                        -
                      </td>
                    ))}
                  </tr>

                  {/* Spec Rows */}
                  {allSpecs.map((spec) => (
                    <tr key={spec} className="border-border border-t">
                      <td className="bg-muted sticky left-0 p-3 text-sm font-medium">{spec}</td>
                      {compareProducts.map((product) => (
                        <td key={product.id} className="p-3 text-center text-sm">
                          {product.specs[spec] || '-'}
                        </td>
                      ))}
                      {Array.from({ length: 4 - compare.length }).map((_, i) => (
                        <td
                          key={`empty-${spec}-${i}`}
                          className="text-muted-foreground p-3 text-center"
                        >
                          -
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Action Row */}
                  <tr className="border-border border-t">
                    <td className="bg-muted sticky left-0 p-3 text-sm font-medium">Action</td>
                    {compareProducts.map((product) => (
                      <td key={product.id} className="p-3 text-center">
                        <Link href={`/product/${product.id}`} onClick={onClose}>
                          <Button
                            size="sm"
                            className="bg-template-primary hover:bg-template-primary-hover"
                          >
                            View Details
                          </Button>
                        </Link>
                      </td>
                    ))}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <td
                        key={`empty-action-${i}`}
                        className="text-muted-foreground p-3 text-center"
                      >
                        -
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
