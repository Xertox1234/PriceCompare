# TODO 284: Move ShopProvider to App.tsx Provider Hierarchy

**Priority**: P1
**File(s)**: `client/src/App.tsx`, `client/src/context/shop-context.tsx`
**Estimated Time**: 1 hour
**Status**: Not Started
**Tags**: `code-review`, `architecture`, `state-management`

## Problem Statement

`ShopProvider` is NOT included in the main provider hierarchy in `App.tsx`. Instead, individual pages wrap themselves with `ShopProvider`:
- `product-detail-new.tsx`
- `wishlist-new.tsx`
- `compare-new.tsx`
- `products-new.tsx`
- `home-new.tsx`

This means **state is NOT shared across pages**. If a user adds a product to comparison on `/shop`, then navigates to `/compare`, the state is LOST.

## Root Cause

`ShopProvider` was added to pages individually during feature development without considering global state needs.

## Evidence

**File**: `client/src/App.tsx:297-311` - Provider hierarchy does NOT include ShopProvider:
```typescript
function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider defaultTheme="light" storageKey="pricecompare-theme">
          <QueryClientProvider client={queryClient}>
            <CountryProvider>
              <AppContent />  {/* ShopProvider missing here! */}
            </CountryProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
```

## Solution Approach

Add `ShopProvider` to `App.tsx` provider hierarchy, then remove redundant `ShopProvider` wrappers from individual pages.

## Implementation Steps

### Step 1: Add ShopProvider to App.tsx

- [ ] Import `ShopProvider` from `@/context/shop-context`
- [ ] Add `ShopProvider` wrapper inside `CountryProvider`, around `AppContent`

### Step 2: Remove Page-Level ShopProvider Wrappers

- [ ] Remove from `product-detail-new.tsx`
- [ ] Remove from `wishlist-new.tsx`
- [ ] Remove from `compare-new.tsx`
- [ ] Remove from `products-new.tsx`
- [ ] Remove from `home-new.tsx`

### Step 3: Verify State Persistence

- [ ] Test: Add product to comparison on `/shop`
- [ ] Navigate to `/compare`
- [ ] Verify comparison list persists

## Technical Details

```typescript
// App.tsx - Updated provider hierarchy
function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider defaultTheme="light" storageKey="pricecompare-theme">
          <QueryClientProvider client={queryClient}>
            <CountryProvider>
              <ShopProvider>  {/* ADD HERE */}
                <AppContent />
              </ShopProvider>
            </CountryProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
```

## Checklist

- [ ] Implementation complete
- [ ] Tests pass
- [ ] State persists across page navigation
- [ ] No page-level ShopProvider wrappers remain

## Success Criteria

- [ ] ShopProvider in App.tsx hierarchy
- [ ] Comparison/wishlist state persists across navigation
- [ ] No regressions in shop functionality

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: architecture-strategist
