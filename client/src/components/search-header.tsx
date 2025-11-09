import { useState } from "react";
import { Search, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchHeaderProps {
  onSearch: (query: string) => void;
  searchQuery: string;
}

const searchInputClasses = cn(
  "w-full pl-12 pr-4 py-4 text-lg rounded-2xl",
  "border-2 border-input bg-muted",
  "outline-none transition-all duration-300",
  "focus:border-primary focus:shadow-lg focus:bg-background"
);

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
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-40" role="banner">
      <div className="max-w-container mx-auto px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo and Brand */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-black gradient-text-brand">
                PriceCompare Community
              </h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-search mx-8" role="search">
            <form onSubmit={handleSubmit} className="relative">
              <div className="absolute top-1/2 left-4 -translate-y-1/2 pointer-events-none">
                <Search size={20} className="text-muted-foreground" aria-hidden="true" />
              </div>
              <input
                type="search"
                placeholder="Search for products to compare prices..."
                className={searchInputClasses}
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
              className="p-3 bg-muted border-0 rounded-xl cursor-pointer transition-all duration-300 hover:bg-muted/80 hover:scale-105"
              aria-label="Notifications"
            >
              <Bell size={20} className="text-foreground" />
            </button>

            <button
              className="bg-primary text-primary-foreground px-5 py-3 border-0 rounded-xl text-base font-semibold cursor-pointer flex items-center gap-2 transition-all duration-300 hover:bg-primary/90 hover:-translate-y-0.5"
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