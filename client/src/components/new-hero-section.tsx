import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { useState } from 'react';

export function NewHeroSection() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    // TODO: Implement search navigation
    // For now, this is a placeholder
  };

  return (
    <section className="text-center mb-12">
      <h2 className="text-4xl font-bold text-foreground mb-4">
        Shop and Save on Millions of Products.
      </h2>
      
      <div className="flex justify-center">
        <div className="relative w-full max-w-2xl">
          <input
            type="text"
            placeholder="What are you looking for?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-4 px-6 rounded-full border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary transition duration-300"
          />
          <Button
            onClick={handleSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground font-semibold py-3 px-8 rounded-full hover:bg-primary/90 transition duration-300"
          >
            Search
          </Button>
        </div>
      </div>
    </section>
  );
}