# TODO 289: Convert Wishlist Array to Set for O(1) Lookups

**Priority**: P2
**File(s)**: `client/src/context/shop-context.tsx`
**Estimated Time**: 1 hour
**Status**: Not Started
**Tags**: `code-review`, `performance`, `optimization`

## Problem Statement

`isInWishlist` does an `Array.includes()` check (O(n)) for each product. This is called many times per render, especially in `home-new.tsx` where it's called for 7 different product lists.

Current complexity: **O(m * n)** where m = total products, n = wishlist size

| Scale | Products | Wishlist | Operations/Render |
|-------|----------|----------|-------------------|
| 1x    | 100      | 50       | 5,000             |
| 10x   | 1,000    | 500      | 500,000           |
| 100x  | 10,000   | 5,000    | 50,000,000        |

## Evidence

**File**: `client/src/context/shop-context.tsx:173-175`
```typescript
const isInWishlist = (productId: number) => {
  return state.wishlist.includes(productId);  // O(n) lookup
};
```

**File**: `client/src/pages/home-new.tsx:141-150`
```typescript
const addWatchlistStatus = (productList) =>
  productList.map((p) => ({ ...p, inWatchlist: isInWishlist(p.id) }));

// Called 7 times with different lists
const dealProducts = addWatchlistStatus(products.deals);
const bestSellers = addWatchlistStatus(products.bestSellers);
// ... 5 more
```

## Solution Approach

Convert wishlist storage to use Set internally, or memoize a Set version for O(1) lookups.

## Implementation Steps

### Step 1: Add Set-based Lookup in shop-context.tsx

- [ ] Add memoized Set derived from wishlist array:
  ```typescript
  const wishlistSet = useMemo(() => new Set(state.wishlist), [state.wishlist]);
  ```

- [ ] Update `isInWishlist` to use Set:
  ```typescript
  const isInWishlist = useCallback((productId: number) => {
    return wishlistSet.has(productId);  // O(1) lookup
  }, [wishlistSet]);
  ```

### Step 2: Expose Set in Context (Optional)

- [ ] Add `wishlistSet` to context value for direct access
- [ ] Update consumers that need bulk checks

### Step 3: Update home-new.tsx

- [ ] Use wishlistSet directly instead of calling isInWishlist per item:
  ```typescript
  const addWatchlistStatus = useMemo(() =>
    (productList) => productList.map((p) => ({
      ...p,
      inWatchlist: wishlistSet.has(p.id)
    })),
    [wishlistSet]
  );
  ```

## Technical Details

```typescript
// shop-context.tsx - Updated implementation

interface ShopContextType {
  // ... existing
  wishlistSet: Set<number>;  // Add for O(1) lookups
}

export function ShopProvider({ children }: { children: ReactNode }) {
  // ... existing state

  // Memoized Set for O(1) lookups
  const wishlistSet = useMemo(() => new Set(state.wishlist), [state.wishlist]);

  const isInWishlist = useCallback((productId: number) => {
    return wishlistSet.has(productId);
  }, [wishlistSet]);

  const value = useMemo(() => ({
    // ... existing
    wishlistSet,
    isInWishlist,
  }), [/* deps */]);
}
```

## Checklist

- [ ] Set-based lookup implemented
- [ ] `isInWishlist` uses O(1) lookup
- [ ] Home page performance improved
- [ ] Tests pass

## Success Criteria

- [ ] O(1) wishlist lookups instead of O(n)
- [ ] 10-100x speedup for wishlist checks at scale
- [ ] No regressions in wishlist functionality

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: performance-oracle
