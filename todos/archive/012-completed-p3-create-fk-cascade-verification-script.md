---
status: completed
priority: p3
issue_id: "012"
tags: [database, data-integrity, ci-cd, validation]
dependencies: []
---
completed_date: 2025-12-26

# Create Foreign Key Cascade Verification Script

## Problem Statement

The project has excellent foreign key cascade rules (migration 0011 added 51 cascades), but there's no automated verification that ALL foreign keys have explicit cascade rules. New migrations could accidentally omit cascade rules, leading to orphaned records or deletion failures in production.

**Impact:** LOW - Preventive measure to maintain data integrity standards.

## Findings

**From Data Integrity Review (2025-12-26):**

**Current state:**
- Migration 0011 comprehensively added CASCADE/SET NULL rules
- 51 foreign keys updated with proper cascade behavior
- 34 CASCADE (child meaningless without parent)
- 17 SET NULL (preserve content, anonymize author)
- No automated verification that future migrations maintain this standard

**Risk:**
- Developer adds new foreign key without CASCADE/SET NULL/RESTRICT
- Pre-commit hook doesn't catch it (no check exists)
- Production deployment creates FK with default NO ACTION
- User deletion fails or leaves orphaned records

**Validation query (manual):**
```sql
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
  AND tc.table_schema = 'public'
  AND (rc.delete_rule IS NULL OR rc.delete_rule = 'NO ACTION')
ORDER BY tc.table_name;
```

## Proposed Solutions

### Option 1: Add Validation Script to npm Scripts (Recommended)

**Approach:** Create `scripts/validate-fk-cascades.ts` that runs the SQL query and fails if any FK lacks explicit cascade rule.

**Implementation:**
```typescript
// scripts/validate-fk-cascades.ts
import { db } from '../server/config/database';
import { sql } from 'drizzle-orm';

async function validateForeignKeyCascades(): Promise<void> {
  const results = await db.execute(sql`
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
      AND tc.table_schema = 'public'
      AND (rc.delete_rule IS NULL OR rc.delete_rule = 'NO ACTION')
    ORDER BY tc.table_name;
  `);

  if (results.rows.length > 0) {
    console.error('❌ Foreign keys without explicit cascade rules:');
    results.rows.forEach((row: any) => {
      console.error(`  - ${row.table_name}.${row.column_name} → ${row.foreign_table_name}`);
    });
    console.error('\nAll foreign keys must have explicit CASCADE, SET NULL, or RESTRICT rules.');
    console.error('See docs/02_DATABASE_PATTERNS.md for guidance.');
    process.exit(1);
  }

  console.log('✅ All foreign keys have explicit cascade rules');
}

validateForeignKeyCascades().catch((error) => {
  console.error('Validation failed:', error);
  process.exit(1);
});
```

**Add to package.json:**
```json
{
  "scripts": {
    "validate:fk-cascades": "tsx scripts/validate-fk-cascades.ts",
    "validate:all": "npm run validate:schema && npm run validate:fk-cascades"
  }
}
```

**Pros:**
- Catches missing cascades before deployment
- Can run in CI/CD pipeline
- Simple SQL query, fast execution
- Clear error messages for developers

**Cons:**
- Requires database connection to run
- May need test database for CI/CD

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Integrate with Pre-Commit Hook

**Approach:** Add FK cascade check to `scripts/security-checks.sh`.

**Pros:**
- Catches violations before commit
- Enforces at earliest point

**Cons:**
- Requires database connection during commit
- Slows down commit process
- May block commits if dev DB unavailable

**Effort:** 3-4 hours

**Risk:** Medium (commit workflow disruption)

---

### Option 3: Migration Linter

**Approach:** Parse SQL migration files for `FOREIGN KEY` without `ON DELETE`.

**Pros:**
- No database connection needed
- Fast execution
- Can run pre-commit

**Cons:**
- Regex parsing of SQL is fragile
- May have false positives/negatives
- Doesn't validate deployed schema, only new migrations

**Effort:** 4-6 hours

**Risk:** Medium (regex complexity)

## Recommended Action

**IMPLEMENT Option 1** (npm script) and run in CI/CD. Option 2 (pre-commit) if team wants enforcement earlier.

## Technical Details

**Affected files:**
- `scripts/validate-fk-cascades.ts` - New validation script
- `package.json` - Add `validate:fk-cascades` script
- `.github/workflows/*.yml` - Add to CI/CD (if applicable)
- `docs/02_DATABASE_PATTERNS.md` - Reference from error message

**Integration points:**
1. **Local development:** `npm run validate:fk-cascades` before commit
2. **CI/CD:** Run as part of test suite
3. **Pre-deployment:** Run in staging environment

**Error output format:**
```
❌ Foreign keys without explicit cascade rules:
  - product_offers.product_id → products (rule: NO ACTION)
  - forum_posts.author_id → users (rule: NULL)

All foreign keys must have explicit CASCADE, SET NULL, or RESTRICT rules.
See docs/02_DATABASE_PATTERNS.md for Foreign Key Cascade Strategy.
```

## Resources

- **Migration 0011:** `migrations/0011_add_cascade_rules.sql` (51 FKs updated)
- **Pattern doc:** `docs/02_DATABASE_PATTERNS.md` - Foreign Key Cascade Strategy
- **Validation script:** `scripts/validate-schema-migrations.ts` (similar pattern)
- **Data Integrity Review:** 2025-12-26 findings

## Acceptance Criteria

- [ ] `scripts/validate-fk-cascades.ts` created and executable
- [ ] Script queries PostgreSQL information_schema for FKs
- [ ] Script fails (exit 1) if any FK lacks explicit cascade rule
- [ ] Script succeeds (exit 0) if all FKs have CASCADE/SET NULL/RESTRICT
- [ ] `package.json` includes `validate:fk-cascades` script
- [ ] Error messages reference `docs/02_DATABASE_PATTERNS.md`
- [ ] Script runs in CI/CD pipeline (if applicable)
- [ ] Documentation updated with validation requirement
- [ ] Runs successfully against current database (all FKs pass)

## Work Log

### 2025-12-26 - Initial Discovery

**By:** Data Integrity Guardian Agent (Code Review)

**Actions:**
- Reviewed migration 0011 (comprehensive cascade rules)
- Identified lack of automated verification
- Documented SQL query for FK cascade validation
- Proposed npm script integration
- Compared to existing `validate:schema` pattern

**Learnings:**
- Migration 0011 excellent (51 FKs properly cascaded)
- No automated enforcement for future migrations
- Simple SQL query can validate (information_schema)
- Pattern exists in validate-schema-migrations.ts
- Low effort, high preventive value

## Notes

- **Priority P3 (Nice-to-have)** - Preventive measure, not urgent
- **Enforcement:** Consider adding to pre-commit after validation script stable
- **Documentation:** Error message should point to pattern docs
- **Pattern:** Similar to existing `validate:schema` and `validate:migrations`
- **Future:** Could extend to validate cascade rules match documented strategy
  - CASCADE for dependent children (offers → products)
  - SET NULL for preserved content (posts → users)
  - RESTRICT for explicit deletion prevention
