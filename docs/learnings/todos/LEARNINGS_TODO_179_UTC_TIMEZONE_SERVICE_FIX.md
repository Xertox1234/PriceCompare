# Learnings: UTC Timezone Fix in Price Aggregation Service (TODO 179)

**Date**: 2025-12-09
**Issue**: Testing infrastructure cleanup - code review identified timezone inconsistency
**Context**: Price aggregation service used local timezone methods while tests expected UTC behavior
**Resolution**: Converted all date operations in service AND tests to use UTC consistently

---

## Problem

### Symptom

Tests passed on some machines but failed on others with timezone differences:

```bash
# Test expecting 3 daily aggregates, but receiving 2
AssertionError: expected 2 to be 3

# Or: Date assertions failing due to day boundary shifts
expected 'YYYY-MM-DD' to equal different date
```

### Root Cause

The `getDayDateRange()` method and other date calculations in `price-aggregation-service.ts` used **local timezone** constructors and methods:

```typescript
// BEFORE - Local timezone (DANGEROUS)
const startDate = new Date(year, month - 1, day);
startDate.setHours(0, 0, 0, 0);
```

When a test runs in PST (UTC-8) and creates "yesterday at noon local time", the actual UTC value differs from what a UTC-based service calculation expects. This causes:

1. Date boundary mismatches - A local "yesterday" might span two UTC days
2. Aggregate counts differing from expectations
3. Tests that pass in one timezone but fail in another

### Example Failure Scenario

```
Current time: Dec 9, 3:33 PM PST (Dec 9, 11:33 PM UTC)

Test creates "yesterday" using local methods:
  - Local: Dec 8, 12:00:00 PST
  - UTC:   Dec 8, 20:00:00 UTC

Service calculates "yesterday" range using local methods:
  - Local start: Dec 8, 00:00:00 PST = Dec 8, 08:00:00 UTC
  - Local end:   Dec 8, 23:59:59 PST = Dec 9, 07:59:59 UTC

Result: Test data at 20:00 UTC falls INSIDE local range
        but if service was UTC-based, ranges would differ
```

The inconsistency becomes visible when:
- Developer machine is in PST, CI server is in UTC
- Multiple test data points span UTC day boundaries differently than local

---

## Solution: UTC-First Date Handling

### Principle

**ALL server-side date calculations MUST use UTC methods exclusively.** This ensures:
- Consistent behavior across all server timezones
- Tests pass identically in all environments
- No hidden timezone-dependent bugs

### Service Changes (price-aggregation-service.ts)

#### 1. getDayDateRange() - Core Date Range Method

```typescript
// BEFORE - Local timezone (WRONG)
private getDayDateRange(year: number, month: number, day: number) {
  const startDate = new Date(year, month - 1, day);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(year, month - 1, day);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

// AFTER - UTC (CORRECT)
private getDayDateRange(year: number, month: number, day: number) {
  // Use UTC to ensure consistent behavior across all server timezones
  // This prevents tests from passing on one machine but failing on another
  const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return { startDate, endDate };
}
```

#### 2. Date Extraction in Loops

```typescript
// BEFORE - Local timezone methods (WRONG)
const year = currentDate.getFullYear();
const month = currentDate.getMonth() + 1;
const day = currentDate.getDate();

// AFTER - UTC methods (CORRECT)
const year = currentDate.getUTCFullYear();
const month = currentDate.getUTCMonth() + 1;
const day = currentDate.getUTCDate();
```

#### 3. Date Arithmetic (Incrementing/Decrementing Days)

```typescript
// BEFORE - Local timezone arithmetic (WRONG)
yesterday.setDate(yesterday.getDate() - 1);
currentDate.setDate(currentDate.getDate() + 1);

// AFTER - UTC arithmetic (CORRECT)
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
currentDate.setUTCDate(currentDate.getUTCDate() + 1);
```

#### 4. Previous Day Calculations

```typescript
// BEFORE - Local timezone (WRONG)
previousDay.setDate(previousDay.getDate() - 1);
const prevDateStr = `${previousDay.getFullYear()}-${...}`;

// AFTER - UTC (CORRECT)
previousDay.setUTCDate(previousDay.getUTCDate() - 1);
const prevDateStr = `${previousDay.getUTCFullYear()}-${String(previousDay.getUTCMonth() + 1).padStart(2, '0')}-${String(previousDay.getUTCDate()).padStart(2, '0')}`;
```

### Test Changes (price-aggregation-service.integration.test.ts)

Tests MUST match the service's timezone handling:

```typescript
// BEFORE - Local timezone in tests (WRONG - mismatches UTC service)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(12, 0, 0, 0);

// AFTER - UTC in tests (CORRECT - matches UTC service)
const yesterday = new Date();
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
yesterday.setUTCHours(12, 0, 0, 0);
```

---

## Complete Method Reference

### Methods Updated in price-aggregation-service.ts

| Method | Lines Changed | Changes Made |
|--------|---------------|--------------|
| `getDayDateRange()` | 1469-1474 | `Date.UTC()` constructor |
| `calculateDailyAggregates()` | 545-552, 574-581 | UTC getters and setters |
| `aggregateToDaily()` | 732-737, 781-785, 893-894 | UTC date extraction and arithmetic |
| `detectGaps()` | 933-938, 961-962 | UTC date extraction and arithmetic |

### Local vs UTC Method Mapping

| Local Method | UTC Method | Use Case |
|--------------|------------|----------|
| `new Date(year, month, day)` | `new Date(Date.UTC(year, month, day))` | Date creation |
| `getFullYear()` | `getUTCFullYear()` | Year extraction |
| `getMonth()` | `getUTCMonth()` | Month extraction (0-indexed) |
| `getDate()` | `getUTCDate()` | Day extraction |
| `setDate()` | `setUTCDate()` | Day arithmetic |
| `setHours()` | `setUTCHours()` | Time setting |
| `getHours()` | `getUTCHours()` | Hour extraction |

---

## Debugging Timeline

The fix required multiple iterations due to interconnected date operations:

1. **Initial fix**: Updated `getDayDateRange()` to use `Date.UTC()`
   - Result: Tests still failing (expected 3, got 2)

2. **Second fix**: Updated date extraction in `aggregateToDaily()` loop
   - Result: New error - `date.toISOString() is not a function`

3. **Third fix**: Fixed assertion - `date` field is string "YYYY-MM-DD", not Date object
   - Result: Previous day calculation still using local methods

4. **Fourth fix**: Updated `previousDay` calculations to use UTC
   - Result: Loop increment still local

5. **Fifth fix**: Updated loop increment `currentDate.setUTCDate()`
   - Result: `detectGaps()` still using local methods

6. **Sixth fix**: Updated all date operations in `detectGaps()`
   - Result: `calculateDailyAggregates()` test failing

7. **Final fix**: Updated test setup to use `setUTCDate()` and `setUTCHours()`
   - Result: All 20 tests passing

**Key Lesson**: Date operations are interconnected. When fixing timezone issues, ALL related date operations in the call chain must be updated consistently.

---

## Pattern: UTC-First Date Handling

### When to Use UTC

**ALWAYS use UTC for:**
- Server-side date calculations
- Date range queries (start/end of day)
- Date arithmetic (adding/subtracting days)
- Storing dates in database (recordedAt, createdAt)
- Date comparisons and grouping

**Exception - Use local timezone for:**
- User-facing display (convert from UTC to user's timezone)
- Parsing user input (then immediately convert to UTC)

### Implementation Checklist

When implementing date-based features:

- [ ] Use `Date.UTC()` for date construction
- [ ] Use `getUTC*()` methods for date extraction
- [ ] Use `setUTC*()` methods for date arithmetic
- [ ] Match timezone handling between service and tests
- [ ] Add comments explaining UTC usage
- [ ] Test in at least two different timezones

### Code Review Checklist

When reviewing date-related code:

- [ ] No `new Date(year, month, day)` without `Date.UTC()`
- [ ] No `getFullYear()`, `getMonth()`, `getDate()` in server code
- [ ] No `setDate()`, `setHours()` in server code
- [ ] Tests use matching UTC methods
- [ ] Comments explain timezone handling

---

## Automated Detection (Pre-Commit Hook)

**NEW (2025-12-09):** The pre-commit hook now includes Pattern 7 to detect timezone issues automatically.

### What It Catches

The hook scans **server code only** (not client or tests) for:

1. **Local Date Constructor**: `new Date(year, month, day)` without `Date.UTC()`
2. **Local Getters**: `.getFullYear()`, `.getMonth()`, `.getDate()` without UTC prefix
3. **Local Setters**: `.setDate()`, `.setHours()`, `.setMinutes()` without UTC prefix

### Example Output

```bash
⚠ Pattern 7: Local timezone date methods in server code (3 instances)
  RISK: Tests pass in one timezone but fail in another (e.g., PST vs UTC)
  QUICK FIX: Use UTC date methods for server-side date handling
  EXAMPLES:
    ❌ new Date(2024, 0, 1)  // Uses local timezone
    ✅ new Date(Date.UTC(2024, 0, 1, 0, 0, 0))  // Explicit UTC
    ❌ date.getFullYear(), date.getMonth(), date.getDate()
    ✅ date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()
    ❌ date.setDate(date.getDate() + 1)
    ✅ date.setUTCDate(date.getUTCDate() + 1)
  BYPASS: Add '// UTC:' comment if local timezone is intentional
  DOCS: See docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md
```

### Bypass for Intentional Local Timezone

If you intentionally need local timezone (e.g., user-facing display), add a comment:

```typescript
// UTC: Intentional local timezone for user display
const displayDate = new Date(year, month, day);
```

The `// UTC:` comment tells the hook to skip the line.

---

## Anti-Patterns to Avoid

### 1. Mixed Timezone Operations

```typescript
// WRONG - Mixing local and UTC
const date = new Date();
date.setUTCDate(date.getDate() - 1);  // getDate() is local!

// CORRECT - Consistent UTC
const date = new Date();
date.setUTCDate(date.getUTCDate() - 1);
```

### 2. Local Constructor with UTC Methods

```typescript
// WRONG - Local constructor, UTC extraction
const startDate = new Date(year, month - 1, day);  // Local!
const year = startDate.getUTCFullYear();  // Extracts wrong value

// CORRECT - UTC constructor and extraction
const startDate = new Date(Date.UTC(year, month - 1, day));
const year = startDate.getUTCFullYear();
```

### 3. Assuming Test Environment Timezone

```typescript
// WRONG - Assumes tests run in UTC
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);  // Works in UTC, fails in PST

// CORRECT - Explicit UTC handling
const yesterday = new Date();
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
```

---

## Files Modified

### Service File
**`/server/services/price-aggregation-service.ts`**

7 methods updated with ~20 line changes:
- `getDayDateRange()` - lines 1469-1474
- `calculateDailyAggregates()` - lines 545-552, 574-581
- `aggregateToDaily()` - lines 732-737, 781-785, 893-894
- `detectGaps()` - lines 933-938, 961-962

### Test File
**`/server/services/__tests__/price-aggregation-service.integration.test.ts`**

11 test setup blocks updated:
- Lines 106-107, 165-166, 220-221, 243-244, 270-271
- Lines 306-307, 561-562, 599-600, 625-626, 672-673
- Lines 721-722, 751-752, 821-841

---

## Test Results

**Before Fix**: 19/20 tests passing (1 timezone-dependent failure)
**After Fix**: 20/20 tests passing in all timezones

```bash
 PASS  server/services/__tests__/price-aggregation-service.integration.test.ts (20 tests)
   PriceAggregationService (Integration)
     calculateDailyAggregates
       ✓ should create daily aggregates for previous day price data
       ✓ should calculate correct min/max/avg prices
       ✓ should handle multiple products
       ✓ should handle multiple retailers for same product
       ✓ should update existing aggregates with correct values
       ✓ should handle price changes on same day
     aggregateToDaily
       ✓ should aggregate price history to daily aggregates
       ✓ should handle multiple days of data
       ✓ should skip days without price data
       ✓ should handle gaps in price history
       ✓ should calculate accurate statistics for varying prices
       ✓ should update existing aggregates on re-aggregation
     detectGaps
       ✓ should detect missing days in price history
       ✓ should return empty array when no gaps exist
       ✓ should handle single day of data
     performance
       ✓ should complete aggregation within performance budget

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
```

---

## Related Documentation

- **[LEARNINGS_TODO_176_TIMEZONE_DATE_TESTS.md](./LEARNINGS_TODO_176_TIMEZONE_DATE_TESTS.md)** - Frontend/test date handling
- **[08_TESTING_PATTERNS.md](./08_TESTING_PATTERNS.md)** - Testing patterns (Section: Date and Time Testing)
- **[02_DATABASE_PATTERNS.md](./02_DATABASE_PATTERNS.md)** - Database date handling

---

## Key Takeaways

1. **UTC-first is mandatory for services** - All server-side date operations must use UTC
2. **Tests must match service timezone** - If service uses UTC, tests must create dates with UTC
3. **Date operations are interconnected** - Fix ALL related operations, not just one method
4. **Add comments explaining timezone** - Future developers need to understand the pattern
5. **Code review catches these issues** - The code-review-specialist identified this before production

---

**Maintained By**: Development Team
**Next Review**: 2025-12-23
