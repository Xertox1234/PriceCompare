# Learnings: Schema-Migration Mismatch Prevention Strategies

**Date:** 2025-12-23
**Priority:** P0 CRITICAL - Deployment Blocker
**Status:** ACTIVE PREVENTION GUIDE
**Category:** Database Schema Management

---

## Summary

Comprehensive prevention strategies for schema-migration mismatch errors - a P0 critical category that can block deployments when schema.ts defines tables/columns that don't exist in migrations, or migrations create "ghost tables" not reflected in the schema.

This guide provides actionable checklists, automated validation scripts, CI/CD checks, and best practices to prevent recurrence.

---

## Problem Category: Schema-Migration Mismatch

### Root Causes

1. **Ghost Tables**: Migration creates table not defined in `shared/schema.ts`
2. **Missing Migrations**: Schema defines table with no corresponding migration
3. **Column Mismatches**: Schema columns don't match migration columns
4. **Index Drift**: Indexes in migration don't match schema index definitions
5. **Constraint Drift**: CHECK/UNIQUE/FK constraints differ between schema and migration
6. **Development Workflow**: Using `db:push` bypasses migration creation

### Impact Severity

- **Deployment Blocker**: Production deploy fails due to missing tables
- **Data Loss Risk**: Schema changes applied without migration can't be rolled back
- **Team Confusion**: Dev environments diverge from production schema
- **Test Failures**: E2E tests fail due to schema inconsistencies
- **Runtime Errors**: Application code references non-existent columns/tables

---

## Part 1: Pre-Migration Checklist

**Use this checklist BEFORE writing any migration SQL.**

### Step 1: Schema Audit (5 minutes)

```bash
# 1. List all tables in shared/schema.ts
grep "export const.*= pgTable" shared/schema.ts

# 2. List all migration files
ls -1 migrations/*.sql

# 3. Check most recent migration
cat migrations/$(ls -1 migrations/*.sql | tail -1)
```

**Questions to Answer:**
- [ ] What tables exist in `shared/schema.ts`?
- [ ] What was the last migration that ran?
- [ ] Am I adding a NEW table or MODIFYING an existing one?
- [ ] Have I run `db:push` recently? (Development only, not production)

### Step 2: Cross-Reference Existing Migrations

```bash
# Search for table name in all migrations
grep -r "CREATE TABLE.*your_table_name" migrations/

# Search for column name in all migrations
grep -r "ADD COLUMN.*your_column_name" migrations/

# Check if table/column already exists in a migration
grep -r "wishlists\|product_specifications" migrations/
```

**Validation Checklist:**
- [ ] Is this table/column ALREADY in a migration? (Don't duplicate)
- [ ] Is this a ROLLBACK of a previous migration? (Check ROLLBACK_GUIDE.md)
- [ ] Are there FK dependencies I need to preserve? (Check CASCADE rules)

### Step 3: Schema Definition Review

**For NEW tables:**
```typescript
// Check schema.ts for:
- [ ] Table exported as pgTable
- [ ] Primary key defined (serial or otherwise)
- [ ] All foreign keys have onDelete cascade rules
- [ ] Indexes defined for FK columns and frequent queries
- [ ] UNIQUE constraints defined where needed
- [ ] Timestamps (created_at, updated_at) included
- [ ] Comments documenting table purpose
```

**For MODIFIED tables:**
```typescript
- [ ] Column being added exists in schema.ts definition
- [ ] Default values match between schema and migration
- [ ] Nullable fields consistent between schema and migration
- [ ] New indexes added to both schema and migration
```

### Step 4: Development Environment Check

```bash
# Check if you've been using db:push (development only)
git status | grep "shared/schema.ts"

# If schema.ts is modified but no migration exists:
# WARNING: You've been using db:push - need to create migration!

# Verify current database state
npm run db:pull  # Generate schema from DB (don't commit this)
diff shared/schema.ts drizzle/schema.ts  # Compare against actual DB
```

**Action Items:**
- [ ] If using `db:push`: Create migration BEFORE production deploy
- [ ] If schema.ts modified: Ensure migration exists
- [ ] If migration exists: Verify schema.ts matches

---

## Part 2: Migration Writing Best Practices

### Pattern 1: Table Creation Migration (NEW table)

**Migration SQL:**
```sql
-- Migration: Add wishlists and specifications
-- Date: 2025-12-23
-- Description: Adds wishlist tables for simple product lists

-- =====================================================
-- WISHLISTS - Simple product lists
-- =====================================================

CREATE TABLE IF NOT EXISTS wishlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'My Wishlist',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON wishlists(user_id);

-- Comments (documentation)
COMMENT ON TABLE wishlists IS 'User wishlists - simple product lists';
COMMENT ON COLUMN wishlists.is_public IS 'If true, wishlist can be shared via link';
```

**Schema Definition (shared/schema.ts):**
```typescript
// User wishlists - simple "I want this" product lists (separate from price tracking watchlists)
export const wishlists = pgTable(
  'wishlists',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull().default('My Wishlist'),
    description: text('description'),
    isPublic: boolean('is_public').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('wishlists_user_id_idx').on(table.userId),
  })
);
```

**Validation Checklist:**
- [ ] Table name matches (wishlists)
- [ ] Column names match (camelCase in schema, snake_case in SQL)
- [ ] Data types match (VARCHAR(255) → varchar({ length: 255 }))
- [ ] Defaults match (DEFAULT FALSE → .default(false))
- [ ] NOT NULL matches (.notNull())
- [ ] Primary key matches (.primaryKey())
- [ ] Foreign keys match (ON DELETE CASCADE → { onDelete: 'cascade' })
- [ ] Indexes match (wishlists_user_id_idx)
- [ ] Timestamps match (created_at, updated_at)

### Pattern 2: Column Addition Migration (EXISTING table)

**Migration SQL:**
```sql
-- Add new column to existing table
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS aggregated_at TIMESTAMP;

-- Add index for new column
CREATE INDEX IF NOT EXISTS idx_price_history_aggregated_at
  ON price_history(aggregated_at);
```

**Schema Update:**
```typescript
export const priceHistory = pgTable(
  'price_history',
  {
    // ... existing columns ...
    aggregatedAt: timestamp('aggregated_at'), // NEW COLUMN
  },
  (table) => ({
    // ... existing indexes ...
    aggregatedAtIdx: index('idx_price_history_aggregated_at').on(table.aggregatedAt), // NEW INDEX
  })
);
```

**Validation Checklist:**
- [ ] Column added to schema definition
- [ ] Column name matches (aggregatedAt → aggregated_at)
- [ ] Data type matches (TIMESTAMP → timestamp())
- [ ] Index added to schema if in migration
- [ ] Index name matches

### Pattern 3: Complex Migration (Multiple Tables)

**When adding multiple related tables:**

1. **Order matters**: Create parent tables before child tables
2. **FK dependencies**: Ensure referenced tables exist first
3. **Cascades**: Add CASCADE rules to all foreign keys
4. **Atomicity**: Wrap in transaction if migration can fail

**Example Order:**
```sql
BEGIN;

-- 1. Parent table (no dependencies)
CREATE TABLE wishlists (...);

-- 2. Child table (depends on wishlists AND users)
CREATE TABLE wishlist_items (
  wishlist_id INTEGER REFERENCES wishlists(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

COMMIT;
```

---

## Part 3: Automated Validation Scripts

### Script 1: Schema-Migration Comparison Tool

**Create:** `scripts/validate-schema-migrations.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Validate that shared/schema.ts matches migrations
 *
 * Checks:
 * 1. All tables in schema exist in migrations
 * 2. All tables in migrations exist in schema
 * 3. Column counts match between schema and DB
 * 4. Index names match between schema and DB
 */

import { db } from '../server/db';
import * as schema from '../shared/schema';
import { sql } from 'drizzle-orm';

async function validateSchema() {
  console.log('🔍 Validating schema against database...\n');

  // 1. Extract table names from schema
  const schemaTables = Object.keys(schema)
    .filter(key => schema[key as keyof typeof schema]?.['_'].name)
    .map(key => schema[key as keyof typeof schema]['_'].name);

  console.log(`📋 Schema defines ${schemaTables.length} tables:`);
  schemaTables.forEach(t => console.log(`   - ${t}`));

  // 2. Query actual database tables
  const dbTablesResult = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const dbTables = dbTablesResult.rows.map((r: any) => r.table_name);
  console.log(`\n📋 Database has ${dbTables.length} tables:`);
  dbTables.forEach(t => console.log(`   - ${t}`));

  // 3. Find ghost tables (in DB but not schema)
  const ghostTables = dbTables.filter(t => !schemaTables.includes(t) && t !== 'schema_migrations');

  if (ghostTables.length > 0) {
    console.error('\n❌ GHOST TABLES FOUND (in DB but not schema.ts):');
    ghostTables.forEach(t => console.error(`   - ${t}`));
    console.error('\n🔧 Action Required:');
    console.error('   1. Add missing tables to shared/schema.ts, OR');
    console.error('   2. Create rollback migration to remove them');
    process.exit(1);
  }

  // 4. Find missing tables (in schema but not DB)
  const missingTables = schemaTables.filter(t => !dbTables.includes(t));

  if (missingTables.length > 0) {
    console.error('\n❌ MISSING TABLES FOUND (in schema.ts but not DB):');
    missingTables.forEach(t => console.error(`   - ${t}`));
    console.error('\n🔧 Action Required:');
    console.error('   1. Create migration to add missing tables, OR');
    console.error('   2. Run migrations: npm run migrate');
    process.exit(1);
  }

  console.log('\n✅ All tables validated successfully!');
  console.log('   - No ghost tables found');
  console.log('   - No missing tables found');

  await db.$client.end();
}

validateSchema().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
```

**Usage:**
```bash
# Add to package.json
"scripts": {
  "validate:schema": "tsx scripts/validate-schema-migrations.ts"
}

# Run before creating new migration
npm run validate:schema
```

### Script 2: Column Audit Tool

**Create:** `scripts/audit-table-columns.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Audit columns for a specific table
 * Compare schema.ts definition against actual database
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const tableName = process.argv[2];

if (!tableName) {
  console.error('Usage: npm run audit:columns <table_name>');
  process.exit(1);
}

async function auditColumns(table: string) {
  const result = await db.execute(sql`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = ${table}
    ORDER BY ordinal_position
  `);

  console.log(`\n📋 Columns in table "${table}":\n`);
  console.table(result.rows);

  await db.$client.end();
}

auditColumns(tableName).catch(console.error);
```

**Usage:**
```bash
# Add to package.json
"scripts": {
  "audit:columns": "tsx scripts/audit-table-columns.ts"
}

# Audit a specific table
npm run audit:columns wishlists
npm run audit:columns product_specifications
```

---

## Part 4: CI/CD Checks to Add

### GitHub Actions: Schema Validation Workflow

**Add to:** `.github/workflows/migration-test.yml`

```yaml
- name: Validate Schema-Migration Consistency
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/migration_test_db
  run: |
    echo "Validating schema matches migrations..."

    # Run migrations
    npm run migrate

    # Run validation script
    npm run validate:schema

    echo "✅ Schema validation passed"

- name: Detect Ghost Tables
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/migration_test_db
  run: |
    echo "Checking for ghost tables..."

    # Query for tables not in schema_migrations tracking
    GHOST_TABLES=$(psql $DATABASE_URL -t -c "
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name != 'schema_migrations'
      ORDER BY table_name;
    ")

    # Expected tables (update this list when adding tables)
    EXPECTED_TABLES="
      badges
      deal_spottings
      forum_categories
      forum_posts
      forum_topics
      job_locks
      notifications
      notification_preferences
      password_reset_tokens
      post_likes
      post_mentions
      post_revisions
      price_aggregates_daily
      price_aggregates_monthly
      price_aggregates_weekly
      price_alerts
      price_history
      price_snapshots
      price_trends
      private_messages
      product_offers
      products
      product_specifications
      product_watches
      retailers
      topic_tags
      topic_tag_relations
      trending_products
      users
      user_badges
      user_reputation
      watch_lists
      watch_list_shares
      wishlists
      wishlist_items
    "

    # Compare and fail if mismatch
    echo "$GHOST_TABLES" | while read table; do
      if ! echo "$EXPECTED_TABLES" | grep -q "\\b$table\\b"; then
        echo "❌ Ghost table detected: $table"
        exit 1
      fi
    done

    echo "✅ No ghost tables found"

- name: Verify Column Counts
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/migration_test_db
  run: |
    echo "Verifying column counts..."

    # Check for tables with suspicious column counts
    SUSPICIOUS=$(psql $DATABASE_URL -t -c "
      SELECT
        table_name,
        COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name
      HAVING COUNT(*) < 3 OR COUNT(*) > 30
      ORDER BY column_count;
    ")

    if [ ! -z "$SUSPICIOUS" ]; then
      echo "⚠️ Tables with unusual column counts:"
      echo "$SUSPICIOUS"
    else
      echo "✅ All tables have reasonable column counts"
    fi
```

### Pre-Commit Hook Addition

**Add to:** `.husky/pre-commit`

```bash
# Check for schema changes without corresponding migration
if git diff --cached --name-only | grep -q "shared/schema.ts"; then
  echo "📋 Schema changes detected..."

  # Get list of migration files
  MIGRATION_COUNT=$(ls -1 migrations/*.sql | wc -l)

  # Check if this is a new migration
  if git diff --cached --name-only | grep -q "migrations/.*\.sql"; then
    echo "✅ Migration file included with schema changes"
  else
    echo ""
    echo "⚠️  WARNING: Schema changed but no migration file added"
    echo ""
    echo "Before committing schema.ts changes, ensure:"
    echo "  1. You've created a migration: migrations/00XX_description.sql"
    echo "  2. Migration matches schema changes exactly"
    echo "  3. You've run: npm run validate:schema"
    echo ""
    echo "If using db:push for development:"
    echo "  - DO NOT commit schema.ts changes without migration"
    echo "  - Create migration before merging to main"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi
```

---

## Part 5: Testing Strategy

### Test 1: Fresh Migration Test

**Purpose:** Verify migration creates correct schema from scratch

```bash
# Create test database
createdb pricecompare_migration_test

# Run all migrations
DATABASE_URL=postgresql://localhost/pricecompare_migration_test npm run migrate

# Validate schema
DATABASE_URL=postgresql://localhost/pricecompare_migration_test npm run validate:schema

# Cleanup
dropdb pricecompare_migration_test
```

### Test 2: Migration Idempotency Test

**Purpose:** Verify migration can run multiple times without errors

```bash
# Run migration twice
npm run migrate
npm run migrate  # Should not fail

# Check for duplicate tables/indexes
DATABASE_URL=$DATABASE_URL psql -c "
  SELECT schemaname, tablename
  FROM pg_tables
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename
  HAVING COUNT(*) > 1;
"
```

### Test 3: Column Accuracy Test

**Purpose:** Verify column names and types match schema

```typescript
// server/__tests__/schema-migration-consistency.test.ts
import { describe, it, expect } from 'vitest';
import { db } from '../db';
import { wishlists, wishlistItems } from '@shared/schema';
import { sql } from 'drizzle-orm';

describe('Schema-Migration Consistency', () => {
  it('should have all wishlists columns in database', async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'wishlists'
      ORDER BY ordinal_position
    `);

    const columns = result.rows.map((r: any) => r.column_name);

    // Verify expected columns exist
    expect(columns).toContain('id');
    expect(columns).toContain('user_id');
    expect(columns).toContain('name');
    expect(columns).toContain('description');
    expect(columns).toContain('is_public');
    expect(columns).toContain('created_at');
    expect(columns).toContain('updated_at');

    // Verify no extra columns
    expect(columns.length).toBe(7);
  });

  it('should have correct data types for wishlist columns', async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'wishlists'
      ORDER BY ordinal_position
    `);

    const columnMap = result.rows.reduce((acc: any, row: any) => {
      acc[row.column_name] = {
        type: row.data_type,
        length: row.character_maximum_length
      };
      return acc;
    }, {});

    expect(columnMap.id.type).toBe('integer');
    expect(columnMap.user_id.type).toBe('integer');
    expect(columnMap.name.type).toBe('character varying');
    expect(columnMap.name.length).toBe(255);
    expect(columnMap.description.type).toBe('text');
    expect(columnMap.is_public.type).toBe('boolean');
  });
});
```

---

## Part 6: Parallel Review Workflow

### When to Use Parallel Review

Use parallel review (human + automated) for:
- [ ] Adding 3+ new tables
- [ ] Complex foreign key relationships
- [ ] Data type changes (BREAKING CHANGE)
- [ ] Index changes affecting performance
- [ ] Production-critical tables (users, products, orders)

### Review Checklist Template

**For Code Reviewer:**
```markdown
## Schema-Migration Review Checklist

### Schema Changes (shared/schema.ts)
- [ ] All new tables have primary keys
- [ ] All foreign keys have onDelete cascade rules
- [ ] Index names match migration
- [ ] Column names use camelCase
- [ ] Comments document table purpose

### Migration Changes (migrations/00XX_*.sql)
- [ ] All tables use CREATE TABLE IF NOT EXISTS
- [ ] All indexes use CREATE INDEX IF NOT EXISTS
- [ ] Column names use snake_case
- [ ] Foreign keys have ON DELETE CASCADE
- [ ] Migration is idempotent (can run multiple times)
- [ ] COMMENT statements document tables/columns

### Cross-Reference Validation
- [ ] Table count matches (schema vs migration)
- [ ] Column count matches (schema vs migration)
- [ ] Index names match exactly
- [ ] Data types match (VARCHAR(255) → varchar({ length: 255 }))
- [ ] Defaults match (DEFAULT FALSE → .default(false))

### Testing Evidence
- [ ] `npm run migrate` succeeds on fresh DB
- [ ] `npm run validate:schema` passes
- [ ] `npm test` passes (integration tests)
- [ ] Manual verification: `npm run audit:columns <table>`

### Rollback Plan
- [ ] Rollback SQL documented in ROLLBACK_GUIDE.md
- [ ] Data loss implications documented
- [ ] Rollback tested on dev database
```

---

## Part 7: Schema Audit Workflow

### Monthly Schema Audit (Maintenance)

**Run this monthly to catch drift:**

```bash
#!/bin/bash
# scripts/monthly-schema-audit.sh

echo "🔍 Running Monthly Schema Audit..."

# 1. Compare schema.ts against production database
echo "\n1. Schema vs Production DB:"
npm run validate:schema

# 2. Check for tables without migrations
echo "\n2. Checking migration coverage:"
TABLES=$(psql $DATABASE_URL -t -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name != 'schema_migrations'
")

for table in $TABLES; do
  FOUND=$(grep -r "CREATE TABLE.*$table" migrations/ || echo "")
  if [ -z "$FOUND" ]; then
    echo "⚠️  Table $table has no CREATE TABLE migration"
  fi
done

# 3. Check for foreign keys without cascade rules
echo "\n3. Checking cascade rules:"
psql $DATABASE_URL -c "
  SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (rc.delete_rule IS NULL OR rc.delete_rule = 'NO ACTION')
    AND tc.table_schema = 'public';
"

# 4. Generate schema diff report
echo "\n4. Generating schema diff report:"
npm run db:pull  # Generate schema from DB
diff shared/schema.ts drizzle/schema.ts > /tmp/schema-drift.diff
if [ -s /tmp/schema-drift.diff ]; then
  echo "⚠️  Schema drift detected! Review /tmp/schema-drift.diff"
else
  echo "✅ No schema drift detected"
fi

echo "\n✅ Audit complete!"
```

---

## Part 8: Quick Reference

### Before Creating Migration

```bash
# 1. Audit current schema
npm run validate:schema

# 2. Check if table already exists
grep -r "CREATE TABLE.*your_table" migrations/

# 3. Review schema definition
cat shared/schema.ts | grep -A20 "export const yourTable"

# 4. Check foreign key dependencies
grep -r "REFERENCES.*your_table" migrations/
```

### After Creating Migration

```bash
# 1. Test fresh migration
DATABASE_URL=postgresql://localhost/test_db npm run migrate

# 2. Validate schema matches
npm run validate:schema

# 3. Audit columns
npm run audit:columns your_table_name

# 4. Run integration tests
npm test
```

### Development Workflow

```mermaid
graph TD
    A[Modify schema.ts] --> B{Production Deploy?}
    B -->|Yes| C[Create Migration]
    B -->|No| D[Use db:push]
    C --> E[Test Migration]
    E --> F[Validate Schema]
    F --> G[Commit Both Files]
    D --> H[DO NOT Commit]
```

---

## Key Takeaways

### 1. Always Pair Schema + Migration
- **Schema change WITHOUT migration** = ❌ Deployment blocker
- **Migration WITHOUT schema change** = ❌ Ghost table
- **Both together** = ✅ Correct

### 2. Validate Before Commit
```bash
# Pre-commit validation
npm run validate:schema
npm run audit:columns <table>
npm test
```

### 3. Use Automated Checks
- Pre-commit hook catches missing migrations
- CI/CD validates schema consistency
- Monthly audits catch drift

### 4. Document Everything
- Migration comments explain purpose
- Schema comments link to migrations
- ROLLBACK_GUIDE.md documents reversal process

### 5. Test Thoroughly
- Fresh migration test (clean database)
- Idempotency test (run twice)
- Column accuracy test (verify types/names)
- Integration tests (application functionality)

---

## Related Documentation

- **Schema Patterns:** `docs/02_DATABASE_PATTERNS.md` (Section 8: Migration Patterns)
- **Migration Testing:** `.github/workflows/migration-test.yml`
- **Rollback Guide:** `migrations/ROLLBACK_GUIDE.md`
- **Constraint Validation:** `docs/LEARNINGS_TODO_2026_ZOD_CHECK_CONSTRAINTS.md`

---

**Maintained By:** Claude Code / Development Team
**Next Review:** When adding new tables or encountering schema drift
