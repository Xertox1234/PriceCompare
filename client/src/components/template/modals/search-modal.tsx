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

const recentSearches = [
  'iPhone 15 Pro',
  'MacBook Air',
  'AirPods Pro',
];

// Convert template products to ProductData for display
const featuredProducts: ProductData[] = trendingProducts.slice(0, 5).map(p => ({
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
          "fixed inset-0 bg-background z-50 transition-all duration-300 overflow-y-auto",
          isOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-full pointer-events-none"
        )}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-muted rounded-full transition-colors z-10"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto">
            {/* Title */}
            <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-8">
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
                className="w-full px-6 py-5 pl-14 text-lg bg-muted border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Recent searches</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickSearch(term)}
                      className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Searches */}
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Popular searches</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickSearch(term)}
                    className="px-4 py-2 text-sm border border-border hover:border-primary hover:text-primary text-foreground rounded-full transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Featured Products */}
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-foreground">Featured Products</h3>
              <Link
                href="/shop"
                onClick={onClose}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {featuredProducts.map((product) => (
                <div key={product.id} onClick={onClose}>
                  <ProductCard
                    product={product}
                    variant="compact"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
