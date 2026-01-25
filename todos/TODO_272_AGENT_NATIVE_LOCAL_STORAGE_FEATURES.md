# TODO 272: Add Agent-Native APIs for localStorage-Only Features

**Priority**: P2 (IMPORTANT)
**Estimated Time**: 4 hours (revised down from 6 - reusing existing Wishlist API)
**Status**: Not Started
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)
**Reviewed**: 2026-01-25 (TypeScript, Performance, Simplicity reviewers)

## Problem Statement

Multiple features store data ONLY in localStorage, making them **inaccessible to AI agents in production**:

1. ~~**Wishlist**~~ → **RESOLVED**: Existing `/api/wishlists` API already provides this
2. **Compare List** - Product comparison (max 4 items) - **NEEDS API**
3. **Recently Viewed** - Product view history - **NEEDS API**

### Why This Matters

In production, AI agents interact with PriceCompare via HTTP APIs only. They have **zero access** to:
- User browsers
- localStorage
- Any client-side state

If a feature doesn't have an API endpoint, agents cannot use it.

## Multi-Agent Review Findings (2026-01-25)

### Key Discovery: Wishlist API Already Exists

**Location**: `server/routes/wishlist-routes.ts` (241 lines)

The localStorage "wishlist" in `shop-context.tsx` duplicates functionality that already exists:
- `GET /api/wishlists` - List user's wishlists
- `POST /api/wishlists` - Create wishlist
- `POST /api/wishlists/:id/items` - Add product to wishlist
- `DELETE /api/wishlists/:id/items/:productId` - Remove product

**Action**: Migrate client to use existing API, don't build duplicate.

### Architecture Decision: Server-Only for Authenticated Users

**Rationale** (from simplicity review): Two-way sync between localStorage and server is complex and error-prone. Instead:

- **Unauthenticated**: localStorage only (current behavior)
- **Authenticated**: Server API only (localStorage disabled)
- **On login**: One-time migration of localStorage → server, then clear localStorage

This eliminates conflict resolution, race conditions, and sync debugging.

## Revised Implementation Plan

### Phase 1: Database Schema

**File**: `migrations/XXXX_add_user_compare_and_views.sql`

```sql
-- Compare list (normalized table for type safety)
CREATE TABLE user_compare_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_user_compare_items_user_id ON user_compare_items(user_id);

-- Recently viewed (normalized table for analytics potential)
CREATE TABLE user_product_views (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)  -- Latest view only (upsert pattern)
);

CREATE INDEX idx_user_product_views_user_id ON user_product_views(user_id);
CREATE INDEX idx_user_product_views_user_time ON user_product_views(user_id, viewed_at DESC);
```

**Why normalized tables over JSONB** (from TypeScript review):
- Drizzle infers JSONB as `unknown` - requires unsafe casts
- Normalized tables get full type inference
- Easier to query, index, and maintain
- Follows existing codebase patterns

### Phase 2: API Endpoints

**File**: `server/routes/user-state-routes.ts` (NEW - ~150 LOC)

#### Compare List (4 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/compare` | Get compare list with hydrated products |
| POST | `/api/user/compare/:productId` | Add to compare (max 4 enforced) |
| DELETE | `/api/user/compare/:productId` | Remove from compare |
| DELETE | `/api/user/compare` | Clear compare list |

#### Recently Viewed (3 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/recently-viewed` | Get recent products (limit 50) |
| POST | `/api/user/recently-viewed/:productId` | Record view (upsert) |
| DELETE | `/api/user/recently-viewed` | Clear history |

### Phase 3: Storage Layer

**File**: `server/storage.ts` additions

```typescript
// Compare list methods
getUserCompareItems(userId: number): Promise<UserCompareItem[]>
addToCompare(userId: number, productId: number): Promise<void>
removeFromCompare(userId: number, productId: number): Promise<void>
clearCompare(userId: number): Promise<void>
getCompareCount(userId: number): Promise<number>

// Recently viewed methods
getUserRecentlyViewed(userId: number, limit?: number): Promise<UserProductView[]>
recordProductView(userId: number, productId: number): Promise<void>
clearRecentlyViewed(userId: number): Promise<void>
```

### Phase 4: Client Migration

**Files to modify**:
- `client/src/context/shop-context.tsx` - Remove localStorage wishlist, use existing hook
- `client/src/hooks/use-compare.ts` (NEW) - API-backed compare hook
- `client/src/hooks/use-recently-viewed.ts` (NEW) - API-backed recently viewed hook
- `client/src/components/template/recently-viewed.tsx` - Use new hook

**Migration strategy**:
```typescript
// On user login, migrate localStorage to server
async function migrateLocalStorageToServer() {
  const localCompare = JSON.parse(localStorage.getItem('compare') || '[]');
  const localViewed = JSON.parse(localStorage.getItem('recently_viewed') || '[]');

  if (localCompare.length > 0) {
    await api.put('/api/user/compare', { productIds: localCompare.slice(0, 4) });
    localStorage.removeItem('compare');
  }

  if (localViewed.length > 0) {
    for (const item of localViewed.slice(0, 50)) {
      await api.post(`/api/user/recently-viewed/${item.productId}`);
    }
    localStorage.removeItem('recently_viewed');
  }
}
```

### Phase 5: Zod Validation Schemas

**File**: `shared/schema.ts` additions

```typescript
// Compare list validation (max 4 items enforced)
export const compareListSchema = z.object({
  productIds: z.array(z.number().int().positive()).max(4, 'Maximum 4 products'),
});

// Recently viewed request
export const recordViewSchema = z.object({
  productId: z.number().int().positive(),
});

export type CompareList = z.infer<typeof compareListSchema>;
```

## Performance Requirements (from Performance Review)

### Size Limits (MANDATORY)
- Compare: **4 items max** (enforced at API level)
- Recently Viewed: **50 items max** (FIFO eviction on insert)

### Batch Loading (Prevent N+1)
```typescript
// CORRECT - batch fetch products
const products = await db.select()
  .from(products)
  .where(inArray(products.id, productIds));

// WRONG - N+1 queries
for (const id of productIds) {
  await storage.getProductById(id);  // ❌ N queries
}
```

### Caching
- Add to `storage-cache.ts` with WARM tier (10 min TTL)
- Invalidate on any modification

### Rate Limiting
- Compare operations: 20 requests/minute
- Recently viewed: 10 requests/minute (client should debounce)

### Client Debouncing
```typescript
// Debounce recently viewed updates (2 seconds)
const debouncedRecordView = useMemo(
  () => debounce((productId: number) => {
    api.post(`/api/user/recently-viewed/${productId}`);
  }, 2000),
  []
);
```

## Implementation Checklist

### Database
- [ ] Create migration for `user_compare_items` table
- [ ] Create migration for `user_product_views` table
- [ ] Update E2E test cleanup (`e2e/helpers.ts` TRUNCATE statement)
- [ ] Run `npm run validate:schema` before commit

### Backend
- [ ] Add storage methods to `server/storage.ts`
- [ ] Create `server/routes/user-state-routes.ts`
- [ ] Add routes to `server/routes/index.ts`
- [ ] Add CSRF protection to all mutating endpoints
- [ ] Add rate limiting
- [ ] Add caching to `storage-cache.ts`

### Shared
- [ ] Add Zod schemas to `shared/schema.ts`
- [ ] Add TypeScript types for new tables

### Frontend
- [ ] Create `use-compare.ts` hook
- [ ] Create `use-recently-viewed.ts` hook
- [ ] Update `shop-context.tsx` to remove localStorage wishlist
- [ ] Update `recently-viewed.tsx` to use new hook
- [ ] Add login migration logic
- [ ] Add client-side debouncing for recently viewed

### Testing
- [ ] Unit tests for storage methods
- [ ] Integration tests for API endpoints
- [ ] E2E tests for compare and recently viewed flows

## Success Criteria

- [ ] Agent can read/write compare list via API
- [ ] Agent can read/write recently viewed via API
- [ ] Compare enforces max 4 items
- [ ] Recently viewed caps at 50 items with FIFO eviction
- [ ] Authenticated users use server (no localStorage)
- [ ] Unauthenticated users use localStorage (unchanged)
- [ ] Login migrates localStorage to server
- [ ] No N+1 queries in product hydration
- [ ] Rate limiting prevents abuse

## Out of Scope (Deferred)

- ❌ New Wishlist API - Use existing `/api/wishlists`
- ❌ Two-way sync - Server-only for authenticated users
- ❌ Cross-user analytics on compare/views - Add later if needed
- ❌ GIN indexes - Not needed for user-scoped queries

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: agent-native-reviewer
**Reviewed**: 2026-01-25
**Reviewers**: kieran-typescript-reviewer, performance-oracle, code-simplicity-reviewer
