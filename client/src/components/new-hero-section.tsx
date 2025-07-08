import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { useState } from 'react';

export function NewHeroSection() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    // Handle search logic here
    console.log('Searching for:', searchQuery);
  };

  return (
    <section className="text-center mb-12">
      <h2 className="text-4xl font-bold text-gray-800 mb-4">
        Shop and Save on Millions of Products.
      </h2>
      
      <div className="flex justify-center">
        <div className="relative w-full max-w-2xl">
          <input
            type="text"
            placeholder="What are you looking for?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-4 px-6 rounded-full border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition duration-300"
          />
          <Button
            onClick={handleSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white font-semibold py-3 px-8 rounded-full hover:bg-indigo-700 transition duration-300"
          >
            Search
          </Button>
        </div>
      </div>
    </section>
  );
}