---
status: ready
priority: p1
issue_id: "009"
tags: [database, data-integrity, schema, migration, code-review]
dependencies: []
---

# Add Missing Foreign Key Cascade Rules to Schema

## Problem Statement

**CRITICAL DATA INTEGRITY ISSUE**: Most foreign key references in the database schema lack `onDelete` and `onUpdate` cascade rules. Only 7 out of dozens of foreign keys properly define cascade behavior. This creates severe referential integrity risks where deleting parent records (products, retailers, users) leaves orphaned child records, causing data corruption and accumulating garbage data over time.

## Findings

Discovered during comprehensive code audit by data-integrity-guardian agent on 2025-11-18.

**Current State:**
- ✅ Only 7 foreign keys have cascade rules (passwordResetTokens, price aggregates, price trends)
- ❌ 40+ foreign keys lack cascade rules

**Critical Missing Cascades:**

1. **productOffers table** (Lines 47-48 in schema.ts):
```typescript
productId: integer("product_id").references(() => products.id).notNull(),
retailerId: integer("retailer_id").references(() => retailers.id).notNull(),
// Missing: onDelete: 'cascade'
```

2. **priceHistory table** (Lines 71-74):
```typescript
productOfferId: integer("product_offer_id").references(() => productOffers.id).notNull(),
productId: integer("product_id").references(() => products.id).notNull(),
retailerId: integer("retailer_id").references(() => retailers.id).notNull(),
// Missing: onDelete: 'cascade' on all 3!
```

3. **priceAlerts table**:
```typescript
userId: integer("user_id").references(() => users.id).notNull(),
productId: integer("product_id").references(() => products.id).notNull(),
// Missing: onDelete: 'cascade'
```

4. **forumPosts table**:
```typescript
topicId: integer("topic_id").references(() => forumTopics.id).notNull(),
authorId: integer("author_id").references(() => users.id),
// Missing: onDelete: 'cascade' on topicId, 'set null' on authorId
```

**Corruption Scenario:**
```typescript
// Admin deletes a product
await db.delete(products).where(eq(products.id, 123));

// Result: Data corruption!
// - 50 productOffers for product 123 still exist (orphaned)
// - 1000s of priceHistory records orphaned
// - User price alerts reference non-existent product
// - Queries return null for product but related data remains
```

**Impact:**
- Orphaned records accumulate indefinitely
- Data corruption and inconsistency
- Database bloat (orphaned records take up space)
- Application errors when joining to deleted parents
- Cannot trust referential integrity

## Proposed Solutions

### Option 1: Add Cascade Rules to Schema + Migration (Recommended)

**Pros:**
- Enforces referential integrity at database level
- Automatic cleanup when parents are deleted
- Standard SQL pattern
- Prevents orphaned records

**Cons:**
- Requires database migration
- Must be careful with user data (use SET NULL for some cases)

**Effort:** Medium (4-6 hours for schema update + migration)

**Risk:** Low (database handles cascades correctly)

**Implementation:**

```typescript
// Fix: shared/schema.ts

export const productOffers = pgTable("product_offers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  retailerId: integer("retailer_id")
    .references(() => retailers.id, { onDelete: 'cascade' })
    .notNull(),
  // ... other fields
});

export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  productOfferId: integer("product_offer_id")
    .references(() => productOffers.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  retailerId: integer("retailer_id")
    .references(() => retailers.id, { onDelete: 'cascade' })
    .notNull(),
  // ... other fields
});

export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  // ... other fields
});

export const forumPosts = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id")
    .references(() => forumTopics.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: integer("author_id")
    .references(() => users.id, { onDelete: 'set null' }), // Keep posts but anonymize
  // ... other fields
});
```

**Migration SQL:**
```sql
-- migrations/0011_add_cascade_rules.sql

-- Drop existing foreign keys and recreate with CASCADE
ALTER TABLE product_offers
  DROP CONSTRAINT IF EXISTS product_offers_product_id_fkey,
  ADD CONSTRAINT product_offers_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE product_offers
  DROP CONSTRAINT IF EXISTS product_offers_retailer_id_fkey,
  ADD CONSTRAINT product_offers_retailer_id_fkey
    FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON DELETE CASCADE;

-- Repeat for all tables: priceHistory, priceAlerts, notifications, forumPosts, etc.
```

## Recommended Action

**HIGH PRIORITY - PREVENT DATA CORRUPTION**

1. Update schema.ts with cascade rules for ALL foreign keys
2. Create migration to add CASCADE to existing database
3. Test migration on staging database first
4. Document which relationships use CASCADE vs SET NULL
5. Add check in pre-commit hook for missing cascade rules

**Cascade Strategy:**
- **CASCADE**: When child data is meaningless without parent (offers, price history)
- **SET NULL**: When child data should persist but be anonymized (forum posts by deleted users)
- **RESTRICT**: When deletion should be prevented if children exist (rarely needed)

## Technical Details

**Affected Tables (40+ foreign keys to fix):**
- productOffers (2 FKs)
- priceHistory (3 FKs)
- priceAlerts (2 FKs)
- priceSnapshots (2 FKs)
- productWatches (2 FKs)
- notifications (1-2 FKs)
- forumPosts (2 FKs)
- forumTopics (2 FKs)
- forumTopicTags (2 FKs)
- watchListProducts (2 FKs)
- dealSpottings (2 FKs)
- ... and more

**Database Changes:** Yes - requires migration to add CASCADE rules

## Resources

- PostgreSQL Foreign Keys: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK
- Drizzle ORM References: https://orm.drizzle.team/docs/rqb#foreign-keys
- Data integrity audit report

## Acceptance Criteria

- [ ] Update schema.ts with cascade rules for ALL foreign keys
- [ ] Create and test migration on local database
- [ ] Test migration on staging database
- [ ] Verify orphaned records are cleaned up after migration
- [ ] Test product deletion - verify offers and history are cascaded
- [ ] Test user deletion - verify posts use SET NULL correctly
- [ ] Document cascade strategy in CLAUDE.md
- [ ] Run full test suite - all tests pass

## Work Log

### 2025-11-18 - Data Integrity Audit Discovery
**By:** Claude Code Review System (data-integrity-guardian agent)
**Actions:**
- Discovered missing cascade rules in 40+ foreign keys
- Analyzed impact of orphaned records
- Categorized as P1 CRITICAL for data integrity

**Learnings:**
- Only 7 foreign keys had cascade rules defined
- Early migrations (0001-0004) didn't include CASCADE
- Later migrations (0009) properly used CASCADE
- Need to standardize cascade rules across entire schema

## Notes

**DATA INTEGRITY**: This issue causes silent data corruption over time. Orphaned records accumulate and the database becomes inconsistent. While not an immediate crash risk, it's a critical long-term data quality issue.

Consider this cleanup query AFTER fixing cascades:
```sql
-- Find orphaned productOffers
SELECT COUNT(*) FROM product_offers po
LEFT JOIN products p ON po.product_id = p.id
WHERE p.id IS NULL;

-- Delete orphaned data (run AFTER cascades are in place)
DELETE FROM product_offers WHERE product_id NOT IN (SELECT id FROM products);
```

Source: Comprehensive code audit performed on 2025-11-18
