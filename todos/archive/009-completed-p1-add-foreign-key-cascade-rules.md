---
status: completed
priority: p1
issue_id: "009"
tags: [database, data-integrity, schema, migration, code-review]
dependencies: []
completed_at: 2025-11-19
github_issue: 59
github_pr: 60
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

## Solution Implemented

### Option 1: Add Cascade Rules to Schema + Migration (Chosen)

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

## Technical Details

**Affected Tables (51 foreign keys fixed):**
- productOffers (2 FKs)
- priceHistory (3 FKs)
- priceAlerts (2 FKs)
- priceSnapshots (2 FKs)
- productWatches (3 FKs)
- notifications (5 FKs)
- forumPosts (4 FKs)
- forumTopics (3 FKs)
- topicTagRelations (2 FKs)
- watchLists (1 FK)
- dealSpottings (3 FKs)
- postRevisions (2 FKs)
- trendingProducts (1 FK)
- searchQueries (2 FKs)
- scrapingJobs (1 FK)
- pricePredictions (1 FK)
- productUrls (2 FKs)
- postLikes (2 FKs)
- postMentions (3 FKs)
- privateMessages (2 FKs)
- userBadges (2 FKs)
- userReputation (1 FK)
- notificationPreferences (1 FK)
- forumCategories (1 FK)

**Cascade Strategy Summary:**
- **34 CASCADE** - Child data meaningless without parent
- **17 SET NULL** - Child data persists, anonymize reference
- **0 RESTRICT** - Prevent deletion if children exist

**Database Changes:** Yes - migration 0011 adds CASCADE rules

## Resources

- PostgreSQL Foreign Keys: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK
- Drizzle ORM References: https://orm.drizzle.team/docs/rqb#foreign-keys
- Data integrity audit report

## Acceptance Criteria

- [x] Update schema.ts with cascade rules for ALL foreign keys
- [x] Create migration (0011_add_cascade_rules.sql)
- [x] TypeScript type check passes (no new errors)
- [x] Pass pre-commit hooks
- [x] Document cascade strategy in CLAUDE.md
- [x] Create GitHub issue #59
- [x] Create pull request #60
- [x] PR merged successfully

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

### 2025-11-19 - Implementation Complete
**By:** Claude Code (AI Assistant)
**Actions:**
- Created GitHub issue #59 with comprehensive problem description
- Set up feature branch worktree: `fix/add-foreign-key-cascade-rules`
- Updated shared/schema.ts with cascade rules for 51 foreign keys
- Created comprehensive migration: migrations/0011_add_cascade_rules.sql
- Added "Foreign Key Cascade Strategy" section to CLAUDE.md
- Committed with detailed commit message
- Created PR #60: "feat: Add Missing Foreign Key Cascade Rules (P1 CRITICAL)"
- PR passed all pre-commit hooks
- PR merged successfully to add_scraping branch

**Files Changed:**
- `shared/schema.ts` (+51 cascade rules)
- `migrations/0011_add_cascade_rules.sql` (new file, 495 lines)
- `CLAUDE.md` (+cascade strategy documentation)

**Learnings:**
- Comprehensive migration with 51 foreign key updates
- Dual strategy: CASCADE for dependent data, SET NULL for preservation
- Documentation critical for future development standards
- Pre-commit hooks validated no security issues introduced

## Notes

**DATA INTEGRITY**: This issue causes silent data corruption over time. Orphaned records accumulate and the database becomes inconsistent. While not an immediate crash risk, it's a critical long-term data quality issue.

**Resolution:** All 51 foreign keys now have proper cascade rules. Database will automatically maintain referential integrity going forward.

Source: Comprehensive code audit performed on 2025-11-18, implemented 2025-11-19
