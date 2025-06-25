import { useState } from "react";
import { Search, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <h1 className="text-3xl font-black text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                Insightify
              </h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-8" role="search">
            <form onSubmit={handleSubmit} className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <Input
                type="search"
                placeholder="Search for products to compare prices..."
                className="block w-full pl-12 pr-16 py-4 text-lg border-2 border-gray-200 rounded-2xl bg-gray-50 hover:bg-white focus:bg-white transition-all duration-300"
                style={{
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#5A5DFF';
                  e.target.style.boxShadow = '0 0 0 3px rgba(90, 93, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
                aria-label="Search for products"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-blue-600 hover:text-blue-700"
                aria-label="Search"
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </Button>
            </form>
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 p-3 rounded-xl transition-all duration-300"
              aria-label="Price alerts"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 p-3 rounded-xl transition-all duration-300"
              aria-label="User menu"
            >
              <User className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
