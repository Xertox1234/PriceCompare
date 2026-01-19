# TODO 247: Implement Product Listing Pagination

**Priority**: P1
**File(s)**: `client/src/pages/products-new.tsx`, `client/src/hooks/use-products.ts`
**Estimated Time**: 1-2 hours (simplified scope)
**Status**: Not Started

## Problem Statement

The product listing page currently fetches ALL products from the API in a single request and displays them without pagination. This causes:

1. **Performance issues**: Large product catalogs will load slowly and consume excessive memory
2. **Poor UX**: Users see potentially hundreds of products at once with no way to navigate through pages
3. **API inefficiency**: The backend supports pagination (`page`, `limit` params with `totalPages` metadata) but the frontend ignores it
4. **Misleading UI**: A hardcoded pagination mockup was removed because it showed fake page numbers (1, 2, 3, ..., 10) regardless of actual results

### Expected Memory Improvement

| Catalog Size | Current Memory | With Pagination (20 items) | Reduction |
|-------------|----------------|---------------------------|-----------|
| 100 products | 200-500KB | 40-100KB | **80%** |
| 500 products | 1-2.5MB | 40-100KB | **96%** |
| 1000 products | 2-5MB | 40-100KB | **98%** |

## Root Cause

The pagination feature was never properly implemented:
- Frontend hook (`use-products.ts`) doesn't pass `page`/`limit` parameters to API
- No state management for current page
- API response pagination metadata (`totalPages`, `total`) is discarded
- Hardcoded placeholder UI was added but never wired to real data

---

## Multi-Agent Review Summary (2026-01-19)

This plan was reviewed in parallel by three specialized agents:
- **Kieran TypeScript Reviewer** - Type safety and patterns
- **Performance Oracle** - Scalability and caching
- **Code Simplicity Reviewer** - YAGNI and minimalism

### Critical Issues Identified

#### 1. Type Duplication - Use Existing Types
**DO NOT** create new `PaginatedResponse<T>` interface. Use existing types:
- `ApiPaginatedResponse<T>` at `shared/api-types.ts:61-65`
- `PaginationMeta` at `shared/api-types.ts:27-35`

#### 2. Use `apiRequestRaw` to Preserve Pagination Metadata
The current `apiRequest` unwraps the envelope and loses the `meta`. Must use `apiRequestRaw` from `client/src/lib/queryClient.ts`.

#### 3. Atomic Page Reset with Filter Changes
Risk of race condition if filter change and page reset fire separately. Reset page atomically with filter changes.

#### 4. Query Key Design
**Bad**: `queryKey: [endpoint, pagination.page, pagination.limit]`
**Good**: `queryKey: ['products', 'search', stableFilters, page, limit]`

Structured keys enable proper cache invalidation and prevent fragmentation.

#### 5. Stable Filter Serialization
Use `useMemo` for filter objects in query keys to prevent unnecessary refetches.

### YAGNI Simplifications Applied

| Original Feature | Verdict | Action |
|-----------------|---------|--------|
| Ellipsis logic for page numbers | YAGNI | Removed from MVP |
| First/Last buttons | YAGNI | Moved to Nice-to-Have |
| URL state sync (`?page=2`) | YAGNI | Moved to Nice-to-Have |
| Infinite scroll mention | Scope creep | Removed entirely |
| Separate `pagination.tsx` file | Premature abstraction | Inline in page file |
| "Showing 21-40 of 156" display | Nice-to-have | Moved to Nice-to-Have |
| Comprehensive ARIA | Over-scoped | Use semantic HTML buttons |

---

## Solution Approach (Simplified)

1. Update `useProducts` hook to accept pagination params and use `apiRequestRaw`
2. Add `currentPage` state with atomic reset on filter changes
3. Inline simple prev/next pagination UI (no separate component)
4. Only show pagination when `totalPages > 1`
5. Scroll to top on page change

## Implementation Steps

### Step 1: Update useProducts Hook (~5 lines)

- [ ] Import `ApiPaginatedResponse` from `@shared/api-types`
- [ ] Add `page` and `limit` parameters to hook (with defaults: `page = 1`, `limit = 20`)
- [ ] Use `apiRequestRaw` instead of `apiRequest` to preserve pagination metadata
- [ ] Update query key to structured format: `['products', 'search', stableFilters, page, limit]`
- [ ] Use `useMemo` for stable filter serialization

### Step 2: Add Pagination State to Products Page (~4 lines)

- [ ] Add `currentPage` state: `const [currentPage, setCurrentPage] = useState(1);`
- [ ] Pass `currentPage` and `limit` to `useProducts` hook
- [ ] Add `useEffect` to reset page to 1 when filters change (atomic reset)
- [ ] Scroll to top on page change: `window.scrollTo(0, 0)`

### Step 3: Add Inline Pagination UI (~15 lines)

- [ ] Render pagination only when `totalPages > 1`
- [ ] Simple prev/next buttons with disabled states at boundaries
- [ ] Display "Page X of Y" text between buttons
- [ ] Use semantic HTML buttons (basic accessibility built-in)

## Technical Details

### API Pagination Support (Already Exists)

```typescript
// server/routes/product-routes.ts:94-112
const pagination = {
  page: req.query.page ? parseIntSafe(req.query.page, 'page', { min: 1 }) : 1,
  limit: req.query.limit
    ? parseIntSafe(req.query.limit, 'limit', { min: 1, max: 100 })
    : 20,
};

// Response format:
sendPaginated(res, products, {
  page: pagination.page,
  limit: pagination.limit,
  total: pagination.total,
  totalPages: pagination.totalPages,
});
```

### Updated Hook Pattern (Use Existing Types)

```typescript
// client/src/hooks/use-products.ts
import { ApiPaginatedResponse } from '@shared/api-types';
import { apiRequestRaw } from '@/lib/queryClient';

export function useProducts(
  filters: SearchFilters,
  page = 1,
  limit = 20
) {
  // Stable filter serialization to prevent unnecessary refetches
  const stableFilters = useMemo(() => ({
    query: filters.query || undefined,
    category: filters.category || undefined,
    // ... only include defined values
  }), [filters.query, filters.category, /* deps */]);

  // Build query params
  const queryParams = new URLSearchParams();
  // ... add filters
  queryParams.append('page', page.toString());
  queryParams.append('limit', limit.toString());

  const endpoint = `/api/products/search?${queryParams}`;

  return useQuery<ApiPaginatedResponse<ProductWithOffers>>({
    // Structured query key for proper cache management
    queryKey: ['products', 'search', stableFilters, page, limit],
    queryFn: () => apiRequestRaw<ApiPaginatedResponse<ProductWithOffers>>(endpoint),
    staleTime: 2 * 60 * 1000,  // 2 minutes for paginated data
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
}
```

### Inline Pagination UI (Minimal)

```tsx
// In products-new.tsx - inline, no separate component needed
{meta.totalPages > 1 && (
  <div className="flex items-center justify-center gap-4 mt-8">
    <Button
      variant="outline"
      onClick={() => {
        setCurrentPage(p => Math.max(1, p - 1));
        window.scrollTo(0, 0);
      }}
      disabled={currentPage === 1}
    >
      Previous
    </Button>
    <span className="text-sm text-muted-foreground">
      Page {currentPage} of {meta.totalPages}
    </span>
    <Button
      variant="outline"
      onClick={() => {
        setCurrentPage(p => Math.min(meta.totalPages, p + 1));
        window.scrollTo(0, 0);
      }}
      disabled={currentPage === meta.totalPages}
    >
      Next
    </Button>
  </div>
)}
```

### Filter Reset Pattern (Atomic)

```typescript
// Reset page when filters change - prevent race conditions
useEffect(() => {
  setCurrentPage(1);
}, [
  filters.query,
  filters.category,
  filters.minPrice,
  filters.maxPrice,
  // Include ALL filter dependencies
]);
```

## Checklist

- [ ] Implementation complete
- [ ] Tests written/updated
  - [ ] E2E test for pagination navigation (sufficient for MVP)
- [ ] Related files checked

## Success Criteria (MVP)

- [ ] Products load in paginated batches (default 20 per page)
- [ ] Pagination controls only appear when `totalPages > 1`
- [ ] Prev/Next navigation works correctly with disabled states at boundaries
- [ ] Filters reset pagination to page 1
- [ ] Page scrolls to top on page change
- [ ] No performance regression

---

## Nice-to-Have Features (Add Later If Needed)

These features were identified during review as valuable but not essential for MVP. Implement based on user feedback.

### 1. Page Number Buttons with Ellipsis
Show clickable page numbers (e.g., `[1] ... [4] [5] [6] ... [10]`) for direct page access.

**When to add**: If users frequently need to jump to specific pages rather than sequential navigation.

```tsx
// Future: Extract to client/src/components/ui/pagination.tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number; // Pages to show around current
}
```

### 2. First/Last Page Buttons
Add "First" and "Last" buttons for quick navigation to boundaries.

**When to add**: If catalog grows large (50+ pages) and users need to jump to extremes.

### 3. URL State Sync for Shareable Links
Sync pagination state with URL (`?page=2`) so links can be shared/bookmarked.

**When to add**: If users report wanting to share specific result pages.

```typescript
// Future implementation
const urlParams = new URLSearchParams(searchParams);
const currentPage = parseInt(urlParams.get('page') ?? '1', 10);

const handlePageChange = (page: number) => {
  urlParams.set('page', page.toString());
  navigate(`?${urlParams.toString()}`);
};
```

### 4. Prefetch Adjacent Pages on Hover
Prefetch next/previous page data when user hovers over pagination buttons for instant navigation.

**When to add**: If page transitions feel slow or users browse many pages sequentially.

```typescript
// Future: Add to useProducts hook
const prefetchNextPage = useCallback(() => {
  if (page < totalPages) {
    void queryClient.prefetchQuery({
      queryKey: ['products', 'search', stableFilters, page + 1, limit],
      queryFn: () => apiRequestRaw<ApiPaginatedResponse<ProductWithOffers>>(nextEndpoint),
      staleTime: 60 * 1000,
    });
  }
}, [page, totalPages, stableFilters, limit, queryClient]);

// Usage: <Button onMouseEnter={prefetchNextPage}>Next</Button>
```

### 5. "Showing X-Y of Z Products" Display
Show item range context (e.g., "Showing 21-40 of 156 products").

**When to add**: If users want more context about their position in results.

```tsx
// Future implementation
const startItem = (currentPage - 1) * limit + 1;
const endItem = Math.min(currentPage * limit, meta.total);

<span>Showing {startItem}-{endItem} of {meta.total} products</span>
```

---

## Related Files

- `server/routes/product-routes.ts` - API pagination (already implemented)
- `server/utils/api-response.ts` - `sendPaginated()` helper
- `client/src/lib/queryClient.ts` - `apiRequestRaw` for preserving envelope
- `shared/api-types.ts` - `ApiPaginatedResponse`, `PaginationMeta` types
- `docs/03_API_PATTERNS.md` - Pagination patterns

## Notes

- The API already supports pagination - this is purely frontend work
- Backend enforces 100-item max per page (`server/storage/domains/product-storage.ts:388`)
- Default limit of 20 matches API default
- Use `placeholderData` in React Query to prevent layout shift during page transitions

---

**Created**: 2026-01-19
**Created by**: Claude Code
**Reviewed**: 2026-01-19 (Kieran TypeScript, Performance Oracle, Code Simplicity)
