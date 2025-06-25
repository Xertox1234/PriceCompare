import { useState } from "react";
import { Search, Bell, User } from "lucide-react";

interface SearchHeaderProps {
  onSearch: (query: string) => void;
  searchQuery: string;
}

export function SearchHeader({ onSearch, searchQuery }: SearchHeaderProps) {
  const [query, setQuery] = useState(searchQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch(query);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40" role="banner">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo and Brand */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent font-sans">
                PriceCompare Community
              </h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-[600px] mx-8" role="search">
            <form onSubmit={handleSubmit} className="relative">
              <div className="absolute top-1/2 left-4 -translate-y-1/2 pointer-events-none">
                <Search size={20} className="text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="search"
                placeholder="Search for products to compare prices..."
                className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl bg-gray-50 outline-none transition-all duration-300 font-sans focus:border-primary focus:shadow-primary/10 focus:shadow-lg focus:bg-white"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Search for products"
              />
            </form>
          </div>

          {/* Right side buttons */}
          <div className="flex items-center gap-4">
            <button
              className="p-3 bg-gray-100 border-0 rounded-xl cursor-pointer transition-all duration-300 hover:bg-gray-200 hover:scale-105"
              aria-label="Notifications"
            >
              <Bell size={20} className="text-gray-700" />
            </button>
            
            <button
              className="bg-primary text-primary-foreground px-5 py-3 border-0 rounded-xl text-base font-semibold cursor-pointer flex items-center gap-2 transition-all duration-300 font-sans hover:bg-primary/90 hover:-translate-y-0.5"
              aria-label="User profile"
            >
              <User size={18} />
              Profile
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}