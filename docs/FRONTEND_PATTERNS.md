# Frontend Patterns & Anti-Patterns

This document codifies frontend patterns to ensure consistent, performant, and maintainable React code in the PriceCompare client application.

## Table of Contents
- [Client-Side Data Aggregation Anti-Pattern](#client-side-data-aggregation-anti-pattern)
- [Design System Compliance](#design-system-compliance)
- [Hardcoded Values Anti-Pattern](#hardcoded-values-anti-pattern)
- [Component Patterns](#component-patterns)
- [State Management Patterns](#state-management-patterns)
- [API Integration Patterns](#api-integration-patterns)

---

## Client-Side Data Aggregation Anti-Pattern

### ❌ WRONG - Fetching All Data Then Aggregating on Client

**Problem:** When you need aggregated or filtered data, NEVER fetch all records and process them client-side. This violates storage layer abstraction and causes massive performance issues.

```typescript
// THIS IS A CRITICAL ANTI-PATTERN!
function PriceWatchDashboard() {
  // Fetches ALL watch lists with ALL products (potentially 1000s of records)
  const { data: watchLists } = useQuery({
    queryKey: ['watchlists'],
    queryFn: () => apiRequest<WatchList[]>('/api/watchlists'),
  });

  // Client-side aggregation - WRONG!
  const allProducts = useMemo(() => {
    if (!watchLists) return [];

    const products = [];
    for (const list of watchLists) {
      for (const product of list.products) {
        products.push(product);
      }
    }
    return products;
  }, [watchLists]);

  // Sort/filter on client - WRONG!
  const topPriceDrops = allProducts
    .sort((a, b) => b.priceDropPercent - a.priceDropPercent)
    .slice(0, 10);

  return <ProductList products={topPriceDrops} />;
}
```

**Why this is terrible:**
1. **Data overfetch**: Transfers potentially 100x more data than needed
2. **Memory bloat**: Loads all watch lists into browser memory
3. **Slow rendering**: React re-renders on massive dataset changes
4. **Violates abstraction**: Bypasses storage layer's responsibility
5. **Duplicate logic**: Same aggregation needed elsewhere requires duplication
6. **No pagination**: Can't efficiently paginate aggregated results

### ✅ CORRECT - Dedicated Backend Endpoint

**Solution:** Create a backend endpoint that returns exactly the data needed, properly aggregated and filtered.

```typescript
// server/routes/watch-list-routes.ts
app.get("/api/watchlists/products", withAuth(async (req, res) => {
  const userId = req.session.userId;
  const sortBy = req.query.sortBy as string || 'priceDropPercent';
  const limit = parseIntOptional(req.query.limit) || 10;

  // Storage layer handles aggregation efficiently
  const products = await storage.getWatchedProducts(userId, {
    sortBy,
    limit,
    includeOffers: true,
  });

  res.json({ products });
}));

// server/storage.ts
async getWatchedProducts(
  userId: number,
  options: { sortBy?: string; limit?: number }
): Promise<WatchedProduct[]> {
  // Single efficient query with aggregation
  return db.select({
    productId: productWatches.productId,
    productName: products.name,
    currentPrice: sql<number>`MIN(${productOffers.price})`,
    priceDropPercent: sql<number>`...calculation...`,
    // ... other fields
  })
    .from(productWatches)
    .innerJoin(watchLists, eq(productWatches.watchListId, watchLists.id))
    .innerJoin(products, eq(productWatches.productId, products.id))
    .leftJoin(productOffers, eq(products.id, productOffers.productId))
    .where(eq(watchLists.userId, userId))
    .groupBy(productWatches.productId, products.name)
    .orderBy(desc(sql`...`))
    .limit(options.limit || 10);
}

// client/src/pages/PriceWatchDashboard.tsx
function PriceWatchDashboard() {
  // Fetches ONLY the 10 products with biggest price drops
  const { data } = useQuery({
    queryKey: ['watchlists', 'products', { sortBy: 'priceDropPercent' }],
    queryFn: () => apiRequest('/api/watchlists/products?sortBy=priceDropPercent&limit=10'),
  });

  return <ProductList products={data?.products || []} />;
}
```

**Benefits:**
- Transfers only needed data (10 products vs potentially 1000s)
- Database performs aggregation efficiently
- Single source of truth in storage layer
- Properly cacheable with React Query
- Easy to paginate, filter, or sort server-side

### Detection Rule
```bash
# Find components fetching multiple collections then iterating
grep -r "useQuery.*watchlists" client/src | xargs grep -l "for.*of.*watchlists"
grep -r "\.map.*\.map" client/src  # Nested iterations often indicate client-side aggregation
```

---

## Design System Compliance

### NEVER Use Hardcoded Colors

All UI work MUST follow the design system to maintain consistency across the application.

### ❌ WRONG - Hardcoded Color Values

```typescript
// THIS WILL FAIL CODE REVIEW!
<div className="bg-green-500 text-white">
  Price dropped!
</div>

<div className="bg-[#3B82F6] text-[#FFFFFF]">
  {/* Arbitrary hex colors - inconsistent with design system */}
</div>

<Button style={{ backgroundColor: '#F59E0B' }}>
  {/* Inline styles with hardcoded colors - WRONG! */}
</Button>

// Old/deprecated colors - also wrong
<div className="bg-purple-500">  {/* Old brand color */}
<div className="bg-pink-600">    {/* Old accent color */}
```

**Problems:**
- Inconsistent colors across UI
- Breaks dark mode support
- Can't update theme centrally
- Violates design system standards
- Harder to maintain

### ✅ CORRECT - Use Design Tokens

```typescript
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Use semantic color classes from design system
<div className="bg-primary text-primary-foreground">
  Primary action
</div>

<div className="bg-secondary text-secondary-foreground">
  Secondary action
</div>

<div className="bg-muted text-muted-foreground">
  Muted/disabled state
</div>

<div className="bg-destructive text-destructive-foreground">
  Destructive action
</div>

// Status colors with dark mode support
<div className="bg-green-600 dark:bg-green-500 text-white">
  Success state - properly themed
</div>

<div className="bg-red-600 dark:bg-red-500 text-white">
  Error state - properly themed
</div>

// Use design system components
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Ghost</Button>

<Card className="bg-card text-card-foreground">
  Card content with semantic colors
</Card>
```

### Current Design System Colors

**Brand Colors:**
- Primary: Blue 500 (#3B82F6) - Use `bg-primary` or `text-primary`
- Secondary: Amber 500 (#F59E0B) - Use `bg-secondary` or `text-secondary`

**Semantic Colors:**
- `bg-background` - Page background
- `bg-foreground` - Primary text
- `bg-card` - Card backgrounds
- `bg-muted` - Muted/disabled states
- `bg-accent` - Accent elements
- `bg-destructive` - Destructive actions
- `bg-border` - Borders

**Status Colors (with dark mode):**
```typescript
// Success
className="bg-green-600 dark:bg-green-500"

// Warning
className="bg-yellow-600 dark:bg-yellow-500"

// Error
className="bg-red-600 dark:bg-red-500"

// Info
className="bg-blue-600 dark:bg-blue-500"
```

### Detection Rule
```bash
# Find hardcoded hex colors
grep -r "bg-\[#" client/src
grep -r "text-\[#" client/src
grep -r "backgroundColor.*#" client/src

# Find deprecated color usage
grep -r "bg-purple-" client/src
grep -r "bg-pink-" client/src

# Find specific hardcoded Tailwind colors that should use tokens
grep -r "bg-green-500" client/src  # Should be bg-green-600 dark:bg-green-500 or semantic
```

### Exceptions (Rare)

Truly dynamic colors calculated at runtime are acceptable:
```typescript
// OK - Dynamic color based on data
<div style={{
  backgroundColor: `hsl(${hue}, 70%, 50%)`,  // Calculated from data
  opacity: confidence
}}>
```

---

## Hardcoded Values Anti-Pattern

### ❌ WRONG - Hardcoded IDs and Constants

```typescript
// THIS WILL FAIL CODE REVIEW!
function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['watchlist', 1],  // Hardcoded watchlist ID!
    queryFn: () => apiRequest('/api/watchlists/1'),
  });

  // Works only for user with watchlist ID 1
  // Breaks for all other users!
}

// More examples of hardcoding
const DEFAULT_USER_ID = 42;  // WRONG
const ADMIN_ID = 1;          // WRONG
const CATEGORY_ELECTRONICS = 5;  // WRONG
```

**Problems:**
- Works only in specific test scenarios
- Breaks for real users
- Copy-paste bugs when reusing code
- Hard to debug (why is it always fetching watchlist 1?)

### ✅ CORRECT - Use Dynamic Values

```typescript
// Get from URL params
function WatchlistPage() {
  const { id } = useParams<{ id: string }>();
  const watchlistId = parseIntSafe(id, 'watchlistId', { min: 1 });

  const { data } = useQuery({
    queryKey: ['watchlist', watchlistId],
    queryFn: () => apiRequest(`/api/watchlists/${watchlistId}`),
  });
}

// Get from user context
function DashboardPage() {
  const { user } = useAuth();  // Get authenticated user

  const { data } = useQuery({
    queryKey: ['watchlists', user.id],
    queryFn: () => apiRequest(`/api/users/${user.id}/watchlists`),
    enabled: !!user,
  });
}

// Get from props
function ProductCard({ productId }: { productId: number }) {
  const { data } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => apiRequest(`/api/products/${productId}`),
  });
}
```

### Detection Rule
```bash
# Find hardcoded numeric IDs in API calls
grep -r "apiRequest.*\/[0-9]" client/src

# Find hardcoded IDs in useQuery
grep -r "queryKey:.*\[.*[0-9]" client/src
```

---

## Component Patterns

### Always Reuse Existing Components

**NEVER duplicate components.** Search for existing implementations first.

### ❌ WRONG - Duplicating Navigation
```typescript
// Creating NEW navigation when SharedNavigation exists!
function MyPage() {
  return (
    <div>
      <nav className="...">
        <Link to="/">Home</Link>
        <Link to="/products">Products</Link>
        {/* Duplicating navigation logic */}
      </nav>
      <main>{/* content */}</main>
    </div>
  );
}
```

### ✅ CORRECT - Reuse Shared Components
```typescript
import { SharedNavigation } from "@/components/shared-navigation";

function MyPage() {
  return (
    <div>
      <SharedNavigation />
      <main>{/* content */}</main>
    </div>
  );
}
```

### How to Find Existing Components
```bash
# Search for component by name
grep -r "function ComponentName" client/src/components/
grep -r "export.*ComponentName" client/src/components/

# Find components with similar functionality
grep -r "navigation" client/src/components/
grep -r "hero" client/src/components/
grep -r "category" client/src/components/
```

### Shared Components Reference

**Layout:**
- `SharedNavigation` - App navigation header
- `Footer` - App footer

**Landing Page:**
- `NewHeroSection` - Hero section
- `NewCategories` - Category grid
- `CallToAction` - CTA sections

**UI Primitives (shadcn/ui):**
- `Button` - All button variations
- `Card` - Card layouts
- `Dialog` - Modals
- `Form` - Form components
- `Input` - Input fields
- Many more in `@/components/ui/`

---

## State Management Patterns

### Local State vs Server State

**Local State:** Component-specific UI state (modals, form inputs, tabs)
**Server State:** Data from APIs (products, users, watchlists)

### ✅ CORRECT - React Query for Server State
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetching data
function ProductList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiRequest<Product[]>('/api/products'),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorDisplay error={error} />;

  return <div>{data?.map(product => ...)}</div>;
}

// Mutating data
function DeleteProduct({ productId }: { productId: number }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/products/${productId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
    },
  });

  return (
    <Button
      onClick={() => deleteMutation.mutate()}
      disabled={deleteMutation.isPending}
    >
      Delete
    </Button>
  );
}
```

### ✅ CORRECT - useState for Local State
```typescript
function ModalExample() {
  // UI state - use useState
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('details');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        {/* ... */}
      </Tabs>
    </Dialog>
  );
}
```

---

## API Integration Patterns

### Use Centralized API Client

```typescript
// lib/api-client.ts
import { getCsrfToken } from './csrf';

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken(),
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(error.error, response.status, error.code);
  }

  return response.json();
}

// Usage
const products = await apiRequest<Product[]>('/api/products');

const newProduct = await apiRequest<Product>('/api/products', {
  method: 'POST',
  body: JSON.stringify(productData),
});
```

### Error Handling Pattern

```typescript
function ProductView({ id }: { id: number }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => apiRequest<Product>(`/api/products/${id}`),
  });

  if (isLoading) {
    return <ProductSkeleton />;
  }

  if (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        return <NotFound message="Product not found" />;
      }
      if (error.status === 403) {
        return <AccessDenied />;
      }
    }
    return <ErrorDisplay error={error} />;
  }

  return <ProductDetails product={data} />;
}
```

---

## Frontend Checklist

- [ ] **No client-side data aggregation** - Use dedicated endpoints
- [ ] **Design system compliance** - Use color tokens, not hardcoded values
- [ ] **No hardcoded IDs** - Use dynamic values from params/props/context
- [ ] **Reuse existing components** - Search before creating new ones
- [ ] **React Query for server state** - Not useState
- [ ] **Centralized API client** - Use apiRequest helper
- [ ] **Proper error handling** - Handle all error states
- [ ] **Loading states** - Show skeletons/spinners
- [ ] **Dark mode support** - Test in both themes
- [ ] **Accessibility** - WCAG AA compliance

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) - Complete design system guide
- [COMPONENT_GUIDE.md](COMPONENT_GUIDE.md) - Component architecture
- [API_PATTERNS.md](API_PATTERNS.md) - Backend API patterns
