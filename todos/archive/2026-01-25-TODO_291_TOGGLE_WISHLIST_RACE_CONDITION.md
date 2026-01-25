# TODO 291: Fix Race Condition in Toggle Wishlist

**Priority**: P2
**File(s)**: `client/src/hooks/use-wishlist.ts`
**Estimated Time**: 2 hours
**Status**: Not Started
**Tags**: `code-review`, `data-integrity`, `race-condition`

## Problem Statement

`useToggleWishlist` has a race condition where:
1. `wishlists` data is read at mutation start but may be stale
2. If user rapidly toggles, `isCurrentlyInWishlist` state may not match server state
3. No mutex/lock prevents concurrent toggles causing duplicate additions or missed removals

## Evidence

**File**: `client/src/hooks/use-wishlist.ts:237-281`
```typescript
export function useToggleWishlist() {
  const { data: wishlists } = useWishlists();  // Potentially stale!

  return useMutation({
    mutationFn: async ({ productId, isCurrentlyInWishlist }) => {
      let defaultWishlist = wishlists?.wishlists?.find(...) ?? wishlists?.wishlists?.[0];

      if (!defaultWishlist) {
        // Creates new wishlist - but what if another toggle is creating one?
        const result = await createMutation.mutateAsync({ name: 'My Wishlist' });
        defaultWishlist = result;
      }

      if (isCurrentlyInWishlist) {
        // Uses stale wishlists data to find which list has the product
        const wishlistWithProduct = wishlists?.wishlists?.find(...);
        // ...
      }
    }
  });
}
```

## Solution Approach

1. Add debouncing to prevent rapid successive toggles
2. Use optimistic updates with proper rollback
3. Invalidate and refetch before toggle logic if needed

## Implementation Steps

### Step 1: Add Debouncing

- [ ] Create a debounced toggle wrapper
- [ ] Prevent multiple toggles within 500ms

### Step 2: Use Fresh Data

- [ ] Fetch fresh wishlist data at toggle time, not from cache
- [ ] Or use `queryClient.getQueryData` with immediate invalidation

### Step 3: Implement Mutex Pattern

- [ ] Track in-flight toggle operations per product
- [ ] Prevent duplicate operations for same product

## Technical Details

```typescript
// Add debouncing and mutex
export function useToggleWishlist() {
  const pendingToggles = useRef(new Set<number>());

  return useMutation({
    mutationFn: async ({ productId, isCurrentlyInWishlist }) => {
      // Prevent duplicate in-flight operations
      if (pendingToggles.current.has(productId)) {
        throw new Error('Toggle already in progress');
      }
      pendingToggles.current.add(productId);

      try {
        // Fetch fresh data instead of using potentially stale cache
        const freshWishlists = await queryClient.fetchQuery({
          queryKey: ['/api/wishlists'],
          staleTime: 0,  // Force fresh fetch
        });

        // ... toggle logic with fresh data
      } finally {
        pendingToggles.current.delete(productId);
      }
    },
  });
}

// Debounced wrapper hook
export function useDebouncedToggleWishlist() {
  const toggle = useToggleWishlist();
  const debouncedToggle = useDebouncedCallback(
    (args) => toggle.mutate(args),
    500
  );
  return { ...toggle, mutate: debouncedToggle };
}
```

## Checklist

- [ ] Debouncing implemented
- [ ] Mutex pattern prevents duplicate operations
- [ ] Fresh data used for toggle logic
- [ ] Tests for rapid toggle scenarios

## Success Criteria

- [ ] No duplicate additions from rapid toggles
- [ ] No missed removals from race conditions
- [ ] User feedback remains responsive

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: data-integrity-guardian
