# Phase 1 Watchlist Enhancement Patterns

**Last Updated:** 2025-11-28
**Phase:** 1 - Core UX Improvements
**Status:** Task 1.1 Complete ✅

---

## Overview

This document codifies patterns established during Phase 1 of the watchlist enhancement project. These patterns build on Phase 0 foundations and add new best practices for React component design, dialog patterns, and backend validation.

**Key Achievement:** Successfully implemented price alert creation from watchlist without navigation, following all Phase 0 patterns.

---

## Pattern 1: Dialog Component Design

**When:** Creating modal dialogs for user input

### Anti-Pattern (Don't Do This)
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

### Correct Pattern
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

## Pattern 2: Conditional UI Rendering

**When:** Showing/hiding UI elements based on state

### Anti-Pattern
```typescript
// ❌ WRONG - UI always present, just hidden
<Button style={{ display: hasAlert ? 'none' : 'block' }}>
  Set Alert
</Button>
```

### Correct Pattern
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

## Pattern 3: Backend Validation for Decimal Fields

**When:** Working with Drizzle decimal fields (targetPrice, currentPrice, etc.)

### Anti-Pattern
```typescript
// ❌ WRONG - Type mismatch, no validation
app.post('/api/alerts', async (req, res) => {
  const { productId, targetPrice } = req.body;

  await storage.createAlert({
    productId,
    targetPrice, // Number sent, but DB expects string
  });
});
```

### Correct Pattern
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

## Pattern 4: React Query Mutation Best Practices

**When:** Using React Query mutations for API calls

### Anti-Pattern
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

### Correct Pattern
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

**Query Invalidation Strategy:**
```typescript
// When creating/updating/deleting a resource, invalidate:
void queryClient.invalidateQueries({ queryKey: ['/api/resources'] }); // List view
void queryClient.invalidateQueries({ queryKey: ['/api/resources', id] }); // Detail view
void queryClient.invalidateQueries({ queryKey: ['/api/stats'] }); // Dashboard stats
void queryClient.invalidateQueries({ queryKey: ['/api/related-resources'] }); // Related data
```

---

## Pattern 5: Component Integration Pattern

**When:** Integrating dialog components into parent components

### Anti-Pattern
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

### Correct Pattern
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

## Pattern 6: Foreign Key Validation

**When:** Creating records that reference other entities

### Anti-Pattern
```typescript
// ❌ WRONG - No FK validation, fails at DB level with 500
app.post('/api/alerts', async (req, res) => {
  const { productId, targetPrice } = req.body;

  const alert = await storage.createAlert({
    productId, // What if this product doesn't exist?
    targetPrice,
  });

  sendSuccess(res, alert, 201);
});
```

### Correct Pattern
```typescript
// ✅ CORRECT - Validate FK before insert
app.post('/api/alerts', csrfProtection, withAuth(async (req, res) => {
  try {
    const validatedData = createAlertSchema.parse(req.body);

    // Verify product exists (prevents FK constraint failure)
    const product = await storage.getProductById(validatedData.productId);
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    const alert = await storage.createAlert({
      userId: req.user.id,
      productId: validatedData.productId,
      targetPrice: validatedData.targetPrice.toFixed(2),
    });

    sendSuccess(res, alert, 201);
  } catch (error: unknown) {
    sendErrorFromException(res, error, 'CreateAlert');
  }
}));
```

**Benefits:**
- ✅ Returns clear 404 instead of generic 500
- ✅ Prevents database constraint failures
- ✅ Better error messages for clients
- ✅ Validates business logic before storage

**When to Skip FK Validation:**
- Foreign key is optional (nullable)
- Performance-critical path (acceptable to catch DB error)
- FK guaranteed to exist (e.g., user from session)

---

## Common Mistakes to Avoid

### ❌ Mistake 1: No Query Invalidation
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

### ❌ Mistake 2: Missing Loading States
```typescript
<Button onClick={handleCreate}>Create</Button>
```
**Fix:** Disable during mutation + show loading text

### ❌ Mistake 3: No Client Validation
```typescript
// Sends invalid data to server
const handleCreate = () => {
  createMutation.mutate({ value: -5 });
};
```
**Fix:** Validate before mutation

### ❌ Mistake 4: Wrong Decimal Type
```typescript
// Sends number to decimal field
targetPrice: validatedData.targetPrice, // Type error
```
**Fix:** Convert with `.toFixed(2)`

### ❌ Mistake 5: No FK Validation
```typescript
// Creates alert for non-existent product
await createAlert({ productId: 99999 }); // FK constraint fails
```
**Fix:** Verify entity exists first

---

## Testing Checklist

**Dialog Component:**
- [ ] Opens when trigger clicked
- [ ] Closes on cancel
- [ ] Closes on successful submission
- [ ] Stays open on error
- [ ] Shows loading state during mutation
- [ ] Disables buttons during mutation
- [ ] Resets to default values when reopened
- [ ] Validates input before submission
- [ ] Shows error toast on failure
- [ ] Shows success toast on completion
- [ ] Invalidates correct queries

**Backend Validation:**
- [ ] Rejects invalid productId (negative, non-integer)
- [ ] Rejects invalid targetPrice (negative, too many decimals)
- [ ] Returns 404 when product doesn't exist
- [ ] Returns 400 for validation errors
- [ ] Returns 201 on successful creation
- [ ] Stores targetPrice as string in database
- [ ] Respects CSRF protection
- [ ] Requires authentication

---

## Files Reference

**Implementation Examples:**
- `client/src/components/watchlist/create-price-alert-dialog.tsx` - Complete dialog pattern
- `client/src/components/price-watch/WatchedProductCard.tsx` - Component integration
- `server/routes/alert-routes.ts` - Backend validation with Zod + FK checks

**Related Patterns:**
- `docs/PHASE0_WATCHLIST_PATTERNS.md` - Foundation patterns (validation layer, etc.)
- `docs/DATABASE_PATTERNS.md` - FK constraints, NULL handling
- `docs/VALIDATION_PATTERNS.md` - Zod schema patterns
- `docs/ERROR_HANDLING_PATTERNS.md` - Error responses

---

## Summary

Phase 1.1 established patterns for:
1. ✅ Complete dialog component design (10 key elements)
2. ✅ Conditional UI rendering (React best practices)
3. ✅ Backend validation for decimal fields (Zod + type conversion)
4. ✅ React Query mutations (comprehensive error handling)
5. ✅ Component integration (local state, separation of concerns)
6. ✅ Foreign key validation (prevents 500 errors)

**All patterns follow Phase 0 foundations** and add React-specific best practices for modern UI development.

**Next Phase:** Apply these patterns to remaining Phase 1 tasks (cursor pagination, target price editing, category filtering).

---

---

## Pattern 7: Cursor-Based Pagination

**When:** Implementing infinite scroll for large datasets (Phase 1.2)

### Anti-Pattern
```typescript
// ❌ WRONG - Hard limit, no pagination
async getWatchedProducts(userId: number): Promise<WatchedProduct[]> {
  return db.select()
    .from(productWatches)
    .where(eq(productWatches.userId, userId))
    .limit(100); // Hard limit - can't load more
}
```

### Correct Pattern - Backend

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

### Correct Pattern - API Route

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

### Correct Pattern - Frontend Hook

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

### Correct Pattern - UI Component

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

---

## Pattern 8: Deterministic Sorting for Pagination

**When:** Sorting data for cursor-based pagination

### Anti-Pattern
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

### Correct Pattern
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

## Pattern 9: ESLint Compliance for Async Handlers

**When:** Using async functions in React event handlers or React Query callbacks

### Anti-Pattern
```typescript
// ❌ WRONG - Floating promise ESLint error
const createMutation = useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] }); // ← Returns promise
  }
});

<Button onClick={handleCreateWatchList}> // ← Async function not awaited
```

### Correct Pattern
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

## Testing Patterns for Pagination

**Required Test Coverage:**

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

## Common Pagination Mistakes

### ❌ Mistake 1: No Secondary Sort Key
```typescript
results.sort((a, b) => b.price - a.price); // Indeterminate for equal prices
```
**Fix:** Always add secondary sort on ID

### ❌ Mistake 2: Forgetting Limit + 1
```typescript
.limit(limit); // Can't detect hasMore
```
**Fix:** Fetch `limit + 1` and slice

### ❌ Mistake 3: Wrong getNextPageParam
```typescript
getNextPageParam: (lastPage) => lastPage.nextCursor, // Returns null instead of undefined
```
**Fix:** Return `undefined` when no more pages

### ❌ Mistake 4: Missing ID in Result
```typescript
// Storage doesn't return id field
{ productId, name, price } // ← Missing id for cursor!
```
**Fix:** Include `id: productWatches.id` in select

### ❌ Mistake 5: Type Mismatch
```typescript
interface WatchedProduct {
  productId: number;
  // ❌ Missing id field!
}
```
**Fix:** Add `id: number` to match API response

---

## Summary

Phase 1.2 established patterns for:
1. ✅ Cursor-based pagination (backend + frontend)
2. ✅ useInfiniteQuery with React Query
3. ✅ react-intersection-observer for infinite scroll
4. ✅ Deterministic sorting with secondary keys
5. ✅ ESLint compliance for async handlers
6. ✅ Comprehensive pagination test coverage

**All patterns follow Phase 0/1.1 foundations** and add infinite scroll UX for large datasets.

**Next Phase:** Target price editing, category filtering, multi-select operations.

---

## Pattern 10: Inline Editing with Conditional UI

**When:** Implementing inline editing of field values without navigation (Phase 1.3)

### Anti-Pattern
```typescript
// ❌ WRONG - Always shows edit button, no state management
<div>
  <span>${targetPrice}</span>
  <Button onClick={() => navigate(`/edit/${id}`)}>Edit</Button>
</div>
```

### Correct Pattern

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

---

## Pattern 11: Backend Data Augmentation for Frontend Features

**When:** Frontend needs additional data that's not in the primary query (Phase 1.3)

### Problem

List queries (e.g., watched products) return minimal data for performance. But frontend features (like inline editing) need additional context (alert ID, target price) without making N+1 queries.

### Anti-Pattern
```typescript
// ❌ WRONG - Frontend makes additional query for each item
function ItemCard({ item }: ItemCardProps) {
  // N+1 query! If 50 items, this makes 50 additional requests
  const { data: details } = useQuery({
    queryKey: [`/api/items/${item.id}/details`],
    queryFn: () => apiRequest(`/api/items/${item.id}/details`),
  });

  return <div>{details?.editableField}</div>;
}
```

### Correct Pattern

**Include Related Data in Main Query (Backend)**
```typescript
// ✅ CORRECT - Augment list query with related data
const results = await db.select({
  // Primary fields
  id: items.id,
  name: items.name,
  // Related data via subqueries (no N+1)
  relatedId: sql<number | null>`
    (SELECT id FROM ${related} WHERE ${related.itemId} = ${items.id} LIMIT 1)
  `.as('related_id'),
  relatedValue: sql<string | null>`
    (SELECT value FROM ${related} WHERE ${related.itemId} = ${items.id} LIMIT 1)
  `.as('related_value'),
});
```

**Benefits:**
- ✅ No N+1 queries (single database round-trip)
- ✅ Frontend receives all needed data in one request
- ✅ Supports inline editing without additional queries
- ✅ Better UX (no loading spinners for each field)

**Trade-offs:**
- Query complexity increases
- Response size increases (but typically marginal)
- Consider pagination if dataset is large

---

## Pattern 12: Decimal Field Handling (Critical)

**When:** Working with PostgreSQL numeric/decimal fields and JavaScript numbers (Phase 1.3)

### Problem

PostgreSQL stores decimals as strings in Drizzle ORM. Frontend expects numbers. Without proper conversion, type mismatches occur.

### Anti-Pattern
```typescript
// ❌ WRONG - No type conversion
const targetPrice: number = dbResult.targetPrice; // Type error!
```

### Correct Pattern

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

---

## Testing Patterns for Inline Editing

**Required Test Coverage:**

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

---

## Common Inline Editing Mistakes

### ❌ Mistake 1: No Conditional Rendering
```typescript
// Always shows edit button, even when field is null
<Button onClick={handleEdit}>Edit</Button>
```
**Fix:** Only render when field exists

### ❌ Mistake 2: No State Reset on Cancel
```typescript
const handleCancel = () => setIsEditing(false); // editedValue not reset!
```
**Fix:** Reset edited value to original on cancel

### ❌ Mistake 3: No Client Validation
```typescript
// Sends invalid data to server
updateMutation.mutate(editedValue);
```
**Fix:** Validate before mutation

### ❌ Mistake 4: No Loading State
```typescript
<Button onClick={handleSave}>Save</Button>
```
**Fix:** Disable during mutation, show "Saving..."

### ❌ Mistake 5: Missing Query Invalidation
```typescript
onSuccess: () => setIsEditing(false)
```
**Fix:** Invalidate all affected queries

---

## Summary

Phase 1.3 established patterns for:
1. ✅ Inline editing without navigation (conditional UI)
2. ✅ Backend data augmentation (subqueries for related data)
3. ✅ Decimal field handling (critical for type safety)
4. ✅ Client-side validation before mutation
5. ✅ State management for editing mode
6. ✅ Comprehensive testing patterns

**All patterns follow Phase 0/1.1/1.2 foundations** and add inline editing UX for direct field updates.

**Next Phase:** Multi-select operations, category filtering, advanced watchlist features.

---

**Last Updated:** 2025-11-29 | **Phase:** 1.3 Complete
