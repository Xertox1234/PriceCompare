# TODO 269: Add Agent-Native Shopping Cart API

**Priority**: P1 (CRITICAL - Agent-Native Violation)
**File(s)**: `server/routes/user-state-routes.ts` (new), `client/src/context/shop-context.tsx`
**Estimated Time**: 4 hours
**Status**: Not Started
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

The shopping cart is stored ONLY in localStorage (`client/src/context/shop-context.tsx`). An AI agent cannot:
- Read the user's current cart contents
- Add items to the user's cart programmatically
- Sync cart across devices for the user

This violates the agent-native principle: "Any action a user can take, an agent can also take."

## Root Cause

Cart was implemented as a client-only feature without server persistence. The `ShopProvider` uses `localStorage.getItem(STORAGE_KEY)` exclusively.

## Evidence

```typescript
// client/src/context/shop-context.tsx Lines 234-266
const STORAGE_KEY = 'pricecompare-shop-state';

// Load from localStorage only
useEffect(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  // ...
}, []);

// Save to localStorage only
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}, [state]);
```

## Solution Approach

1. Create server-side cart storage with API endpoints
2. Modify `ShopProvider` to sync with server when authenticated
3. Keep localStorage as fallback for unauthenticated users

## Implementation Steps

### Step 1: Database Schema

- [ ] Create `user_carts` table with cart items as JSONB
- [ ] Or use normalized `cart_items` table (productId, quantity, addedAt)

### Step 2: API Endpoints

- [ ] Create `server/routes/user-state-routes.ts`
- [ ] `GET /api/user/cart` - Get authenticated user's cart
- [ ] `PUT /api/user/cart` - Replace cart contents
- [ ] `PATCH /api/user/cart` - Update cart item (add/remove/quantity)
- [ ] `DELETE /api/user/cart` - Clear cart

### Step 3: Client Integration

- [ ] Update `ShopProvider` to fetch cart on auth
- [ ] Sync cart changes to server when authenticated
- [ ] Merge localStorage cart with server cart on login

## Technical Details

**Migration:**
```sql
CREATE TABLE user_carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_carts_user_id ON user_carts(user_id);
```

**API Schema:**
```typescript
// Cart item structure
interface CartItem {
  productId: number;
  quantity: number;
  addedAt: string; // ISO timestamp
}

// GET /api/user/cart response
{ items: CartItem[], updatedAt: string }

// PATCH /api/user/cart request
{ productId: number, quantity: number } // 0 to remove
```

## Checklist

- [ ] Migration created
- [ ] API endpoints implemented with CSRF protection
- [ ] Storage layer methods added
- [ ] Client sync logic implemented
- [ ] Cart merge on login tested
- [ ] E2E tests for cart API

## Success Criteria

- [ ] Agent can read cart via `GET /api/user/cart`
- [ ] Agent can add items via `PATCH /api/user/cart`
- [ ] Cart persists across devices for logged-in users
- [ ] Unauthenticated users still have localStorage cart
- [ ] Cart merged correctly on login

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: agent-native-reviewer
