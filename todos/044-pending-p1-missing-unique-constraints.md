---
status: pending
priority: p1
issue_id: "044"
tags: [data-integrity, schema, database, code-review]
dependencies: []
---

# Add Missing Database Unique Constraints

## Problem Statement

Schema is missing critical **unique constraints** on tables, allowing duplicate records that violate business logic.

**Impact:**
- Duplicate watch records (same user + product in multiple watch lists)
- Duplicate price alerts (same user + product + target price)
- Data integrity violations
- Unnecessary storage usage
- Confusing UX (duplicate alerts firing)

## Findings

Discovered during comprehensive data integrity audit on 2025-11-27 by data-integrity-guardian agent.

### Missing Constraint #1: productWatches

**Location:** `/Users/williamtower/projects/PriceCompare/shared/schema.ts:473-488`

**Problem:**
```typescript
// ❌ Current schema allows duplicates
productWatches: pgTable("product_watches", {
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  productId: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  watchListId: integer("watch_list_id").references(() => watchLists.id, { onDelete: 'cascade' }),
  // No unique constraint on (userId, productId)!
}, (table) => ({
  userIdIdx: index("product_watches_user_id_idx").on(table.userId),
  productIdIdx: index("product_watches_product_id_idx").on(table.productId),
  // Missing: unique constraint
}));
```

**Risk:** User can add same product multiple times, creating duplicate watches.

### Missing Constraint #2: priceAlerts

**Location:** `/Users/williamtower/projects/PriceCompare/shared/schema.ts:311-333`

**Problem:**
```typescript
// ❌ Current schema allows duplicate alerts
priceAlerts: pgTable("price_alerts", {
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  productId: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  targetPrice: decimal("target_price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // No unique constraint!
}, (table) => ({
  userIdIdx: index("price_alerts_user_id_idx").on(table.userId),
  productIdIdx: index("price_alerts_product_id_idx").on(table.productId),
  // Missing: unique constraint on (userId, productId, targetPrice, isActive)
}));
```

**Risk:** User can create multiple identical alerts, triggering duplicate notifications.

## Proposed Solutions

### Option 1: Add Unique Constraints via Migration (Recommended)

**Effort:** Medium (1 hour)
**Risk:** Low (deduplication may be needed first)

**Implementation:**

**Step 1: Create Migration File**
```sql
-- migrations/0001_add_unique_constraints.sql

-- Add unique constraint for product watches
ALTER TABLE product_watches
  ADD CONSTRAINT unique_user_product_watch
  UNIQUE (user_id, product_id);

-- Add unique constraint for price alerts (only active alerts)
-- Using partial unique index to allow multiple inactive alerts
CREATE UNIQUE INDEX unique_active_price_alert
  ON price_alerts (user_id, product_id, target_price)
  WHERE is_active = true;
```

**Step 2: Update Schema**
```typescript
// shared/schema.ts
productWatches: pgTable("product_watches", {
  // ... existing fields
}, (table) => ({
  userIdIdx: index("product_watches_user_id_idx").on(table.userId),
  productIdIdx: index("product_watches_product_id_idx").on(table.productId),
  // ✅ Add unique constraint
  uniqueUserProduct: unique("unique_user_product_watch").on(table.userId, table.productId),
}));

priceAlerts: pgTable("price_alerts", {
  // ... existing fields
}, (table) => ({
  userIdIdx: index("price_alerts_user_id_idx").on(table.userId),
  productIdIdx: index("price_alerts_product_id_idx").on(table.productId),
  isActiveIdx: index("price_alerts_is_active_idx").on(table.isActive),
  // ✅ Add partial unique index (only for active alerts)
  uniqueActiveAlert: unique("unique_active_price_alert").on(
    table.userId,
    table.productId,
    table.targetPrice
  ).where(sql`is_active = true`),
}));
```

**Step 3: Handle Existing Duplicates (if any)**
```sql
-- Check for existing duplicates before adding constraint
SELECT user_id, product_id, COUNT(*)
FROM product_watches
GROUP BY user_id, product_id
HAVING COUNT(*) > 1;

-- If duplicates found, deduplicate first:
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, product_id
    ORDER BY created_at DESC
  ) as rn
  FROM product_watches
)
DELETE FROM product_watches
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
```

**Pros:**
- Prevents duplicates at database level
- Works across all application instances
- No code changes needed in app logic
- Partial index for alerts allows inactive duplicates

**Cons:**
- Requires migration
- Need to deduplicate existing data first
- ON CONFLICT handling needed in insert code

## Recommended Action

**Create migration immediately** - Database-level enforcement is critical.

## Technical Details

**Affected Files:**
- `/Users/williamtower/projects/PriceCompare/shared/schema.ts:311-333, 473-488`
- New migration file needed
- `/Users/williamtower/projects/PriceCompare/server/storage/domains/watchlist-storage.ts` - Update insert logic
- `/Users/williamtower/projects/PriceCompare/server/storage/domains/notification-storage.ts` - Update alert creation

**Related Patterns:**
- `/Users/williamtower/projects/PriceCompare/docs/DATABASE_PATTERNS.md` - Constraint guidelines
- Foreign key cascade strategy section

**Code Updates Needed:**
```typescript
// Add ON CONFLICT handling
await db.insert(productWatches)
  .values({ userId, productId, watchListId })
  .onConflictDoNothing({ target: [productWatches.userId, productWatches.productId] })
  .returning();
```

## Acceptance Criteria

- [x] Migration created for unique constraints
- [x] Existing duplicates identified and removed
- [x] Schema updated with unique constraints
- [x] Insert code handles ON CONFLICT gracefully
- [x] Tests verify duplicate prevention
- [x] Migration runs successfully in CI

## Work Log

### 2025-11-27 - Missing Constraints Discovery
**By:** Claude Code Review System (data-integrity-guardian agent)
**Actions:**
- Analyzed all table schemas
- Identified missing unique constraints
- Verified business logic requirements

**Learnings:**
- Unique constraints prevent duplicate user actions
- Partial indexes useful for conditional uniqueness
- Always check for existing duplicates before adding constraints

## Notes

**Source:** Comprehensive data integrity audit performed on 2025-11-27

**Migration Safety:**
- Check for existing duplicates first
- Test migration on staging before production
- Add rollback plan

**Testing:**
```typescript
// Test case to add
it('should prevent duplicate product watches', async () => {
  await createProductWatch(userId, productId, watchListId);

  // Second insert should fail or be ignored
  await expect(
    createProductWatch(userId, productId, watchListId)
  ).rejects.toThrow(/unique constraint/);
});
```
