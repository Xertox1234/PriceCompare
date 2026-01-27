import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useLocation } from 'wouter';

export function HeroSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [, navigate] = useLocation();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Navigate to products page with search query
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <section className="mb-12 text-center">
      <h2 className="text-foreground mb-4 text-4xl font-bold">
        Shop and Save on Millions of Products.
      </h2>

      <div className="flex justify-center">
        <div className="relative w-full max-w-2xl">
          <input
            type="search"
            placeholder="What are you looking for?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-border focus:ring-primary w-full rounded-full border-2 px-6 py-4 transition duration-300 focus:ring-2 focus:outline-none"
            data-testid="hero-search-input"
          />
          <Button
            onClick={handleSearch}
            className="bg-primary text-primary-foreground hover:bg-primary/90 absolute top-1/2 right-2 -translate-y-1/2 rounded-full px-8 py-3 font-semibold transition duration-300"
            data-testid="hero-search-button"
          >
            Search
          </Button>
        </div>
      </div>
    </section>
  );
}
