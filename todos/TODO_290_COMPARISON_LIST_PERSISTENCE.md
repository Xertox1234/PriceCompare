# TODO 290: Persist Comparison List to Server

**Priority**: P2
**File(s)**: `client/src/hooks/use-comparison.ts`, `shared/schema.ts`
**Estimated Time**: 4 hours
**Status**: Not Started
**Tags**: `code-review`, `data-integrity`, `agent-native`

## Problem Statement

The product comparison list uses **client-side state only** (`useState`). This causes:
1. Data is LOST on page refresh, tab close, or session expiration
2. No synchronization across browser tabs or devices
3. Agents cannot access or manipulate the comparison list via API

The database schema already has `user_compare_items` table (`shared/schema.ts:1554-1570`) but the frontend does not use it.

## Evidence

**File**: `client/src/hooks/use-comparison.ts:6-10`
```typescript
export function useComparison() {
  const [comparisonItems, setComparisonItems] = useState<ProductWithOffers[]>([]);
  // Client-side only - lost on refresh!
}
```

**Database table exists** (`shared/schema.ts:1554-1570`):
```typescript
export const userCompareItems = pgTable('user_compare_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at').defaultNow(),
});
```

## Solution Approach

Create API endpoints for comparison list and update hook to use them, with localStorage fallback for unauthenticated users.

## Implementation Steps

### Step 1: Create API Routes (Backend)

- [ ] Create `server/routes/compare-routes.ts`
- [ ] Implement GET `/api/compare-list` - Get user's comparison list
- [ ] Implement POST `/api/compare-list` - Add product to comparison
- [ ] Implement DELETE `/api/compare-list/:productId` - Remove from comparison
- [ ] Implement DELETE `/api/compare-list` - Clear comparison list

### Step 2: Update Frontend Hook

- [ ] Import React Query hooks
- [ ] Use `useQuery` to fetch comparison list
- [ ] Use `useMutation` for add/remove/clear
- [ ] Implement optimistic updates

### Step 3: Fallback for Unauthenticated Users

- [ ] Keep localStorage sync for non-logged-in users
- [ ] Migrate localStorage items to server on login

## Technical Details

```typescript
// New use-comparison.ts with server persistence
export function useComparison() {
  const { user } = useUser();

  const { data: serverItems = [] } = useQuery({
    queryKey: ['/api/compare-list'],
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (product: ProductWithOffers) =>
      apiRequest('/api/compare-list', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/compare-list'] });
    },
  });

  // ... similar for remove, clear
}
```

## Checklist

- [ ] API routes created
- [ ] Frontend hook updated
- [ ] localStorage fallback for guests
- [ ] Migration on login
- [ ] Tests written

## Success Criteria

- [ ] Comparison list persists across sessions for logged-in users
- [ ] API accessible for agents
- [ ] Guest users have localStorage fallback
- [ ] No data loss on page refresh

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: data-integrity-guardian, agent-native-reviewer
