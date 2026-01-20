# TODO 248: Address Pre-commit Hook Warnings

**Priority**: P3
**File(s)**: Multiple test files, `server/storage/domains/retailer-storage.ts`
**Estimated Time**: 2-3 hours
**Status**: Not Started

## Problem Statement

The pre-commit hook reports several recurring warnings that should be addressed to improve code quality:

1. **WARNING 13**: Hardcoded bcrypt rounds in test files
2. **WARNING 14**: Type assertions without documentation
3. **WARNING 18**: Test cleanup using `db.delete()` instead of `TRUNCATE CASCADE`

These warnings don't block commits but indicate technical debt that should be addressed.

## Root Cause

- **Bcrypt rounds**: Test files use hardcoded values (e.g., `bcrypt.hash(password, 4)`) instead of centralized constants
- **Type assertions**: JSON field parsing uses `as Record<string, unknown>` without documenting why the cast is safe
- **Test cleanup**: Many tests use row-by-row `db.delete()` which is slower and less reliable than `TRUNCATE CASCADE`

## Solution Approach

1. Centralize bcrypt rounds in `server/utils/constants.ts`
2. Add documentation comments to type assertions explaining safety
3. Migrate test cleanup from `db.delete()` to `TRUNCATE CASCADE` where appropriate

## Implementation Steps

### Step 1: Centralize Bcrypt Rounds

- [ ] Add `PASSWORD.BCRYPT_ROUNDS` constant if not exists
- [ ] Update test files to use centralized constant
- [ ] Files to check:
  - `server/test/basic-auth.test.ts:450`

### Step 2: Document Type Assertions

- [ ] Add safety comments to type assertions in `retailer-storage.ts`
- [ ] Pattern to use:
  ```typescript
  // SAFETY: affiliateConfig is stored as JSON and validated at write time
  ? (JSON.parse(row.affiliateConfig) as Record<string, unknown>)
  ```

### Step 3: Migrate Test Cleanup

- [ ] Review each `db.delete()` usage for migration suitability
- [ ] Keep `db.delete()` only where testing specific delete functionality
- [ ] Add `// NOTE:` comments to intentional `db.delete()` usage
- [ ] Files flagged:
  - `server/test/basic-auth.test.ts`
  - Various integration test files

## Technical Details

### Bcrypt Constant Pattern
```typescript
// server/utils/constants.ts
export const PASSWORD = {
  BCRYPT_ROUNDS: 12, // Production security
  BCRYPT_ROUNDS_TEST: 4, // Fast tests (intentionally weak)
} as const;

// In tests:
import { PASSWORD } from '../utils/constants';
const hash = await bcrypt.hash(password, PASSWORD.BCRYPT_ROUNDS_TEST);
```

### Type Assertion Documentation Pattern
```typescript
// SAFETY: JSON field validated by Zod schema at insert time
const config = JSON.parse(row.affiliateConfig) as AffiliateConfig;

// SAFETY: Drizzle returns unknown for JSONB, structure guaranteed by migration
const data = result as ProductData;
```

### Test Cleanup Pattern
```typescript
// PREFERRED: Fast, complete cleanup
afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
});

// ACCEPTABLE: When testing delete functionality specifically
// NOTE: db.delete() is intentional here - testing user deletion behavior
await db.delete(users).where(eq(users.id, testUser.id));
```

## Checklist

- [ ] Implementation complete
- [ ] Pre-commit warnings reduced/eliminated
- [ ] No test regressions
- [ ] Documentation updated

## Success Criteria

- [ ] `npm run lint` passes with no new warnings
- [ ] Pre-commit hook shows fewer warnings
- [ ] All tests pass
- [ ] Type safety maintained

## YAGNI Considerations

- Only fix warnings in actively maintained code paths
- Don't over-engineer - simple comments are sufficient for type assertions
- Keep intentional `db.delete()` where it serves a purpose (document with `// NOTE:`)

---

**Created**: 2026-01-19
**Created by**: Claude Code
**Related**: TODO 247 (pagination implementation triggered this review)
