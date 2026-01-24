# TODO 272: Add Agent-Native APIs for localStorage-Only Features

**Priority**: P2 (IMPORTANT)
**File(s)**: `server/routes/user-state-routes.ts` (new), `client/src/context/shop-context.tsx`, `client/src/components/template/recently-viewed.tsx`
**Estimated Time**: 6 hours
**Status**: Not Started
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

Multiple features store data ONLY in localStorage, making them inaccessible to AI agents:
1. **Wishlist** (separate from Watchlist) - Quick favorites
2. **Compare List** - Product comparison (max 4 items)
3. **Recently Viewed** - Product view history

## Root Cause

These were implemented as client-only features without server persistence.

## Evidence

**Wishlist (shop-context.tsx:174-183):**
```typescript
case 'TOGGLE_WISHLIST': {
  const productId = action.payload;
  return {
    ...state,
    wishlist: isInWishlist
      ? state.wishlist.filter((id) => id !== productId)
      : [...state.wishlist, productId],
  };
}
```

**Compare List (shop-context.tsx:185-205):**
```typescript
case 'TOGGLE_COMPARE': {
  const productId = action.payload;
  if (state.compare.length >= 4) return state;
  return { ...state, compare: [...state.compare, productId] };
}
```

**Recently Viewed (recently-viewed.tsx:24-51):**
```typescript
const STORAGE_KEY = 'pricecompare_recently_viewed';
export function getRecentlyViewed(): RecentlyViewedItem[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  // ...
}
```

## Solution Approach

Create server-side endpoints for each feature, sync with localStorage for authenticated users.

## Implementation Steps

### Step 1: Database Schema (Optional)

- [ ] Decide: Use separate tables OR single `user_state` JSONB column
- [ ] Create migration if using separate tables

### Step 2: API Endpoints

**Wishlist:**
- [ ] `GET /api/user/wishlist` - Get user's wishlist
- [ ] `PUT /api/user/wishlist` - Replace wishlist
- [ ] `POST /api/user/wishlist/:productId` - Add to wishlist
- [ ] `DELETE /api/user/wishlist/:productId` - Remove from wishlist

**Compare:**
- [ ] `GET /api/user/compare` - Get comparison set
- [ ] `PUT /api/user/compare` - Set comparison products (max 4)

**Recently Viewed:**
- [ ] `GET /api/user/recently-viewed` - Get view history
- [ ] `POST /api/user/recently-viewed` - Record product view
- [ ] `DELETE /api/user/recently-viewed` - Clear history

### Step 3: Client Integration

- [ ] Update ShopProvider to sync with server
- [ ] Update recently-viewed to sync with server

## Technical Details

**Simplified approach - Single table:**
```sql
CREATE TABLE user_client_state (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wishlist INTEGER[] DEFAULT '{}',
  compare INTEGER[] DEFAULT '{}',
  recently_viewed JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

**Or merge with existing Watchlist:** Consider if Wishlist should be merged with Watchlist API to simplify UX (one concept instead of two).

## Checklist

- [ ] Decide architecture (separate tables vs JSONB)
- [ ] Migration created
- [ ] API endpoints implemented
- [ ] Client sync logic added
- [ ] E2E tests for new APIs

## Success Criteria

- [ ] Agent can read/write wishlist via API
- [ ] Agent can read/write compare list via API
- [ ] Agent can read/write recently viewed via API
- [ ] Data syncs across devices for logged-in users
- [ ] localStorage fallback works for unauthenticated

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: agent-native-reviewer
