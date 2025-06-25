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
    <header 
      style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}
      role="banner"
    >
      <div 
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 32px'
        }}
      >
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '80px'
          }}
        >
          {/* Logo and Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <h1 
                style={{
                  fontSize: '32px',
                  fontWeight: '900',
                  background: 'linear-gradient(135deg, #5A5DFF 0%, #8B5FF5 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                PriceCompare Community
              </h1>
            </div>
          </div>

          {/* Search Bar */}
          <div 
            style={{
              flex: 1,
              maxWidth: '600px',
              margin: '0 32px'
            }}
            role="search"
          >
            <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
              <div 
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '16px',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              >
                <Search 
                  size={20} 
                  style={{ color: '#9ca3af' }}
                  aria-hidden="true" 
                />
              </div>
              <input
                type="search"
                placeholder="Search for products to compare prices..."
                style={{
                  width: '100%',
                  paddingLeft: '48px',
                  paddingRight: '16px',
                  paddingTop: '16px',
                  paddingBottom: '16px',
                  fontSize: '18px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '16px',
                  backgroundColor: '#f9fafb',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  fontFamily: 'Inter, sans-serif'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#5A5DFF';
                  e.target.style.boxShadow = '0 0 0 3px rgba(90, 93, 255, 0.1)';
                  e.target.style.backgroundColor = '#fff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                  e.target.style.backgroundColor = '#f9fafb';
                }}
                aria-label="Search for products"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </form>
          </div>

          {/* User Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              style={{
                color: '#6b7280',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#5A5DFF';
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7280';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Price alerts"
            >
              <Bell size={20} aria-hidden="true" />
            </button>
            <button
              style={{
                color: '#6b7280',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#5A5DFF';
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7280';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="User menu"
            >
              <User size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
