# Storage Layer Validation Helper Pattern

**Quick Reference Guide for Developers**

This document provides a quick reference for implementing validation helpers in the storage layer, based on the pattern established in Phase 1.

---

## TL;DR

1. Add constants to `server/utils/constants.ts`
2. Add private validators to `DatabaseStorage` class
3. Call validators at the start of public methods
4. Write integration tests

---

## Step-by-Step Pattern

### Step 1: Add Domain Constants

**Location**: `server/utils/constants.ts`

```typescript
/**
 * [Domain] domain constants
 * Used by DatabaseStorage [domain]-related methods for validation and defaults
 */
export const DOMAIN_CONSTANTS = {
  VALIDATION: {
    MIN_ID: 1,
    MAX_NAME_LENGTH: 255,
    // ... other validation rules
  },
  DEFAULTS: {
    DEFAULT_LIMIT: 20,
    DEFAULT_DAYS: 30,
    // ... other defaults
  },
} as const;
```

**Key Points**:
- Use `as const` for immutability
- Group related constants logically
- Add JSDoc explaining purpose
- Follow existing naming patterns

### Step 2: Import Constants in Storage

**Location**: `server/storage.ts` (top of file)

```typescript
import {
  USER_CONSTANTS,
  PRODUCT_CONSTANTS,
  YOUR_DOMAIN_CONSTANTS  // Add your new constant
} from "./utils/constants";
```

### Step 3: Add Private Validation Helpers

**Location**: `server/storage.ts` (in DatabaseStorage class)

```typescript
// ============================================================================
// Private [Domain] Validation Helpers
// ============================================================================

/**
 * Validate [field] is [constraint]
 * Used by: method1, method2, method3
 * @private
 */
private validateDomainId(id: number): void {
  if (!id || id < DOMAIN_CONSTANTS.VALIDATION.MIN_ID || !Number.isInteger(id)) {
    throw new Error(`Invalid domainId: ${id}. Must be a positive integer.`);
  }
}

/**
 * Validate [field] is within range
 * @private
 */
private validateDomainRange(value: number, min: number, max: number): void {
  if (value < min || value > max) {
    throw new Error(`Value must be between ${min} and ${max}. Got: ${value}`);
  }
}

/**
 * Validate and normalize [field] with defaults
 * @private
 */
private validateDomainLimit(limit: number | undefined): number {
  const actualLimit = limit ?? DOMAIN_CONSTANTS.DEFAULTS.DEFAULT_LIMIT;
  if (actualLimit < 1 || actualLimit > DOMAIN_CONSTANTS.DEFAULTS.MAX_LIMIT) {
    throw new Error(
      `Limit must be between 1 and ${DOMAIN_CONSTANTS.DEFAULTS.MAX_LIMIT}`
    );
  }
  return actualLimit;
}
```

**Key Points**:
- Use `private` keyword
- Add JSDoc with "Used by" comments
- Include `Number.isInteger()` for ID validation
- Provide context-rich error messages
- Return normalized values when appropriate

### Step 4: Refactor Public Methods

**Location**: `server/storage.ts` (in DatabaseStorage class)

```typescript
// ============================================================================
// [Domain] Methods
// ============================================================================

async domainMethod(id: number, options?: DomainOptions): Promise<Result> {
  // 1. Validate ALL inputs first (before any database operations)
  this.validateDomainId(id);
  if (options?.userId) {
    this.validateUserId(options.userId);
  }

  // 2. Then proceed with business logic
  const result = await db.select()
    .from(domainTable)
    .where(eq(domainTable.id, id))
    .limit(1);

  return result[0] || null;
}
```

**Key Points**:
- Call validators FIRST, before database operations
- Validate ALL inputs (IDs, limits, ranges, etc.)
- Let validation errors propagate (don't catch)
- Keep validation separate from business logic

### Step 5: Write Integration Tests

**Location**: `server/__tests__/validation-helpers.test.ts`

```typescript
describe('[Domain] Validation Helpers', () => {
  let storage: DatabaseStorage;

  beforeAll(() => {
    storage = new DatabaseStorage();
  });

  describe('validateDomainId', () => {
    it('should reject non-positive IDs', async () => {
      await expect(
        storage.domainMethod(0)
      ).rejects.toThrow('Invalid domainId: 0. Must be a positive integer.');

      await expect(
        storage.domainMethod(-5)
      ).rejects.toThrow('Invalid domainId: -5. Must be a positive integer.');
    });

    it('should reject decimal IDs', async () => {
      await expect(
        storage.domainMethod(3.5)
      ).rejects.toThrow('Invalid domainId: 3.5. Must be a positive integer.');
    });

    it('should reject NaN IDs', async () => {
      await expect(
        storage.domainMethod(NaN)
      ).rejects.toThrow(/Invalid domainId.*Must be a positive integer/);
    });

    it('should accept valid positive integers', async () => {
      // This will return null/undefined if not found, but validation passes
      const result = await storage.domainMethod(99999);
      expect(result).toBeNull(); // or .toBeUndefined()
    });
  });
});
```

**Key Points**:
- Test edge cases: 0, negatives, decimals, NaN
- Test range boundaries
- Test length limits
- Verify error messages include context
- Aim for 100% coverage of validators

---

## Common Validation Patterns

### ID Validation (Most Common)

```typescript
private validateEntityId(id: number): void {
  if (!id || id < 1 || !Number.isInteger(id)) {
    throw new Error(`Invalid entityId: ${id}. Must be a positive integer.`);
  }
}
```

**Use for**: userId, productId, offerId, alertId, watchListId, etc.

### Range Validation

```typescript
private validateRange(value: number, min: number, max: number, fieldName: string): void {
  if (value < min || value > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}. Got: ${value}`);
  }
}
```

**Use for**: trustLevel, priority, status codes, percentages

### String Length Validation

```typescript
private validateStringLength(
  value: string | undefined,
  fieldName: string,
  maxLength: number
): void {
  if (value && value.length > maxLength) {
    throw new Error(`${fieldName} cannot exceed ${maxLength} characters. Got: ${value.length}`);
  }
}
```

**Use for**: bio, description, notes, titles

### Limit/Pagination Validation

```typescript
private validateLimit(limit: number | undefined): number {
  const actualLimit = limit ?? DEFAULT_LIMIT;
  if (actualLimit < 1 || actualLimit > MAX_LIMIT) {
    throw new Error(`Limit must be between 1 and ${MAX_LIMIT}. Got: ${actualLimit}`);
  }
  return actualLimit;
}
```

**Use for**: Search limits, pagination, batch sizes

### Days/Duration Validation

```typescript
private validateDays(days: number | undefined): number {
  const actualDays = days ?? DEFAULT_DAYS;
  if (actualDays < 1 || actualDays > MAX_DAYS) {
    throw new Error(`Days must be between 1 and ${MAX_DAYS}. Got: ${actualDays}`);
  }
  return actualDays;
}
```

**Use for**: Date ranges, retention periods, analytics windows

---

## Checklist

Before committing your validation helpers:

- [ ] Constants added to `server/utils/constants.ts` with JSDoc
- [ ] Constants imported in `server/storage.ts`
- [ ] Private validators added to `DatabaseStorage` class
- [ ] All validators have JSDoc comments
- [ ] "Used by" comments list methods using each validator
- [ ] Integer validation includes `Number.isInteger()` check
- [ ] Error messages include context (invalid value, constraints)
- [ ] Public methods call validators FIRST
- [ ] All inputs validated (IDs, limits, ranges, lengths)
- [ ] Integration tests written with 100% coverage
- [ ] Tests verify edge cases (0, negatives, decimals, NaN)
- [ ] Tests verify error messages
- [ ] All tests passing
- [ ] TypeScript type checking passes
- [ ] No new lint errors

---

## Examples from Phase 1

### User Domain

**Constants**: Trust level (0-4), profile fields (500 char max), growth days (30 default, 365 max)

**Validators**: `validateUserId()`, `validateTrustLevel()`, `validateProfileField()`, `validateDays()`

**Methods**: 5 methods refactored

**Tests**: 10 tests covering all edge cases

### Product Domain

**Constants**: ID validation (min 1), search limits (20-100), fuzzy threshold (0.0-1.0)

**Validators**: `validateProductId()`, `validateOfferId()`, `validateRetailerId()`, `validateSearchLimit()`, `validateProductDays()`, `validateFuzzyThreshold()`

**Methods**: 2 methods refactored (pattern established)

**Tests**: 4 tests covering edge cases

---

## Anti-Patterns to Avoid

❌ **Don't validate after database operations**
```typescript
// WRONG
async method(id: number) {
  const result = await db.select().from(table).where(eq(table.id, id));
  if (id < 1) throw new Error('Invalid ID'); // Too late!
  return result;
}
```

✅ **Do validate before database operations**
```typescript
// CORRECT
async method(id: number) {
  this.validateId(id); // First!
  const result = await db.select().from(table).where(eq(table.id, id));
  return result;
}
```

❌ **Don't use magic numbers in validators**
```typescript
// WRONG
if (trustLevel < 0 || trustLevel > 4) { ... }
```

✅ **Do use constants**
```typescript
// CORRECT
if (trustLevel < USER_CONSTANTS.TRUST_LEVEL.MIN ||
    trustLevel > USER_CONSTANTS.TRUST_LEVEL.MAX) { ... }
```

❌ **Don't make validators public**
```typescript
// WRONG
public validateUserId(userId: number): void { ... }
```

✅ **Do make validators private**
```typescript
// CORRECT
private validateUserId(userId: number): void { ... }
```

❌ **Don't write vague error messages**
```typescript
// WRONG
throw new Error('Invalid input');
```

✅ **Do write context-rich messages**
```typescript
// CORRECT
throw new Error(`Invalid userId: ${userId}. Must be a positive integer.`);
```

---

## Resources

- **Phase 1 Completion Report**: `docs/storage-layer/PHASE1_COMPLETION_REPORT.md`
- **Pattern Files**:
  - `docs/DATABASE_PATTERNS.md` - Input validation section
  - `docs/SECURITY_PATTERNS.md` - Safe integer parsing
  - `docs/TYPESCRIPT_PATTERNS.md` - Type safety patterns
- **Example Implementation**: PR #123
- **Test Examples**: `server/__tests__/validation-helpers.test.ts`

---

## Questions?

Check the Phase 1 Completion Report for:
- Detailed implementation examples
- Lessons learned
- Migration guide
- Git history

Or reference existing validators in the `DatabaseStorage` class for patterns.

---

**Last Updated**: 2025-11-25
**Pattern Version**: 1.0 (Phase 1)
**Status**: ✅ Production-Ready
