# Component Documentation

## Overview
This document outlines all major components in the Insightify application, their responsibilities, props, and usage patterns.

## Component Architecture

### Design Principles
- **Single Responsibility**: Each component has a clear, focused purpose
- **Accessibility First**: All components include proper ARIA labels and keyboard support
- **Type Safety**: Full TypeScript coverage with proper prop interfaces
- **Reusability**: Components are designed for reuse across different contexts
- **Performance**: Optimized rendering with proper memoization where needed

## Page Components

### Home (`/client/src/pages/home.tsx`)
Main application page containing the product search and comparison interface.

**Responsibilities:**
- Coordinate search functionality
- Manage filter state
- Handle product comparison
- Display search results and best deals

**State Management:**
- Search query and filters
- Product comparison list
- Loading and error states

**Child Components:**
- SearchHeader
- FilterSidebar
- ProductGrid
- ComparisonModal

### NotFound (`/client/src/pages/not-found.tsx`)
404 error page with navigation back to home.

**Responsibilities:**
- Display user-friendly 404 message
- Provide navigation back to main application

## Layout Components

### SearchHeader (`/client/src/components/search-header.tsx`)
Application header with search functionality and navigation.

**Props:**
```typescript
interface SearchHeaderProps {
  onSearch: (query: string) => void;
  searchQuery: string;
}
```

**Features:**
- Brand logo and navigation
- Search input with autocomplete
- User action buttons (alerts, profile)
- Responsive design
- Keyboard navigation support

**Accessibility:**
- Search landmark with `role="search"`
- Proper form labeling
- Keyboard shortcuts for search

### FilterSidebar (`/client/src/components/filter-sidebar.tsx`)
Advanced filtering interface for product search.

**Props:**
```typescript
interface FilterSidebarProps {
  filters: SearchFilters;
  onFilterChange: (filters: Partial<SearchFilters>) => void;
}
```

**Filter Categories:**
- Price range (min/max)
- Retailer selection
- Minimum rating
- Availability status
- Clear all filters

**Features:**
- Real-time filter updates
- Clear visual feedback
- Accessibility-compliant form controls
- Responsive collapse on mobile

## Product Components

### ProductGrid (`/client/src/components/product-grid.tsx`)
Container for displaying product search results.

**Props:**
```typescript
interface ProductGridProps {
  products: ProductWithOffers[];
  isLoading: boolean;
  error: Error | null;
  onAddToComparison: (product: ProductWithOffers) => void;
}
```

**States:**
- **Loading**: Skeleton components for perceived performance
- **Error**: User-friendly error messages with retry options
- **Empty**: Helpful messaging when no results found
- **Results**: Responsive grid of product cards

**Features:**
- Responsive grid layout (1-3 columns)
- Loading skeletons
- Error boundary handling
- Empty state management
- Load more functionality (placeholder)

### ProductCard (`/client/src/components/product-card.tsx`)
Individual product display with price comparison.

**Props:**
```typescript
interface ProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: () => void;
}
```

**Features:**
- Product image with lazy loading
- Deal badges for special offers
- Star ratings with review counts
- Price display with savings calculation
- Availability indicators
- Comparison and purchase actions

**Price Display:**
- Current best price (highlighted)
- Original price (crossed out)
- Savings amount and percentage
- Shipping information

**Accessibility:**
- Semantic article structure
- Descriptive image alt text
- Action button labels
- Rating announced to screen readers

### ComparisonModal (`/client/src/components/comparison-modal.tsx`)
Floating modal for managing product comparisons.

**Props:**
```typescript
interface ComparisonModalProps {
  items: ProductWithOffers[];
  onRemoveItem: (productId: number) => void;
  onClear: () => void;
}
```

**Features:**
- Fixed positioning (bottom-right)
- Product list with remove options
- Compare button (disabled until 2+ items)
- Clear all functionality
- Maximum 4 items limit

**Accessibility:**
- Dialog role with aria-modal
- Focus management
- Keyboard navigation
- Screen reader announcements

## UI Components (shadcn/ui)

### Form Components
- **Input**: Text input with variants and validation states
- **Button**: Multiple variants (primary, secondary, outline, ghost)
- **Checkbox**: Accessible checkbox with custom styling
- **Select**: Dropdown selection with keyboard navigation
- **Label**: Properly associated form labels

### Layout Components
- **Card**: Container component with consistent spacing
- **Separator**: Visual divider with semantic meaning
- **Badge**: Status indicators and tags
- **Skeleton**: Loading placeholders

### Feedback Components
- **Toast**: Non-intrusive notifications
- **Alert**: Prominent user messages
- **Progress**: Loading and progress indicators

## Custom Hooks

### useProducts (`/client/src/hooks/use-products.ts`)
Manages product search and filtering with caching.

**Parameters:**
```typescript
function useProducts(filters: SearchFilters)
```

**Returns:**
- `data`: Array of products with offers
- `isLoading`: Loading state
- `error`: Error state
- React Query cache management

**Features:**
- Automatic query building from filters
- 5-minute cache duration
- Optimistic updates
- Error handling

### useComparison (`/client/src/hooks/use-comparison.ts`)
Manages product comparison state and actions.

**Returns:**
```typescript
{
  comparisonItems: ProductWithOffers[];
  addToComparison: (product: ProductWithOffers) => void;
  removeFromComparison: (productId: number) => void;
  clearComparison: () => void;
}
```

**Features:**
- Maximum 4 items limit
- Duplicate prevention
- Toast notifications
- Optimistic updates

## Styling Guidelines

### CSS Classes
Custom CSS classes are defined in `/client/src/index.css`:

**Price Display:**
- `.price-highlight`: Large, bold current price
- `.price-original`: Crossed-out original price
- `.price-savings`: Highlighted savings amount

**Deal Badges:**
- `.deal-badge`: Base badge styling
- `.deal-badge.best-price`: Best price indicator
- `.deal-badge.bundle`: Bundle deal indicator
- `.deal-badge.limited`: Limited time offer

**Availability:**
- `.availability-indicator`: Base availability styling
- `.availability-indicator.in-stock`: In stock status
- `.availability-indicator.limited-stock`: Limited stock warning
- `.availability-indicator.out-of-stock`: Out of stock status

### Responsive Design
- Mobile-first approach with breakpoints
- Flexible grid layouts
- Touch-friendly button sizes (44px minimum)
- Optimized typography scales

## Performance Considerations

### Optimization Strategies
- React.memo for expensive components
- Lazy loading for images
- Virtual scrolling for large lists (future)
- Bundle splitting with dynamic imports

### Caching
- React Query for server state
- Browser caching for static assets
- Memoization for computed values

## Testing Guidelines

### Component Testing
- Unit tests for component logic
- Integration tests for user workflows
- Accessibility testing with axe-core
- Visual regression testing

### Testing Utilities
```typescript
// Example test structure
describe('ProductCard', () => {
  it('displays product information correctly', () => {
    // Test implementation
  });
  
  it('handles comparison actions', () => {
    // Test implementation
  });
  
  it('meets accessibility standards', () => {
    // Accessibility tests
  });
});
```

Last Updated: December 25, 2024