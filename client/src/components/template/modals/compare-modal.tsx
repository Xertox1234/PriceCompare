/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
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
const mockProductDetails: Record<number, {
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
}> = {
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
    specs: { 'Display': '45mm OLED', 'Battery': '18 hours', 'Water Resistant': '50m', 'Storage': '64GB' }
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
    specs: { 'Display': '44mm AMOLED', 'Battery': '40 hours', 'Water Resistant': '50m', 'Storage': '16GB' }
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
    specs: { 'Driver': '30mm', 'Battery': '30 hours', 'ANC': 'Yes', 'Bluetooth': '5.2' }
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
    specs: { 'Driver': '35mm', 'Battery': '24 hours', 'ANC': 'Yes', 'Bluetooth': '5.3' }
  }
};

export function CompareModal({ isOpen, onClose }: CompareModalProps) {
  const { compare, toggleCompare, clearCompare } = useShop();

  const compareProducts = compare.map(id => mockProductDetails[id]).filter(Boolean);

  // Get all unique spec keys from compared products
  const allSpecs = Array.from(
    new Set(compareProducts.flatMap(p => Object.keys(p.specs)))
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-slate-900 z-50 transition-opacity duration-300",
          isOpen ? "opacity-80" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl max-h-[90vh] rounded-2xl z-50 shadow-2xl transition-all duration-300 overflow-hidden flex flex-col",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Compare Products</h2>
            <span className="bg-secondary text-secondary-foreground text-xs font-bold px-2 py-1 rounded-full">
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
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {compare.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-lg font-medium text-foreground mb-2">No products to compare</p>
              <p className="text-sm text-muted-foreground mb-6">
                Add products to compare by clicking the compare icon on product cards
              </p>
              <Button onClick={onClose} className="bg-template-primary hover:bg-template-primary-hover">
                Browse Products
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="text-left p-3 w-40 bg-muted sticky left-0">
                      <span className="text-sm font-medium text-muted-foreground">Product</span>
                    </th>
                    {compareProducts.map((product) => (
                      <th key={product.id} className="p-3 text-center min-w-[180px]">
                        <div className="relative group">
                          {/* Remove Button */}
                          <button
                            onClick={() => toggleCompare(product.id)}
                            className="absolute -top-1 -right-1 p-1 bg-destructive hover:bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                          >
                            <X className="h-3 w-3" />
                          </button>

                          {/* Product Image */}
                          <Link href={`/product/${product.id}`} onClick={onClose}>
                            <div className="w-24 h-24 mx-auto mb-3 bg-muted rounded-lg overflow-hidden">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </Link>

                          {/* Product Name */}
                          <Link href={`/product/${product.id}`} onClick={onClose}>
                            <h3 className="font-medium text-foreground text-sm line-clamp-2 hover:text-template-primary transition-colors">
                              {product.name}
                            </h3>
                          </Link>
                        </div>
                      </th>
                    ))}
                    {/* Empty slots */}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <th key={`empty-${i}`} className="p-3 text-center min-w-[180px]">
                        <div className="w-24 h-24 mx-auto mb-3 bg-muted rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">Add product</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Price Row */}
                  <tr className="border-t border-border">
                    <td className="p-3 bg-muted sticky left-0 font-medium text-sm">Price</td>
                    {compareProducts.map((product) => (
                      <td key={product.id} className="p-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-template-primary">
                            ${product.price.toFixed(2)}
                          </span>
                          {product.originalPrice && (
                            <span className="text-sm text-muted-foreground line-through">
                              ${product.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <td key={`empty-price-${i}`} className="p-3 text-center text-muted-foreground">-</td>
                    ))}
                  </tr>

                  {/* Rating Row */}
                  <tr className="border-t border-border">
                    <td className="p-3 bg-muted sticky left-0 font-medium text-sm">Rating</td>
                    {compareProducts.map((product) => (
                      <td key={product.id} className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "h-3 w-3",
                                  i < Math.floor(product.rating) ? "fill-template-gold text-template-gold" : "text-muted"
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
                        </div>
                      </td>
                    ))}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <td key={`empty-rating-${i}`} className="p-3 text-center text-muted-foreground">-</td>
                    ))}
                  </tr>

                  {/* Retailer Row */}
                  <tr className="border-t border-border">
                    <td className="p-3 bg-muted sticky left-0 font-medium text-sm">Retailer</td>
                    {compareProducts.map((product) => (
                      <td key={product.id} className="p-3 text-center">
                        <span className="text-sm text-template-secondary">{product.retailer}</span>
                      </td>
                    ))}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <td key={`empty-retailer-${i}`} className="p-3 text-center text-muted-foreground">-</td>
                    ))}
                  </tr>

                  {/* Spec Rows */}
                  {allSpecs.map((spec) => (
                    <tr key={spec} className="border-t border-border">
                      <td className="p-3 bg-muted sticky left-0 font-medium text-sm">{spec}</td>
                      {compareProducts.map((product) => (
                        <td key={product.id} className="p-3 text-center text-sm">
                          {product.specs[spec] || '-'}
                        </td>
                      ))}
                      {Array.from({ length: 4 - compare.length }).map((_, i) => (
                        <td key={`empty-${spec}-${i}`} className="p-3 text-center text-muted-foreground">-</td>
                      ))}
                    </tr>
                  ))}

                  {/* Action Row */}
                  <tr className="border-t border-border">
                    <td className="p-3 bg-muted sticky left-0 font-medium text-sm">Action</td>
                    {compareProducts.map((product) => (
                      <td key={product.id} className="p-3 text-center">
                        <Link href={`/product/${product.id}`} onClick={onClose}>
                          <Button size="sm" className="bg-template-primary hover:bg-template-primary-hover">
                            View Details
                          </Button>
                        </Link>
                      </td>
                    ))}
                    {Array.from({ length: 4 - compare.length }).map((_, i) => (
                      <td key={`empty-action-${i}`} className="p-3 text-center text-muted-foreground">-</td>
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
