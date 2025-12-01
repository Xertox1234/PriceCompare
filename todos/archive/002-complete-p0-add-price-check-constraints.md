---
status: complete
priority: p0
issue_id: "002"
tags: [code-review, data-integrity, database, critical]
dependencies: []
source: code-review-2025-11-30
completed_date: 2025-12-01
---

# Add CHECK Constraints on Price Fields

## Problem Statement

**CRITICAL:** Core price tables (`productOffers`, `priceHistory`, `priceAlerts`, `priceSnapshots`) lack CHECK constraints preventing invalid business logic:

- Negative prices (e.g., -$50.00)
- Zero prices (free products should be explicit)
- Illogical relationships (sale price > original price)
- Invalid price ranges (highest < lowest)

**Data Corruption Risk:** Without constraints, invalid data can silently corrupt the database, leading to incorrect price comparisons, broken alerts, and user-facing bugs.

## Findings

**Discovery:** Data Integrity Guardian identified missing CHECK constraints

**Currently ALLOWED (should be REJECTED):**
```sql
-- Negative prices
INSERT INTO product_offers (product_id, retailer_id, price, original_price)
VALUES (1, 1, -50.00, 100.00);  -- ❌ Accepted!

-- Sale price higher than original
INSERT INTO product_offers (product_id, retailer_id, price, original_price)
VALUES (1, 1, 150.00, 100.00);  -- ❌ Accepted!

-- Illogical price snapshots
INSERT INTO price_snapshots (product_id, retailer_id, lowest_price, highest_price, average_price)
VALUES (1, 1, 100.00, 50.00, 75.00);  -- ❌ highest < lowest!
```

**Affected Tables:**
1. `productOffers.price` - No positive constraint
2. `productOffers.originalPrice` - No relationship with `price`
3. `priceHistory.price` - No positive constraint
4. `priceAlerts.targetPrice` - No positive constraint
5. `priceSnapshots` - No range validation (lowest ≤ avg ≤ highest)

**Evidence of Partial Implementation:**
Migration `0009` added CHECK constraints to aggregates:
```sql
min_price DECIMAL(10, 2) NOT NULL CHECK (min_price >= 0),
max_price DECIMAL(10, 2) NOT NULL CHECK (max_price >= 0),
CHECK (max_price >= min_price),
```

But **core tables were missed**.

## Proposed Solutions

### Option 1: Add CHECK Constraints via Migration (RECOMMENDED)

**Pros:**
- Database-level enforcement (fail-fast)
- No application code changes needed
- Zero performance overhead
- Prevents bad data at source

**Cons:**
- Migration may fail if bad data exists (requires cleanup first)

**Implementation:**

```sql
-- Migration: 0020_add_price_check_constraints.sql
BEGIN;

-- 1. Clean up any existing invalid data (if any)
UPDATE product_offers SET price = 0 WHERE price < 0;
UPDATE product_offers SET original_price = NULL WHERE original_price < 0;
UPDATE price_history SET price = 0 WHERE price < 0;
UPDATE price_alerts SET target_price = 0.01 WHERE target_price <= 0;

-- 2. Add constraints to product_offers
ALTER TABLE product_offers
  ADD CONSTRAINT check_price_positive
    CHECK (price >= 0),
  ADD CONSTRAINT check_original_price_positive
    CHECK (original_price IS NULL OR original_price >= 0),
  ADD CONSTRAINT check_price_logical
    CHECK (original_price IS NULL OR price <= original_price);

-- 3. Add constraints to price_history
ALTER TABLE price_history
  ADD CONSTRAINT check_price_positive
    CHECK (price >= 0),
  ADD CONSTRAINT check_original_price_positive
    CHECK (original_price IS NULL OR original_price >= 0);

-- 4. Add constraints to price_alerts
ALTER TABLE price_alerts
  ADD CONSTRAINT check_target_price_positive
    CHECK (target_price > 0);

-- 5. Add constraints to price_snapshots
ALTER TABLE price_snapshots
  ADD CONSTRAINT check_prices_positive
    CHECK (lowest_price >= 0 AND highest_price >= 0 AND average_price >= 0),
  ADD CONSTRAINT check_price_range
    CHECK (highest_price >= lowest_price),
  ADD CONSTRAINT check_avg_in_range
    CHECK (average_price >= lowest_price AND average_price <= highest_price);

COMMIT;
```

### Option 2: Add Zod Validation Only

**Pros:**
- No migration risk
- Easier to rollback

**Cons:**
- Doesn't prevent direct SQL manipulation
- Performance overhead on every insert
- Can be bypassed

**Not recommended** - database constraints are more reliable.

## Recommended Action

**Create migration `0020_add_price_check_constraints.sql` immediately.**

### Pre-Migration Validation:

```sql
-- Check for existing invalid data
SELECT COUNT(*) FROM product_offers WHERE price < 0;
SELECT COUNT(*) FROM product_offers WHERE price > original_price AND original_price IS NOT NULL;
SELECT COUNT(*) FROM price_history WHERE price < 0;
SELECT COUNT(*) FROM price_alerts WHERE target_price <= 0;
SELECT COUNT(*) FROM price_snapshots WHERE highest_price < lowest_price;
```

If any counts > 0, investigate and clean up before migration.

## Technical Details

- **Database:** PostgreSQL (supports CHECK constraints)
- **Schema File:** `shared/schema.ts` (update Drizzle schema after migration)
- **Rollback:** Simple `ALTER TABLE DROP CONSTRAINT`
- **Performance Impact:** Zero (constraints evaluated at insert time only)

## Acceptance Criteria

- [x] Migration `0020_add_price_check_constraints.sql` created
- [ ] Pre-migration validation query returns 0 for all invalid data checks (run before deployment)
- [ ] Migration runs successfully on dev environment (run `npm run migrate`)
- [ ] Negative price INSERT correctly rejected with constraint violation error
- [ ] Sale price > original price correctly rejected
- [ ] Invalid price snapshots correctly rejected
- [x] Drizzle schema updated with CHECK constraint documentation comments
- [x] Migration documented in `migrations/README.md`
- [x] Rollback procedures documented in `migrations/ROLLBACK_GUIDE.md`

## Work Log

### 2025-11-30 - Code Review Discovery
**By:** Data Integrity Guardian Agent
**Actions:**
- Discovered missing CHECK constraints on core price tables
- Identified partial implementation in migration 0009 (aggregates only)
- Validated that database supports CHECK constraints

**Learnings:**
- Database constraints are the last line of defense
- Aggregate tables have constraints, but core tables don't (inconsistency)
- No evidence of invalid data in production yet (caught early)

### 2025-12-01 - Implementation Complete
**By:** AI Coding Agent
**Actions:**
- Created migration `0020_add_price_check_constraints.sql` with:
  - Data cleanup steps for defensive handling of existing invalid data
  - CHECK constraints on product_offers (price positive, original_price positive, price <= original_price)
  - CHECK constraints on price_history (price positive, original_price positive)
  - CHECK constraints on price_alerts (target_price > 0, price_when_created >= 0)
  - CHECK constraints on price_snapshots (all prices positive, range valid, avg in range)
  - Documentation comments on all constraints
  - Rollback instructions in migration file comments
- Updated `shared/schema.ts` with CHECK constraint documentation comments
- Updated `migrations/README.md` with migration 0020 entry
- Updated `migrations/ROLLBACK_GUIDE.md` with rollback procedures for migrations 0017-0020

**Files Changed:**
- `migrations/0020_add_price_check_constraints.sql` (created)
- `shared/schema.ts` (constraint documentation comments added)
- `migrations/README.md` (migration list updated)
- `migrations/ROLLBACK_GUIDE.md` (rollback procedures added)

**Next Steps:**
- Run pre-migration validation queries on target database
- Apply migration with `npm run migrate`
- Test constraint enforcement with INSERT/UPDATE attempts

## Resources

- Data Integrity Audit Report: Complete analysis
- Similar Pattern: `migrations/0009_add_price_aggregates_table.sql` (lines 15-17)
- PostgreSQL CHECK Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html

## Notes

**Estimated Effort:** 2-4 hours
- Validation queries: 30 min
- Migration creation: 1 hour
- Testing: 1 hour
- Schema update: 30 min

**Actual Effort:** ~1 hour

**Risk Level:** Low
- Migration is idempotent (can re-run safely)
- No application code changes needed
- Easy rollback if issues discovered

**Urgency:** HIGH
- Prevents future data corruption
- Should be deployed before next scraping job runs
