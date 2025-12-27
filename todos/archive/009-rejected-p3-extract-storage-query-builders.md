---
status: rejected
priority: p3
issue_id: "009"
tags: [code-quality, duplication, refactoring, storage]
dependencies: []
completed_date: 2025-12-26
resolution: invalid_type_mismatch
---

# Extract Query Builder Helpers in Storage Domains

## Problem Statement

Storage domain files (`product-storage.ts`, `notification-storage.ts`) contain duplicated query construction patterns where similar SELECT statements are repeated with different WHERE filters. Extracting these to reusable query builder helpers would reduce 30+ lines of duplication and improve maintainability.

**Impact:** LOW - Code quality improvement, no functional changes or performance impact.

## Findings

**From Pattern Recognition Analysis (2025-12-26):**

**Duplication instances (jscpd results):**

**1. product-storage.ts**
- Lines 473-478 vs 462-468 (5 lines, 64 tokens)
- Lines 652-666 vs 623-637 (14 lines, 150 tokens)
- **Pattern:** Similar query construction with different filters

**2. notification-storage.ts**
- Lines 493-504 vs 467-478 (11 lines, 112 tokens)
- **Pattern:** Notification queries with varying date/type filters

**Total duplication:** 30 lines across storage domains

**Code duplication severity:** Low (test code duplication is higher priority - see TODO 002)

## Proposed Solutions

### Option 1: Extract Query Builder Methods (Recommended)

**Approach:** Create private helper methods in each storage class for common query patterns.

**Example for product-storage.ts:**
```typescript
// Before (duplicated):
const products1 = await this.db.select({
  id: products.id,
  name: products.name,
  category: products.category,
  // ... 15 fields
}).from(products).where(eq(products.id, productId));

const products2 = await this.db.select({
  id: products.id,
  name: products.name,
  category: products.category,
  // ... 15 fields (duplicated)
}).from(products).where(eq(products.category, category));

// After (extracted):
private buildProductSelect() {
  return {
    id: products.id,
    name: products.name,
    category: products.category,
    // ... 15 fields once
  };
}

const products1 = await this.db.select(this.buildProductSelect())
  .from(products).where(eq(products.id, productId));

const products2 = await this.db.select(this.buildProductSelect())
  .from(products).where(eq(products.category, category));
```

**Pros:**
- Reduces duplication by 30+ lines
- Single source of truth for field selection
- Easy to add/remove fields across all queries
- Type-safe (TypeScript enforces)
- Minimal refactoring risk

**Cons:**
- Slightly more verbose for simple queries
- Need to ensure helper method is comprehensive

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Create Shared Query Builder Utility

**Approach:** Create `server/utils/query-builder.ts` with generic helpers.

**Pros:**
- Reusable across all storage domains
- More comprehensive solution

**Cons:**
- May be overkill for current duplication level
- Harder to make type-safe generically
- Higher effort for marginal benefit

**Effort:** 6-8 hours

**Risk:** Medium (overengineering)

---

### Option 3: Accept Duplication (Do Nothing)

**Approach:** Keep current duplication as acceptable trade-off.

**Pros:**
- Zero effort
- Queries are explicit and readable
- Duplication is localized

**Cons:**
- Maintains technical debt
- Field changes need multiple updates

**Effort:** 0 hours

**Risk:** None

## Recommended Action

**Option 1** if actively working in these files, **Option 3** otherwise.

**Rationale:** 30 lines of duplication is not critical. Only worth fixing if:
1. Actively refactoring these storage domains
2. Adding new queries that would duplicate further
3. Part of larger cleanup effort

## Technical Details

**Affected files:**
- `server/storage/domains/product-storage.ts` (2 duplication instances)
- `server/storage/domains/notification-storage.ts` (1 duplication instance)

**Duplication breakdown:**
- Query field selection: ~20 lines
- JOIN patterns: ~5 lines
- WHERE clause construction: ~5 lines

**Pattern example (notification-storage.ts):**
```typescript
// Lines 467-478 vs 493-504 (11 lines duplicated)
const notifications = await this.db.select({
  id: notifications.id,
  userId: notifications.userId,
  type: notifications.type,
  message: notifications.message,
  isRead: notifications.isRead,
  createdAt: notifications.createdAt,
})
.from(notifications)
.where(and(
  eq(notifications.userId, userId),
  eq(notifications.type, type),
  gte(notifications.createdAt, startDate)
));
```

**Extraction approach:**
```typescript
private buildNotificationSelect() {
  return {
    id: notifications.id,
    userId: notifications.userId,
    type: notifications.type,
    message: notifications.message,
    isRead: notifications.isRead,
    createdAt: notifications.createdAt,
  };
}

// Use in queries:
const results = await this.db.select(this.buildNotificationSelect())
  .from(notifications)
  .where(/* custom filters */);
```

## Resources

- **jscpd analysis:** Code Review 2025-12-26
- **Storage layer pattern:** `docs/02_DATABASE_PATTERNS.md`
- **BaseStorage class:** `server/storage/base-storage.ts` (potential home for shared helpers)

## Acceptance Criteria

**If implementing Option 1:**
- [ ] Query builder methods extracted in product-storage.ts
- [ ] Query builder methods extracted in notification-storage.ts
- [ ] Duplication reduced by >90% (from 30 to <3 lines)
- [ ] All tests pass (no behavior changes)
- [ ] Type safety maintained (TypeScript strict mode)
- [ ] Query performance unchanged (verified with benchmarks)
- [ ] Code review confirms DRY principles followed

## Work Log

### 2025-12-26 - Initial Discovery

**By:** Pattern Recognition Specialist Agent (Code Review)

**Actions:**
- Ran jscpd code duplication analysis
- Identified 3 instances of storage domain query duplication
- Analyzed duplication patterns (field selection, JOINs)
- Calculated impact: 30 lines total
- Compared to WebSocket test duplication (500+ lines) - lower priority

**Learnings:**
- Most significant duplication is in test files (TODO 002)
- Storage domain duplication is modest (30 lines)
- Private helper methods cleanest solution
- BaseStorage could host shared helpers if needed
- Not urgent - only worth fixing if actively refactoring

## Notes

- **Priority P3 (Nice-to-have)** - Code quality, not functional issue
- **Lower priority than TODO 002** (WebSocket test duplication: 500+ lines)
- **Opportunistic fix:** Address when working in these files anyway
- **Pattern consideration:** If duplication grows to 50+ lines, increase priority
- Consider similar pattern for price-storage.ts if has duplication

## Resolution (2025-12-26)

**REJECTED - TypeScript Type Mismatch**

Attempted to apply the proposed solution but discovered a fundamental type incompatibility:

**Investigation:**
- `notification-storage.ts` has a `buildNotificationSelect()` helper (lines 31-41)
- Helper selects subset of fields: `id`, `userId`, `type`, `message`, `isRead`, `createdAt`, `metadata`
- Full `Notification` type requires additional fields: `title`, `content`, `relatedPostId`, `relatedTopicId`, `relatedUserId`, `relatedProductId`

**TypeScript Error Encountered:**
```
Type '{ id: number; userId: number; type: string; message: any; isRead: boolean | null; createdAt: Date | null; metadata: any; }[]' is not assignable to type 'Notification[]'.
Type is missing properties: title, content, relatedPostId, relatedTopicId, and 2 more. [2322]
```

**Why This Happened:**
- The `buildNotificationSelect()` helper was created to reduce duplication
- However, it doesn't select all required fields for the `Notification` type
- Using `.select()` without arguments returns all fields (matches type)
- Using `.select(this.buildNotificationSelect())` returns partial fields (type mismatch)

**Options Considered:**
1. **Update helper to select all fields** - Defeats purpose (no field deduplication benefit)
2. **Change return types to partial** - Breaks type safety downstream
3. **Remove unused helper** - Creates warning about unused code
4. **Accept current duplication** - **Chosen approach**

**Recommendation:**
- Keep `.select()` calls as-is in methods returning full `Notification[]`
- Remove or keep `buildNotificationSelect()` helper for potential future use with explicitly typed partial results
- Accept modest duplication (30 lines) as acceptable trade-off for type safety

**Lesson Learned:**
Query builder helpers for storage domains must match the full return type or require explicit typing of partial results throughout the call chain. For 30 lines of duplication, type safety takes precedence over DRY principles.
