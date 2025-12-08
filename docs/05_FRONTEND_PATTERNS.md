# Frontend Patterns

**Version:** 2.1
**Last Updated:** 2025-12-08
**Migrated From:**
- docs/FRONTEND_PATTERNS.md (v1.0 - 2025-11-26)
- docs/PHASE1_WATCHLIST_PATTERNS.md (React Query patterns, form handling, pagination - 2025-11-29)

---

## Table of Contents

1. [Overview](#overview)
2. [React Component Patterns](#react-component-patterns)
   - [Component Reuse](#component-reuse)
   - [Design System Compliance](#design-system-compliance)
   - [Conditional UI Rendering](#conditional-ui-rendering)
3. [React Query Patterns](#react-query-patterns)
   - [Mutation Best Practices](#mutation-best-practices)
   - [Query Invalidation Strategy](#query-invalidation-strategy)
   - [Async Handler ESLint Compliance](#async-handler-eslint-compliance)
   - [Cursor-Based Pagination](#cursor-based-pagination)
4. [Form Handling](#form-handling)
   - [Dialog Component Design](#dialog-component-design)
   - [Inline Editing Pattern](#inline-editing-pattern)
   - [Decimal Field Handling](#decimal-field-handling)
5. [State Management](#state-management)
   - [Local State vs Server State](#local-state-vs-server-state)
   - [Component Integration Pattern](#component-integration-pattern)
6. [API Integration Patterns](#api-integration-patterns)
   - [Centralized API Client](#centralized-api-client)
   - [Error Handling](#error-handling)
7. [Performance Patterns](#performance-patterns)
   - [Client-Side Data Aggregation Anti-Pattern](#client-side-data-aggregation-anti-pattern)
   - [Deterministic Sorting for Pagination](#deterministic-sorting-for-pagination)
8. [Common Anti-Patterns](#common-anti-patterns)
   - [Hardcoded Values](#hardcoded-values)
9. [CSS & Tailwind 4 Patterns](#css--tailwind-4-patterns)
   - [Theme Configuration](#theme-configuration)
   - [Custom Utility Classes](#custom-utility-classes)
   - [Avoiding Arbitrary Values](#avoiding-arbitrary-values)
10. [Testing Patterns](#testing-patterns)
11. [Checklist](#frontend-checklist)

---

## Overview

This document codifies frontend patterns to ensure consistent, performant, and maintainable React code in the PriceCompare client application.

**Key Technologies:**
- React 19 with TypeScript
- TanStack React Query (data fetching/caching)
- shadcn/ui components
- Tailwind CSS
- react-intersection-observer (infinite scroll)

**Core Principles:**
- Server state in React Query, local state in useState
- Design system compliance (no hardcoded colors)
- Reuse existing components before creating new ones
- Zero tolerance for `any` types (see `docs/01_TYPESCRIPT_PATTERNS.md`)
- ESLint compliance for all async operations

---

## React Component Patterns

### Component Reuse

**NEVER duplicate components.** Search for existing implementations first.

#### ❌ WRONG - Duplicating Navigation
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

#### ✅ CORRECT - Reuse Shared Components
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

#### How to Find Existing Components
```bash
# Search for component by name
grep -r "function ComponentName" client/src/components/
grep -r "export.*ComponentName" client/src/components/

# Find components with similar functionality
grep -r "navigation" client/src/components/
grep -r "hero" client/src/components/
grep -r "category" client/src/components/
```

#### Shared Components Reference

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

### Design System Compliance

**All UI work MUST follow the design system** to maintain consistency.

#### ❌ WRONG - Hardcoded Color Values

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

#### ✅ CORRECT - Use Design Tokens

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

#### Current Design System Colors

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

#### Detection Rule
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

#### Exceptions (Rare)

Truly dynamic colors calculated at runtime are acceptable:
```typescript
// OK - Dynamic color based on data
<div style={{
  backgroundColor: `hsl(${hue}, 70%, 50%)`,  // Calculated from data
  opacity: confidence
}}>
```

---

### Conditional UI Rendering

**When:** Showing/hiding UI elements based on state

#### Anti-Pattern
```typescript
// ❌ WRONG - UI always present, just hidden
<Button style={{ display: hasAlert ? 'none' : 'block' }}>
  Set Alert
</Button>
```

#### Correct Pattern
```typescript
// ✅ CORRECT - Conditional rendering with proper React pattern
{product.alertStatus === 'none' && (
  <div className="mt-3">
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => setShowAlertDialog(true)}
    >
      <Bell className="w-4 h-4 mr-2" />
      Set Price Alert
    </Button>
  </div>
)}
```

**Why:**
- Only renders when condition is true (better performance)
- Clearer intent in code
- No CSS display tricks
- Better for accessibility (element not in DOM when hidden)

---

## React Query Patterns

### Mutation Best Practices

**When:** Using React Query mutations for API calls

#### Anti-Pattern
```typescript
// ❌ WRONG - No query invalidation, no error handling
const createMutation = useMutation({
  mutationFn: async (data) => {
    await fetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
});
```

#### Correct Pattern
```typescript
// ✅ CORRECT - Comprehensive mutation pattern
const createMutation = useMutation({
  mutationFn: async (data: CreateInput) => {
    return apiRequest<{ id: number }>('/api/resource', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  onSuccess: () => {
    // Invalidate ALL affected queries
    void queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/related'] });

    toast({
      title: "Success",
      description: "Resource created successfully",
    });

    onOpenChange(false);
  },
  onError: (error: Error) => {
    toast({
      title: "Failed",
      description: error.message || "Please try again later",
      variant: "destructive",
    });
  },
});
```

**Key Elements:**
1. ✅ Typed input/output interfaces
2. ✅ Use `apiRequest` helper (handles CSRF, auth)
3. ✅ `void` keyword for fire-and-forget invalidations (ESLint compliance)
4. ✅ Invalidate ALL affected queries (list + stats + related)
5. ✅ Toast for success/error feedback
6. ✅ Close dialog on success only
7. ✅ Error type properly defined

---

### Query Invalidation Strategy

```typescript
// When creating/updating/deleting a resource, invalidate:
void queryClient.invalidateQueries({ queryKey: ['/api/resources'] }); // List view
void queryClient.invalidateQueries({ queryKey: ['/api/resources', id] }); // Detail view
void queryClient.invalidateQueries({ queryKey: ['/api/stats'] }); // Dashboard stats
void queryClient.invalidateQueries({ queryKey: ['/api/related-resources'] }); // Related data
```

**Common Mistakes:**

#### ❌ Mistake 1: No Query Invalidation
```typescript
// Creates alert but watchlist doesn't update
const createMutation = useMutation({
  mutationFn: createAlert,
  onSuccess: () => {
    onOpenChange(false); // Dialog closes but data stale
  }
});
```
**Fix:** Always invalidate related queries

#### ❌ Mistake 2: Missing Query Invalidation
```typescript
onSuccess: () => setIsEditing(false)
```
**Fix:** Invalidate all affected queries

---

### Async Handler ESLint Compliance

**When:** Using async functions in React event handlers or React Query callbacks

#### Anti-Pattern
```typescript
// ❌ WRONG - Floating promise ESLint error
const createMutation = useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] }); // ← Returns promise
  }
});

<Button onClick={handleCreateWatchList}> // ← Async function not awaited
```

#### Correct Pattern
```typescript
// ✅ CORRECT - Use void operator for fire-and-forget
const createMutation = useMutation({
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/stats'] });
  }
});

<Button onClick={() => void handleCreateWatchList()}>
  Create
</Button>
```

**When to use `void`:**
- Query invalidations in mutation callbacks (fire-and-forget)
- Background operations that don't need error handling
- Event handlers where you don't want to propagate promise

**When NOT to use `void`:**
- Operations you need to `await` for sequencing
- Operations where you need to catch errors
- Operations where you need the return value

---

### Cursor-Based Pagination

**When:** Implementing infinite scroll for large datasets

#### Anti-Pattern
```typescript
// ❌ WRONG - Hard limit, no pagination
async getWatchedProducts(userId: number): Promise<WatchedProduct[]> {
  return db.select()
    .from(productWatches)
    .where(eq(productWatches.userId, userId))
    .limit(100); // Hard limit - can't load more
}
```

#### Correct Pattern - Backend

```typescript
// ✅ CORRECT - Cursor-based pagination with metadata
interface WatchedProductsOptions {
  sortBy?: 'priceDropPercent' | 'savings' | 'dateAdded';
  limit?: number;
  cursor?: number; // Last product watch ID from previous page
}

interface WatchedProductsResult {
  products: WatchedProductInfo[];
  hasMore: boolean;
  nextCursor: number | null;
}

async getWatchedProducts(
  userId: number,
  options?: WatchedProductsOptions
): Promise<WatchedProductsResult> {
  const sortBy = options?.sortBy || 'priceDropPercent';
  const limit = Math.min(options?.limit || 50, 100); // Respect bounds
  const cursor = options?.cursor;
  const fetchLimit = limit + 1; // Fetch +1 to detect hasMore

  // Build query with cursor filtering
  const results = await db
    .select({
      id: productWatches.id, // ← Include for cursor pagination
      productId: productWatches.productId,
      // ... other fields
    })
    .from(productWatches)
    .where(
      cursor
        ? and(
            eq(productWatches.userId, userId),
            gt(productWatches.id, cursor) // ← Cursor filter
          )
        : eq(productWatches.userId, userId)
    )
    .limit(fetchLimit); // Fetch limit + 1

  // Process results...
  const enrichedResults = results.map(/* ... */);

  // Implement deterministic sort with secondary key
  enrichedResults.sort((a, b) => {
    switch (sortBy) {
      case 'priceDropPercent':
        const priceDiff = b.priceDropPercent - a.priceDropPercent;
        return priceDiff !== 0 ? priceDiff : a.id - b.id; // ← Secondary sort
      case 'savings':
        const savingsDiff = b.savingsPotential - a.savingsPotential;
        return savingsDiff !== 0 ? savingsDiff : a.id - b.id;
      case 'dateAdded':
        const dateDiff = b.addedAt.getTime() - a.addedAt.getTime();
        return dateDiff !== 0 ? dateDiff : a.id - b.id;
      default:
        return 0;
    }
  });

  // Detect hasMore and calculate nextCursor
  const hasMore = enrichedResults.length > limit;
  const resultProducts = hasMore ? enrichedResults.slice(0, limit) : enrichedResults;
  const nextCursor = hasMore && resultProducts.length > 0
    ? resultProducts[resultProducts.length - 1].id
    : null;

  return {
    products: resultProducts,
    hasMore,
    nextCursor,
  };
}
```

**Key Elements (Backend):**
1. ✅ Fetch limit + 1 pattern to detect `hasMore`
2. ✅ Use `gt(productWatches.id, cursor)` for cursor filtering
3. ✅ Return `{ products, hasMore, nextCursor }` envelope
4. ✅ Respect limit bounds (min 1, max 100)
5. ✅ Deterministic sort with secondary key (prevents pagination bugs)
6. ✅ Include `id` field in result for cursor calculation

#### Correct Pattern - API Route

```typescript
// ✅ CORRECT - Route accepts cursor and limit parameters
app.get("/api/watchlists/products", withAuth(async (req, res) => {
  try {
    const userId = req.user.id;
    const sortBy = req.query.sortBy as 'priceDropPercent' | 'savings' | 'dateAdded' | undefined;

    // Validate pagination parameters
    const cursor = req.query.cursor
      ? parseIntSafe(req.query.cursor as string, 'cursor', { min: 1 })
      : undefined;
    const limit = req.query.limit
      ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 })
      : 50;

    const result = await storage.getWatchedProducts(userId, { sortBy, cursor, limit });

    sendSuccess(res, result); // Returns { products, hasMore, nextCursor }
  } catch (error: unknown) {
    sendErrorFromException(res, error, 'GetWatchedProducts');
  }
}));
```

#### Correct Pattern - Frontend Hook

```typescript
// ✅ CORRECT - useInfiniteQuery for cursor pagination
export function useWatchedProducts(options?: {
  sortBy?: 'priceDropPercent' | 'savings' | 'dateAdded';
}) {
  return useInfiniteQuery({
    queryKey: ['/api/watchlists/products', options?.sortBy || 'priceDropPercent'],
    queryFn: async ({ pageParam }: { pageParam: number | null }) => {
      const sortBy = options?.sortBy || 'priceDropPercent';
      const params = new URLSearchParams({ sortBy });
      if (pageParam !== null) {
        params.append('cursor', String(pageParam));
      }
      const url = `/api/watchlists/products?${params.toString()}`;
      return apiRequest<{
        products: WatchedProduct[];
        hasMore: boolean;
        nextCursor: number | null
      }>(url);
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
```

**Key Elements (Frontend Hook):**
1. ✅ Use `useInfiniteQuery` (not `useQuery`)
2. ✅ Type `pageParam` explicitly
3. ✅ `getNextPageParam` returns `undefined` when no more pages
4. ✅ `initialPageParam: null` for first page
5. ✅ Let TypeScript infer types (no explicit generics)
6. ✅ Query key includes sort option for cache separation

#### Correct Pattern - UI Component

```typescript
// ✅ CORRECT - Infinite scroll with react-intersection-observer
import { useState, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';

export function PriceWatchPage() {
  const [sortBy, setSortBy] = useState<SortOption>('priceDropPercent');

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWatchedProducts({ sortBy });

  // Flatten paginated products
  const products = useMemo(() => {
    if (!data || !data.pages) return [];
    return data.pages.flatMap((page: { products: WatchedProduct[] }) => page.products);
  }, [data]);

  // Infinite scroll trigger
  const { ref: infiniteScrollRef } = useInView({
    threshold: 0.1,
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
  });

  // ... filter logic

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product: WatchedProduct) => (
          <ProductCard key={product.productId} product={product} />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      {hasNextPage && (
        <div ref={infiniteScrollRef} className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Optional: show loading state for next page */}
      {isFetchingNextPage && !hasNextPage && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
    </>
  );
}
```

**Key Elements (UI):**
1. ✅ Import `useInView` from `react-intersection-observer`
2. ✅ Flatten `data.pages` with `flatMap`
3. ✅ Trigger `fetchNextPage()` when trigger div enters viewport
4. ✅ Check `hasNextPage && !isFetchingNextPage` before fetching
5. ✅ Use `void` operator to mark fire-and-forget promise
6. ✅ Show loading spinner at trigger point
7. ✅ Type `page` parameter in flatMap

#### Common Pagination Mistakes

**❌ Mistake 1: No Secondary Sort Key**
```typescript
results.sort((a, b) => b.price - a.price); // Indeterminate for equal prices
```
**Fix:** Always add secondary sort on ID (see [Deterministic Sorting](#deterministic-sorting-for-pagination))

**❌ Mistake 2: Forgetting Limit + 1**
```typescript
.limit(limit); // Can't detect hasMore
```
**Fix:** Fetch `limit + 1` and slice

**❌ Mistake 3: Wrong getNextPageParam**
```typescript
getNextPageParam: (lastPage) => lastPage.nextCursor, // Returns null instead of undefined
```
**Fix:** Return `undefined` when no more pages

**❌ Mistake 4: Missing ID in Result**
```typescript
// Storage doesn't return id field
{ productId, name, price } // ← Missing id for cursor!
```
**Fix:** Include `id: productWatches.id` in select

**❌ Mistake 5: Type Mismatch**
```typescript
interface WatchedProduct {
  productId: number;
  // ❌ Missing id field!
}
```
**Fix:** Add `id: number` to match API response

---

## Form Handling

### Dialog Component Design

**When:** Creating modal dialogs for user input

#### Anti-Pattern
```typescript
// ❌ WRONG - No validation, no loading states, no error handling
function CreateDialog({ open, onClose }) {
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    await fetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify({ value })
    });
    onClose();
  };

  return <Dialog open={open}>...</Dialog>;
}
```

#### Correct Pattern

```typescript
// ✅ CORRECT - Complete dialog pattern
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreateDialogProps {
  // Specific, well-typed props
  resourceId: number;
  resourceName: string;
  currentValue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreateInput {
  resourceId: number;
  value: number;
}

export function CreateDialog({
  resourceId,
  resourceName,
  currentValue,
  open,
  onOpenChange
}: CreateDialogProps) {
  // Smart defaults
  const defaultValue = Math.round(currentValue * 0.9 * 100) / 100;
  const [value, setValue] = useState<number>(defaultValue);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // React Query mutation with proper error handling
  const createMutation = useMutation({
    mutationFn: async (data: CreateInput) => {
      return apiRequest<{ id: number }>('/api/resources', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate ALL relevant queries
      void queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/stats'] });

      toast({
        title: "Success",
        description: `Resource created for ${resourceName}`,
      });

      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Client-side validation
  const handleCreate = () => {
    if (value <= 0) {
      toast({
        title: "Invalid value",
        description: "Value must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (value >= currentValue) {
      toast({
        title: "Invalid value",
        description: "Value should be lower than current",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      resourceId,
      value,
    });
  };

  // Reset to default when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setValue(defaultValue);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create Resource
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Name - Read-only display */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Resource
            </Label>
            <p className="text-sm font-medium mt-1 line-clamp-2">
              {resourceName}
            </p>
          </div>

          {/* Current Value - Read-only display */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Current Value
            </Label>
            <p className="text-lg font-bold mt-1">
              ${currentValue.toFixed(2)}
            </p>
          </div>

          {/* Input with constraints */}
          <div>
            <Label htmlFor="value" className="text-sm font-medium">
              Target Value:
            </Label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-medium text-muted-foreground">$</span>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0.01"
                max={currentValue}
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                className="text-lg font-semibold"
                autoFocus
              />
            </div>
            {/* Real-time calculation display */}
            <p className="text-xs text-muted-foreground mt-1">
              {value > 0 && value < currentValue
                ? `Save $${(currentValue - value).toFixed(2)} (${Math.round(((currentValue - value) / currentValue) * 100)}% off)`
                : '\u00A0' // Non-breaking space to maintain layout
              }
            </p>
          </div>
        </div>

        {/* Actions with disabled states */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || value <= 0 || value >= currentValue}
          >
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Key Elements:**
1. ✅ Well-typed props interface
2. ✅ Smart default values
3. ✅ React Query mutation with error handling
4. ✅ Query invalidation (ALL relevant queries)
5. ✅ Toast notifications for feedback
6. ✅ Client-side validation
7. ✅ Disabled states during mutation
8. ✅ Reset state when dialog opens
9. ✅ Real-time calculations
10. ✅ Accessible (labels, focus, semantic HTML)

**Check:** Dialog components should have ALL these elements.

---

### Inline Editing Pattern

**When:** Implementing inline editing of field values without navigation

#### Anti-Pattern
```typescript
// ❌ WRONG - Always shows edit button, no state management
<div>
  <span>${targetPrice}</span>
  <Button onClick={() => navigate(`/edit/${id}`)}>Edit</Button>
</div>
```

#### Correct Pattern

**Backend: Include Edit Data in List Response**
```typescript
// ✅ CORRECT - Include editable field data in list query
const results = await db.select({
  id: productWatches.id,
  // ... other fields
  // Alert details for inline editing
  alertId: sql<number | null>`
    (SELECT id FROM ${priceAlerts}
     WHERE ${priceAlerts.productId} = ${products.id}
       AND ${priceAlerts.userId} = ${userId}
     ORDER BY ${priceAlerts.createdAt} DESC
     LIMIT 1)
  `.as('alert_id'),
  alertTargetPrice: sql<string | null>`
    (SELECT ${priceAlerts.targetPrice} FROM ${priceAlerts}
     WHERE ${priceAlerts.productId} = ${products.id}
       AND ${priceAlerts.userId} = ${userId}
     ORDER BY ${priceAlerts.createdAt} DESC
     LIMIT 1)
  `.as('alert_target_price'),
});

// Type assertion: Drizzle returns numeric fields as strings, convert to number for API response
alertTargetPrice: r.alertTargetPrice ? parseFloat(r.alertTargetPrice) : null,
```

**Frontend: Inline Editing UI Pattern**
```typescript
// ✅ CORRECT - Complete inline editing pattern
export function ItemCard({ item }: ItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState<number>(item.value || 0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // React Query mutation
  const updateMutation = useMutation({
    mutationFn: async (newValue: number) => {
      if (!item.id) throw new Error('No ID available');
      return apiRequest<{ id: number }>(`/api/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: newValue }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/items'] });
      toast({ title: "Value updated", description: `New value: ${editedValue}` });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    // Client-side validation
    if (editedValue <= 0) {
      toast({ title: "Invalid value", description: "Value must be > 0", variant: "destructive" });
      return;
    }
    updateMutation.mutate(editedValue);
  };

  const handleCancel = () => {
    setEditedValue(item.value || 0);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setEditedValue(item.value || 0);
    setIsEditing(true);
  };

  return (
    <Card>
      {/* Conditional rendering based on field existence */}
      {item.value !== null && (
        <div className="mt-3 pt-3 border-t border-border">
          {isEditing ? (
            // Editing mode
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Value:</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editedValue}
                  onChange={(e) => setEditedValue(parseFloat(e.target.value) || 0)}
                  className="h-8"
                  autoFocus
                  disabled={updateMutation.isPending}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending || editedValue <= 0}
                >
                  <Check className="w-3 h-3 mr-1" />
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // Display mode
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">${item.value.toFixed(2)}</span>
              <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                <Edit2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

**Key Elements:**
1. ✅ Edit button shown only when field exists (conditional rendering)
2. ✅ Local state for editing mode (`isEditing`, `editedValue`)
3. ✅ React Query mutation with error handling
4. ✅ Client-side validation before mutation
5. ✅ Disabled states during mutation
6. ✅ Reset state on cancel (restore original value)
7. ✅ Auto-focus on input when editing starts
8. ✅ Toast notifications for success/error
9. ✅ Query invalidation after successful update

#### Common Inline Editing Mistakes

**❌ Mistake 1: No Conditional Rendering**
```typescript
// Always shows edit button, even when field is null
<Button onClick={handleEdit}>Edit</Button>
```
**Fix:** Only render when field exists

**❌ Mistake 2: No State Reset on Cancel**
```typescript
const handleCancel = () => setIsEditing(false); // editedValue not reset!
```
**Fix:** Reset edited value to original on cancel

**❌ Mistake 3: No Client Validation**
```typescript
// Sends invalid data to server
updateMutation.mutate(editedValue);
```
**Fix:** Validate before mutation

**❌ Mistake 4: No Loading State**
```typescript
<Button onClick={handleSave}>Save</Button>
```
**Fix:** Disable during mutation, show "Saving..."

---

### Decimal Field Handling

**When:** Working with PostgreSQL numeric/decimal fields and JavaScript numbers (CRITICAL)

#### Problem

PostgreSQL stores decimals as strings in Drizzle ORM. Frontend expects numbers. Without proper conversion, type mismatches occur.

#### Anti-Pattern
```typescript
// ❌ WRONG - No type conversion
const targetPrice: number = dbResult.targetPrice; // Type error!
```

#### Correct Pattern

**Backend: Convert on Read**
```typescript
// ✅ CORRECT - Document type conversion
return {
  // Type assertion: Drizzle returns numeric fields as strings, convert to number for API response
  targetPrice: r.targetPrice ? parseFloat(r.targetPrice) : null,
};
```

**Backend: Convert on Write**
```typescript
// ✅ CORRECT - Convert to string with fixed decimals
const validatedData = schema.parse(req.body); // number from Zod
await storage.update({
  targetPrice: validatedData.targetPrice.toFixed(2), // Convert to string
});
```

**Frontend: Round to Avoid Floating Point Errors**
```typescript
// ✅ CORRECT - Round to match backend validation
const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const parsed = parseFloat(e.target.value);
  // Round to 2 decimals to match Zod .multipleOf(0.01)
  const rounded = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
  setEditedPrice(rounded);
};
```

**Why This Matters:**
- Prevents floating point artifacts (99.98999999999999)
- Matches backend validation exactly (.multipleOf(0.01))
- Ensures consistent display/storage

**Backend Validation Pattern:**
```typescript
// ✅ CORRECT - Zod validation + type conversion
import { z } from "zod";

const createAlertSchema = z.object({
  productId: z.number()
    .int('Product ID must be an integer')
    .min(1, 'Product ID must be positive'),
  targetPrice: z.number()
    .positive('Target price must be positive')
    .multipleOf(0.01, 'Price must have maximum 2 decimal places'),
  notifyForum: z.boolean().optional().default(false),
});

app.post('/api/alerts', csrfProtection, withAuth(async (req, res) => {
  try {
    // PHASE 0 PATTERN: Validation at route layer
    const validatedData = createAlertSchema.parse(req.body);

    // Verify related entity exists
    const product = await storage.getProductById(validatedData.productId);
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    const alert = await storage.createAlert({
      userId: req.user.id,
      productId: validatedData.productId,
      targetPrice: validatedData.targetPrice.toFixed(2), // ← Convert to string for decimal
      notifyForum: validatedData.notifyForum,
    });

    sendSuccess(res, alert, 201);
  } catch (error: unknown) {
    sendErrorFromException(res, error, 'CreateAlert');
  }
}));
```

**Key Steps:**
1. ✅ Zod schema with `.multipleOf(0.01)` for decimal precision
2. ✅ Validate at route layer (Phase 0 pattern)
3. ✅ Verify foreign key references exist (prevents FK failures)
4. ✅ Convert number to string with `.toFixed(2)` for Drizzle decimal
5. ✅ Use standardized response helpers

**Schema Pattern for Updates:**
```typescript
const updateAlertSchema = z.object({
  targetPrice: z.number()
    .positive('Target price must be positive')
    .multipleOf(0.01, 'Price must have maximum 2 decimal places')
    .optional(),
  isActive: z.boolean().optional(),
  notifyForum: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// In PATCH handler
const validatedData = updateAlertSchema.parse(req.body);
const updates = {
  ...validatedData,
  targetPrice: validatedData.targetPrice?.toFixed(2), // Optional chaining
};
```

---

## State Management

### Local State vs Server State

**Local State:** Component-specific UI state (modals, form inputs, tabs)
**Server State:** Data from APIs (products, users, watchlists)

#### ✅ CORRECT - React Query for Server State
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
      void queryClient.invalidateQueries({ queryKey: ['products'] });
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

#### ✅ CORRECT - useState for Local State
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

### Component Integration Pattern

**When:** Integrating dialog components into parent components

#### Anti-Pattern
```typescript
// ❌ WRONG - Prop drilling, no state management
function ParentCard({ product, showDialog, setShowDialog }) {
  return (
    <Card>
      <Button onClick={() => setShowDialog(true)}>Open</Button>
      <CreateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        productId={product.id}
        productName={product.name}
        currentPrice={product.price}
      />
    </Card>
  );
}
```

#### Correct Pattern
```typescript
// ✅ CORRECT - Local state, conditional rendering, clear separation
import { useState } from 'react';
import { CreateDialog } from '../dialogs/create-dialog';

export function ResourceCard({ resource, onRemove }: ResourceCardProps) {
  // Local state for dialog visibility
  const [showDialog, setShowDialog] = useState(false);

  return (
    <Card>
      {/* Existing card content */}

      {/* Conditional button (only when action is available) */}
      {resource.status === 'pending' && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowDialog(true)}
          >
            <Icon className="w-4 h-4 mr-2" />
            Action Label
          </Button>
        </div>
      )}

      {/* Dialog component */}
      <CreateDialog
        resourceId={resource.id}
        resourceName={resource.name}
        currentValue={resource.value}
        open={showDialog}
        onOpenChange={setShowDialog}
      />
    </Card>
  );
}
```

**Key Elements:**
1. ✅ Local state management (no prop drilling)
2. ✅ Conditional rendering based on state
3. ✅ Clear separation of concerns
4. ✅ Dialog receives only what it needs
5. ✅ Accessible button with icon + label

---

## API Integration Patterns

### Centralized API Client

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

---

### Error Handling

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

## Performance Patterns

### Client-Side Data Aggregation Anti-Pattern

#### ❌ WRONG - Fetching All Data Then Aggregating on Client

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

#### ✅ CORRECT - Dedicated Backend Endpoint

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

#### Detection Rule
```bash
# Find components fetching multiple collections then iterating
grep -r "useQuery.*watchlists" client/src | xargs grep -l "for.*of.*watchlists"
grep -r "\.map.*\.map" client/src  # Nested iterations often indicate client-side aggregation
```

---

### Deterministic Sorting for Pagination

**When:** Sorting data for cursor-based pagination

#### Anti-Pattern
```typescript
// ❌ WRONG - No secondary sort key
results.sort((a, b) => {
  return b.priceDropPercent - a.priceDropPercent; // What if equal?
});
```

**Problem:** When two items have equal sort values, order is indeterminate. This causes:
- Items appearing in different order on refresh
- Duplicate items across pages
- Skipped items when paginating

#### Correct Pattern
```typescript
// ✅ CORRECT - Deterministic sort with secondary key
results.sort((a, b) => {
  // Primary sort: price drop percent (descending)
  const primaryDiff = b.priceDropPercent - a.priceDropPercent;

  // Secondary sort: ID (ascending) for determinism
  return primaryDiff !== 0 ? primaryDiff : a.id - b.id;
});
```

**Why this matters:**
- Pagination cursors are based on IDs
- If sort order changes, cursor becomes invalid
- Secondary sort ensures stable ordering across pagination

**General Pattern:**
```typescript
results.sort((a, b) => {
  const primaryDiff = /* primary comparison */;
  return primaryDiff !== 0 ? primaryDiff : a.id - b.id;
});
```

---

## Common Anti-Patterns

### Hardcoded Values

#### ❌ WRONG - Hardcoded IDs and Constants

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

#### ✅ CORRECT - Use Dynamic Values

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

#### Detection Rule
```bash
# Find hardcoded numeric IDs in API calls
grep -r "apiRequest.*\/[0-9]" client/src

# Find hardcoded IDs in useQuery
grep -r "queryKey:.*\[.*[0-9]" client/src
```

---

## CSS & Tailwind 4 Patterns

This project uses **Tailwind CSS v4** with the Vite plugin (`@tailwindcss/vite`). Configuration is CSS-first using the `@theme` directive.

### Theme Configuration

**Location:** `client/src/index.css`

All design tokens are defined in the `@theme` block using CSS custom properties:

```css
@import 'tailwindcss';

@theme {
  /* Brand Colors (HSL format for opacity support) */
  --color-primary: 217 91% 60%;           /* Blue 500 */
  --color-primary-hover: 217 91% 55%;
  --color-primary-foreground: 0 0% 100%;
  --color-secondary: 38 92% 50%;          /* Amber 500 */
  --color-secondary-hover: 38 92% 45%;
  --color-secondary-foreground: 0 0% 100%;

  /* Semantic Colors */
  --color-destructive: 0 84% 60%;
  --color-success: 142 71% 45%;
  --color-warning: 38 92% 50%;
  --color-error: 0 84% 60%;
  --color-info: 199 89% 48%;

  /* Promotional Colors (for CTAs, banners) */
  --color-promo: 0 82% 71%;               /* Coral/Salmon */
  --color-promo-hover: 0 82% 66%;
  --color-promo-foreground: 0 0% 100%;

  /* Extended Font Sizes */
  --font-size-2xs: 0.625rem;              /* 10px - badges, small labels */

  /* Border Radius */
  --radius: 1rem;
  --radius-lg: 1.5rem;
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}
```

**Key Points:**
- Use HSL format for colors to support opacity modifiers (`bg-primary/50`)
- Add new tokens to `@theme` instead of using arbitrary values
- Document what each token represents with comments

---

### Custom Utility Classes

Define reusable utilities in `@layer components` within `index.css`:

```css
@layer components {
  /* Extra small text - 10px for badges and compact labels */
  .text-2xs {
    font-size: var(--font-size-2xs);
    line-height: 1;
  }

  /* Promotional button styling */
  .btn-promo {
    background-color: hsl(var(--color-promo));
    color: hsl(var(--color-promo-foreground));
  }

  .btn-promo:hover {
    background-color: hsl(var(--color-promo-hover));
  }

  /* Gradient utilities */
  .gradient-brand {
    background: linear-gradient(to right, hsl(var(--color-primary)), hsl(var(--color-secondary)));
  }
}
```

**When to Create Custom Utilities:**
- Pattern repeated 3+ times across components
- Complex multi-property styling
- Semantic meaning (`.btn-promo` vs `bg-[#ff6b6b]`)

---

### Avoiding Arbitrary Values

**NEVER use arbitrary values when a theme token exists or can be created.**

#### ❌ WRONG - Hardcoded Arbitrary Values

```tsx
// Hardcoded hex colors - breaks design system
<button className="bg-[#ff6b6b] hover:bg-[#ff5252] text-white">
  Subscribe
</button>

// Hardcoded font size - inconsistent, unmaintainable
<span className="text-[10px] font-bold">
  SALE
</span>

// Arbitrary spacing that should be standard
<div className="p-[13px] mt-[7px]">
  Content
</div>
```

#### ✅ CORRECT - Use Theme Tokens

```tsx
// Use semantic utility class
<button className="btn-promo rounded-lg px-6 py-3.5 font-semibold transition-colors">
  Subscribe
</button>

// Use defined font size token
<span className="text-2xs font-bold">
  SALE
</span>

// Use standard Tailwind spacing
<div className="p-3 mt-2">
  Content
</div>
```

#### When to Create New Theme Tokens

If you find yourself needing an arbitrary value repeatedly:

1. **Add the token to `@theme`:**
```css
@theme {
  --font-size-2xs: 0.625rem;  /* 10px */
  --color-promo: 0 82% 71%;   /* Coral */
}
```

2. **Create a utility class if needed:**
```css
@layer components {
  .text-2xs {
    font-size: var(--font-size-2xs);
    line-height: 1;
  }
}
```

3. **Update components to use the token:**
```tsx
// Before: text-[10px]
// After:  text-2xs
<span className="text-2xs font-bold">Badge</span>
```

---

### Detection Rules

```bash
# Find hardcoded hex colors in className
grep -r "bg-\[#" client/src --include="*.tsx"
grep -r "text-\[#" client/src --include="*.tsx"
grep -r "border-\[#" client/src --include="*.tsx"

# Find arbitrary font sizes (likely need tokens)
grep -r "text-\[.*px\]" client/src --include="*.tsx"

# Find inline styles with colors (should use Tailwind)
grep -r "style=.*backgroundColor" client/src --include="*.tsx"
grep -r "style=.*color:" client/src --include="*.tsx"
```

---

### Tailwind 4 Migration Notes

If migrating from Tailwind v3:

| v3 Pattern | v4 Pattern |
|------------|------------|
| `@tailwind base;` | `@import 'tailwindcss';` |
| `@tailwind components;` | (included in import) |
| `@tailwind utilities;` | (included in import) |
| `tailwind.config.js` theme | `@theme { }` in CSS |
| `bg-opacity-50` | `bg-black/50` |
| `text-opacity-50` | `text-black/50` |
| `@layer utilities { }` | `@utility name { }` (for variants) |

**Current Setup:**
- Uses `@tailwindcss/vite` plugin (not PostCSS)
- Configuration in `index.css` via `@theme`
- Legacy `tailwind.config.ts` exists for `tailwindcss-animate` plugin

---

## Testing Patterns

### Dialog Components

**Required Test Coverage:**

```typescript
describe('Dialog Component', () => {
  it('should open when trigger clicked', () => {
    // Test dialog opens
  });

  it('should close on cancel', () => {
    // Test cancel button
  });

  it('should close on successful submission', () => {
    // Test successful submit closes dialog
  });

  it('should stay open on error', () => {
    // Test error handling
  });

  it('should show loading state during mutation', () => {
    // Test isPending state
  });

  it('should disable buttons during mutation', () => {
    // Test disabled state
  });

  it('should reset to default values when reopened', () => {
    // Test state reset
  });

  it('should validate input before submission', () => {
    // Test validation
  });

  it('should show error toast on failure', () => {
    // Test error feedback
  });

  it('should show success toast on completion', () => {
    // Test success feedback
  });

  it('should invalidate correct queries', () => {
    // Test query invalidation
  });
});
```

### Inline Editing

```typescript
describe('Inline Editing', () => {
  it('should show edit button only when field exists', () => {
    const { getByLabelText } = render(<ItemCard item={{ id: 1, value: null }} />);
    expect(() => getByLabelText('Edit')).toThrow();

    const { getByLabelText: getButton } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    expect(getButton('Edit')).toBeInTheDocument();
  });

  it('should enter editing mode on edit button click', () => {
    const { getByLabelText, getByRole } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    fireEvent.click(getByLabelText('Edit'));
    expect(getByRole('textbox')).toBeInTheDocument();
  });

  it('should validate input before saving', async () => {
    const { getByLabelText, getByText } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    fireEvent.click(getByLabelText('Edit'));
    fireEvent.change(getByRole('textbox'), { target: { value: '-5' } });
    fireEvent.click(getByText('Save'));
    // Mutation should NOT be called
    expect(mockMutation).not.toHaveBeenCalled();
  });

  it('should reset value on cancel', () => {
    const { getByLabelText, getByText, getByRole } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    fireEvent.click(getByLabelText('Edit'));
    fireEvent.change(getByRole('textbox'), { target: { value: '60' } });
    fireEvent.click(getByText('Cancel'));
    // Should exit editing mode and reset value
    expect(getByText('$50.00')).toBeInTheDocument();
  });

  it('should invalidate queries on successful save', async () => {
    const { getByLabelText, getByText, getByRole } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    fireEvent.click(getByLabelText('Edit'));
    fireEvent.change(getByRole('textbox'), { target: { value: '45' } });
    fireEvent.click(getByText('Save'));
    await waitFor(() => {
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/items'] });
    });
  });
});
```

### Pagination

```typescript
describe('getWatchedProducts - Pagination', () => {
  it('should return hasMore=true when more products exist', async () => {
    // Create 5 products, fetch limit 2
    const result = await storage.getWatchedProducts(userId, { limit: 2 });

    expect(result.products).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeGreaterThan(0);
  });

  it('should return hasMore=false on last page', async () => {
    const result = await storage.getWatchedProducts(userId, { limit: 10 });

    expect(result.products).toHaveLength(5); // Only 5 products exist
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('should fetch second page using nextCursor', async () => {
    const page1 = await storage.getWatchedProducts(userId, { limit: 2 });
    const page2 = await storage.getWatchedProducts(userId, {
      limit: 2,
      cursor: page1.nextCursor!
    });

    expect(page2.products[0].id).not.toBe(page1.products[0].id);
    expect(page2.products[0].id).not.toBe(page1.products[1].id);
  });

  it('should handle empty results', async () => {
    const result = await storage.getWatchedProducts(userWithNoProducts);

    expect(result.products).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});
```

---

## Frontend Checklist

### General
- [ ] **No client-side data aggregation** - Use dedicated endpoints
- [ ] **Design system compliance** - Use color tokens, not hardcoded values
- [ ] **No hardcoded IDs** - Use dynamic values from params/props/context
- [ ] **Reuse existing components** - Search before creating new ones
- [ ] **Zero `any` types** - See `docs/01_TYPESCRIPT_PATTERNS.md`

### State Management
- [ ] **React Query for server state** - Not useState
- [ ] **useState for local UI state** - Modals, tabs, form inputs
- [ ] **Proper query invalidation** - All affected queries

### Forms & Dialogs
- [ ] **Dialog pattern complete** - All 10 key elements (validation, loading, error handling, etc.)
- [ ] **Inline editing conditional** - Only show when field exists
- [ ] **Decimal handling correct** - Round on input, convert on API call
- [ ] **Client-side validation** - Before mutations
- [ ] **Loading states** - Show during mutations

### API & Performance
- [ ] **Centralized API client** - Use apiRequest helper
- [ ] **Proper error handling** - Handle all error states
- [ ] **ESLint compliance** - `void` for fire-and-forget promises
- [ ] **Cursor pagination** - For large datasets
- [ ] **Deterministic sorting** - Secondary sort on ID

### CSS & Tailwind
- [ ] **No arbitrary hex colors** - Use theme tokens (`bg-primary`, not `bg-[#3B82F6]`)
- [ ] **No arbitrary font sizes** - Use `text-2xs` for 10px, not `text-[10px]`
- [ ] **New tokens in @theme** - Add reusable values to CSS, not arbitrary
- [ ] **Custom utilities documented** - In `@layer components`
- [ ] **Dark mode tested** - Verify theme works in both modes

### UI/UX
- [ ] **Loading states** - Show skeletons/spinners
- [ ] **Dark mode support** - Test in both themes
- [ ] **Accessibility** - WCAG AA compliance
- [ ] **Conditional rendering** - Only render when needed

---

## Related Documentation

- [CLAUDE.md](/Users/williamtower/projects/PriceCompare/CLAUDE.md) - Main project guidelines
- [docs/01_TYPESCRIPT_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/01_TYPESCRIPT_PATTERNS.md) - Type safety patterns
- [docs/02_DATABASE_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/02_DATABASE_PATTERNS.md) - Database best practices
- [docs/03_API_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/03_API_PATTERNS.md) - Backend API patterns
- [docs/04_SECURITY_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/04_SECURITY_PATTERNS.md) - Security best practices
- [docs/06_ERROR_HANDLING_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/06_ERROR_HANDLING_PATTERNS.md) - Error handling
- [docs/COMPONENT_GUIDE.md](/Users/williamtower/projects/PriceCompare/docs/COMPONENT_GUIDE.md) - Component architecture
- [docs/API_DOCUMENTATION.md](/Users/williamtower/projects/PriceCompare/docs/API_DOCUMENTATION.md) - API endpoint reference

---

**Pattern Consolidation History:**
- **v1.0** (2025-11-26): Initial FRONTEND_PATTERNS.md covering design system, component reuse, anti-patterns
- **v2.0** (2025-11-29): Merged React Query patterns (mutations, pagination, async handlers), form handling (dialogs, inline editing), and decimal handling from PHASE1_WATCHLIST_PATTERNS.md
- **v2.1** (2025-12-08): Added CSS & Tailwind 4 patterns section with theme tokens, custom utilities, and arbitrary value guidance
