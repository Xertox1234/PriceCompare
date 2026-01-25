# TODO 287: Fix Memoization Breaking Patterns in Frontend

**Priority**: P2
**File(s)**: `client/src/components/optimized/virtual-product-grid.tsx`, `client/src/pages/home-new.tsx`
**Estimated Time**: 2 hours
**Status**: Not Started
**Tags**: `code-review`, `performance`, `react`

## Problem Statement

Multiple components break React memoization through:
1. **Inline arrow functions** passed to memoized components
2. **Missing useCallback** for handler functions
3. **Unmemoized data transformations** that run on every render

This causes unnecessary re-renders, especially in product grids with many items.

## Affected Areas

### 1. virtual-product-grid.tsx - Inline Arrow Functions

**File**: `client/src/components/optimized/virtual-product-grid.tsx:28-32`
```typescript
<MemoizedProductCard
  key={product.id}
  product={product}
  onAddToComparison={() => onAddToComparison(product)}  // NEW FUNCTION EACH RENDER
/>
```

Despite using `MemoizedProductCard`, the inline function breaks memoization.

### 2. home-new.tsx - Missing useCallback

**File**: `client/src/pages/home-new.tsx:152-164`
```typescript
const handleWatchlist = (product: { id: number }) => {
  toggleWishlist(product.id);
};

const handleCompare = (product: { id: number }) => {
  toggleCompare(product.id);
  setCompareOpen(true);
};

const handleQuickView = (product: ProductData) => {
  setQuickviewProduct(product);
};
```

These handlers are recreated on every render and passed to 10+ child components.

### 3. home-new.tsx - Unmemoized Data Transformations

**File**: `client/src/pages/home-new.tsx:141-150`
```typescript
const addWatchlistStatus = (productList: typeof products.all) =>
  productList.map((p) => ({ ...p, inWatchlist: isInWishlist(p.id) }));

// Called 7 times on every render:
const dealProducts = addWatchlistStatus(products.deals);
const bestSellers = addWatchlistStatus(products.bestSellers);
// ... 5 more
```

## Solution Approach

1. Use `useCallback` for product ID-parameterized handlers
2. Wrap handlers with `useCallback`
3. Memoize data transformations with `useMemo`

## Implementation Steps

### Step 1: Fix virtual-product-grid.tsx

- [ ] Create a callback map or use useCallback with product ID
- [ ] Alternative: Pass product ID and let child call handler with ID

### Step 2: Fix home-new.tsx handlers

- [ ] Wrap `handleWatchlist` with `useCallback`
- [ ] Wrap `handleCompare` with `useCallback`
- [ ] Wrap `handleQuickView` with `useCallback`

### Step 3: Memoize data transformations

- [ ] Wrap `addWatchlistStatus` calls with `useMemo`
- [ ] Consider converting wishlist to Set for O(1) lookups

## Technical Details

```typescript
// BEFORE (virtual-product-grid.tsx)
<MemoizedProductCard
  onAddToComparison={() => onAddToComparison(product)}
/>

// AFTER - Option 1: Pass ID, let child handle
<MemoizedProductCard
  productId={product.id}
  onAddToComparison={onAddToComparison}  // Stable reference
/>

// AFTER - Option 2: Callback map (more complex)
const handlers = useMemo(() =>
  products.reduce((acc, p) => {
    acc[p.id] = () => onAddToComparison(p);
    return acc;
  }, {}),
[products, onAddToComparison]);
```

```typescript
// BEFORE (home-new.tsx)
const handleWatchlist = (product) => toggleWishlist(product.id);

// AFTER
const handleWatchlist = useCallback((product: { id: number }) => {
  toggleWishlist(product.id);
}, [toggleWishlist]);

// Memoize data transformations
const dealProducts = useMemo(
  () => addWatchlistStatus(products.deals),
  [products.deals, wishlistSet]
);
```

## Checklist

- [ ] All inline arrow functions removed from memoized components
- [ ] Handlers wrapped with useCallback
- [ ] Data transformations memoized
- [ ] React DevTools confirms reduced re-renders

## Success Criteria

- [ ] Prevent 20-100 unnecessary re-renders per interaction
- [ ] Reduce child component re-renders by ~70%
- [ ] React DevTools shows stable references

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: performance-oracle
