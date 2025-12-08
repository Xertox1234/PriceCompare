import { useState, useEffect, useRef } from 'react';
import { X, Search, TrendingUp, Clock, ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { ProductCard, type ProductData } from '../product-card';
import { trendingProducts } from '@/data/template-data';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const popularSearches = [
  'Smartphones',
  'Laptops',
  'Headphones',
  'Smart Watch',
  'Cameras',
  'Gaming',
];

const recentSearches = ['iPhone 15 Pro', 'MacBook Air', 'AirPods Pro'];

// Convert template products to ProductData for display
const featuredProducts: ProductData[] = trendingProducts.slice(0, 5).map((p) => ({
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

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/shop?search=${encodeURIComponent(query.trim())}`);
      onClose();
    }
  };

  const handleQuickSearch = (term: string) => {
    setLocation(`/shop?search=${encodeURIComponent(term)}`);
    onClose();
  };

  return (
    <>
      {/* Full-screen overlay from top */}
      <div
        className={cn(
          'bg-background fixed inset-0 z-50 overflow-y-auto transition-all duration-300',
          isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0'
        )}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="hover:bg-muted absolute top-6 right-6 z-10 rounded-full p-3 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl">
            {/* Title */}
            <h2 className="text-foreground mb-8 text-center text-3xl font-bold md:text-4xl">
              What are you looking for?
            </h2>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="relative mb-8">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products, brands, or categories..."
                className="bg-muted border-border focus:ring-primary focus:border-primary w-full rounded-2xl border px-6 py-5 pl-14 text-lg transition-all focus:ring-2 focus:outline-none"
              />
              <Search className="text-muted-foreground absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2" />
              <button
                type="submit"
                className="bg-primary hover:bg-primary-hover absolute top-1/2 right-3 -translate-y-1/2 rounded-xl p-3 text-white transition-colors"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mb-8">
                <div className="mb-4 flex items-center gap-2">
                  <Clock className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-sm font-medium">Recent searches</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickSearch(term)}
                      className="bg-muted hover:bg-muted/80 text-foreground rounded-full px-4 py-2 text-sm transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Searches */}
            <div className="mb-12">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="text-primary h-4 w-4" />
                <span className="text-foreground text-sm font-semibold">Popular searches</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickSearch(term)}
                    className="border-border hover:border-primary hover:text-primary text-foreground rounded-full border px-4 py-2 text-sm transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Featured Products */}
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-foreground text-xl font-semibold">Featured Products</h3>
              <Link
                href="/shop"
                onClick={onClose}
                className="text-primary flex items-center gap-1 text-sm hover:underline"
              >
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {featuredProducts.map((product) => (
                <div key={product.id} onClick={onClose}>
                  <ProductCard product={product} variant="compact" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
