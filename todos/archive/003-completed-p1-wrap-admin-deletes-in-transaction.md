---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, data-integrity, transactions, admin]
dependencies: []
---

# Wrap Admin DELETE Operations in Transactions

## Problem Statement

Admin product and retailer deletion in `admin-routes.ts` performs multiple delete operations without a transaction. If the second delete fails after the first succeeds, the database is left in an inconsistent state.

## Findings

- Discovered during comprehensive code review by Data Integrity Guardian agent
- Location: `server/routes/admin-routes.ts:222-244` (products), `298-320` (retailers)
- Current code deletes offers first, then the parent record - no atomicity

## Proposed Solutions

### Option 1: Wrap in transaction (RECOMMENDED)
- **Change:** Use `db.transaction()` to wrap both deletes
- **Pros:** Atomic operation, rollback on failure
- **Cons:** Slight performance overhead (negligible for admin operations)
- **Effort:** Small
- **Risk:** Low

### Option 2: Rely on CASCADE rules
- **Change:** Remove explicit offer/product deletes, let CASCADE handle cleanup
- **Pros:** Simpler code, leverages existing CASCADE rules from migration 0011
- **Cons:** Less explicit about what's being deleted
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option 2 - The CASCADE rules already exist, so the explicit deletes are redundant. Simply delete the parent record and let PostgreSQL handle cascade.

## Technical Details

- **Affected Files:** `server/routes/admin-routes.ts`
- **Related Components:** Admin panel, product/retailer management
- **Database Changes:** No - uses existing CASCADE rules

### Current Code (Lines 228-234)
```typescript
// Delete associated offers first
await db.delete(schema.productOffers)
  .where(eq(schema.productOffers.productId, productId));

// Then delete the product
const [deletedProduct] = await db.delete(schema.products)
  .where(eq(schema.products.id, productId))
  .returning();
```

### Proposed Code (Option 2 - Rely on CASCADE)
```typescript
// CASCADE rule handles offer deletion automatically
const [deletedProduct] = await db.delete(schema.products)
  .where(eq(schema.products.id, productId))
  .returning();
```

## Acceptance Criteria

- [ ] Product deletion is atomic (either fully succeeds or fully fails)
- [ ] Retailer deletion is atomic
- [ ] Associated offers/products are properly cleaned up
- [ ] Admin panel deletion functionality works correctly
- [ ] Tests pass

## Work Log

### 2025-11-22 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during comprehensive code review
- Analyzed by Data Integrity Guardian agent
- Noted that CASCADE rules from migration 0011 make explicit deletes redundant

**Learnings:**
- Multi-step deletes should either use transactions or rely on CASCADE
- Explicit deletes before CASCADE parent delete are redundant and risky

## Notes

Source: Code review performed on 2025-11-22
Review command: /compounding-engineering:review codebase
