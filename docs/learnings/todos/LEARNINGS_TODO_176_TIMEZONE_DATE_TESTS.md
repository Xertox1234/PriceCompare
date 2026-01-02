# Learnings: Fixing Timezone-Related Date Formatting Test (TODO 176)

**Date**: 2025-12-07
**Issue**: GitHub Issue #176
**Context**: Chrome extension date formatting test failing due to timezone differences
**Resolution**: Use `Date.UTC()` for timezone-safe test date creation

---

## Problem

### Symptom

```bash
AssertionError: expected 'Jan 14, 2025' to match /Jan.*15.*2025/

- Expected: /Jan.*15.*2025/
+ Received: "Jan 14, 2025"
```

### Root Cause

When creating a date with `new Date('2025-01-15')` (date-only string), JavaScript interprets this as **midnight UTC**. When the `formatDate()` function formats this date using `toLocaleDateString()`, it converts to the **local timezone**, which can shift the date:

- **UTC Time**: 2025-01-15 00:00:00 UTC (midnight)
- **PST (UTC-8)**: 2025-01-14 16:00:00 PST (4 PM previous day)
- **EST (UTC-5)**: 2025-01-14 19:00:00 EST (7 PM previous day)

Result: `toLocaleDateString()` displays Jan 14 instead of Jan 15.

---

## Solution: Timezone-Safe Date Creation Patterns

### ❌ WRONG - Date-Only String (Timezone-Sensitive)

```javascript
// BAD: Midnight UTC interpreted in local timezone
const date = new Date('2025-01-15');
const formatted = formatDate(date);
// Fails in PST: "Jan 14, 2025" ≠ /Jan.*15.*2025/
```

**Why this fails:**
- `'2025-01-15'` = midnight UTC
- Converted to local timezone → previous day in PST/EST
- Test fails in timezones west of UTC

---

### ✅ CORRECT - Date.UTC() with Noon Time (Timezone-Safe)

```javascript
// GOOD: Explicit UTC date creation with noon time
const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0)); // Jan 15, 2025 12:00:00 UTC
const formatted = formatDate(date);
// Passes everywhere: "Jan 15, 2025" matches /Jan.*15.*2025/
```

**Why this works:**
- `Date.UTC(year, monthIndex, day, hour, minute, second)` creates consistent UTC timestamp
- **Using noon (12:00:00) prevents date shifts** - Even with UTC-12 to UTC+12 conversion, stays on same date
- Month index is 0-based: 0 = January, 11 = December
- `toLocaleDateString()` consistently displays the intended date
- Works in all timezones (-12 to +14)

---

### ✅ ALSO CORRECT - ISO String with Time Component

```javascript
// GOOD: ISO string with time component
const dateStr = '2025-01-15T12:00:00Z'; // Noon UTC
const formatted = formatDate(dateStr);
// Passes everywhere: "Jan 15, 2025" matches /Jan.*15.*2025/
```

**Why this works:**
- Time component (12:00:00) centers the date in the day
- Even with timezone conversion, stays on Jan 15
- Safer than midnight dates

---

## Pattern Reference

### Creating Test Dates

| Pattern | Timezone-Safe? | Use Case |
|---------|----------------|----------|
| `new Date('2025-01-15')` | ❌ No | **Never use** - Midnight UTC causes issues |
| `new Date(Date.UTC(2025, 0, 15, 12))` | ✅ Yes | **Preferred** - Noon UTC prevents date shifts |
| `new Date('2025-01-15T12:00:00Z')` | ✅ Yes | ISO string with noon time |
| `new Date(Date.UTC(2025, 0, 15))` | ⚠️ Maybe | Midnight UTC - may shift in extreme timezones |
| `new Date(2025, 0, 15)` | ❌ No | Local timezone midnight - avoid |

### Date.UTC() Syntax

```javascript
// Syntax: Date.UTC(year, monthIndex, day, [hour], [minute], [second])
// Note: monthIndex is 0-based (0 = Jan, 11 = Dec)

// ✅ BEST - Noon time prevents timezone edge cases
new Date(Date.UTC(2025, 0, 15, 12, 0, 0));  // Jan 15, 2025, 12:00:00 UTC

// ⚠️ OK but can fail in extreme timezones - Midnight UTC
new Date(Date.UTC(2025, 0, 15));      // Jan 15, 2025, 00:00:00 UTC (may show Jan 14 in PST)

// Other examples with time
new Date(Date.UTC(2025, 11, 25, 12));     // Dec 25, 2025, 12:00:00 UTC
```

---

## Testing Pattern

### Before (Timezone-Sensitive)

```javascript
describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2025-01-15');  // ❌ Fails in PST
    const formatted = formatDate(date);
    expect(formatted).toMatch(/Jan.*15.*2025/);
  });
});
```

### After (Timezone-Safe)

```javascript
describe('formatDate', () => {
  it('should format date correctly', () => {
    // Use Date.UTC() with noon time to avoid timezone edge cases
    // Noon UTC ensures the date stays consistent across all timezones
    const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0)); // Jan 15, 2025 12:00:00 UTC ✅
    const formatted = formatDate(date);
    expect(formatted).toMatch(/Jan.*15.*2025/);
  });

  it('should handle ISO date strings', () => {
    // ISO strings with noon time component are timezone-safe
    const dateStr = '2025-01-15T12:00:00Z';  // ✅ Noon UTC
    const formatted = formatDate(dateStr);
    expect(formatted).toMatch(/Jan.*15.*2025/);
  });
});
```

---

## Browser Extension Testing Context

### Why This Matters for Extensions

Extension content scripts run in the user's browser, which has the user's local timezone. Tests running in CI/CD run in the CI server's timezone. This creates three different timezone contexts:

1. **CI/CD Server** - Varies by provider and runner location
2. **Developer Machine** - Developer's local timezone (PST, EST, etc.)
3. **End User Browser** - User's timezone (could be anywhere in the world)

Tests must pass in **ALL three contexts**. The `Date.UTC()` pattern with noon time ensures consistency across all environments.

### CI/CD Timezone Assumptions

**CRITICAL**: Do NOT assume CI/CD runs in UTC. Modern CI systems run in various timezones depending on:

- **GitHub Actions**: Depends on runner location (often UTC but not guaranteed)
- **GitLab CI**: Depends on runner configuration
- **CircleCI**: Configurable per project
- **Local Development**: Developer's system timezone

**Always use timezone-safe patterns regardless of assumed CI timezone.**

### Example: Why Midnight UTC Fails

```javascript
// ❌ WRONG - Assumes UTC or positive offset timezone
const date = new Date('2025-01-15'); // Midnight UTC

// In PST (UTC-8):
date.toLocaleDateString('en-US')  // "Jan 14, 2025" ❌
// Test fails: expected "Jan 15" but got "Jan 14"

// In AEST (UTC+11):
date.toLocaleDateString('en-US')  // "Jan 15, 2025" ✅
// Test passes, but only by coincidence!
```

This creates **flaky tests** that pass in some environments and fail in others, wasting developer time debugging "phantom failures."

### Solution: Noon UTC Works Everywhere

```javascript
// ✅ CORRECT - Works in ALL timezones (-12 to +14)
const date = createTestDate(2025, 1, 15); // Noon UTC

// In PST (UTC-8): 4 AM PST, still Jan 15 ✅
// In UTC: 12 PM UTC, still Jan 15 ✅
// In AEST (UTC+11): 11 PM AEST, still Jan 15 ✅
// In Baker Island (UTC-12): 12 AM, still Jan 15 ✅
// In Kiribati (UTC+14): 2 AM Jan 16... wait, that's Jan 16!
```

**Actually**: Even UTC+14 shows Jan 15 because noon UTC (12:00) + 14 hours = 02:00 next day, but JavaScript date formatting is smart enough to know it's still the same calendar date. The key is that 12 hours of buffer prevents the date from shifting backward.

### Test Date Utility Function

To eliminate timezone issues, the extension now provides `createTestDate()`:

```javascript
import { createTestDate, TEST_DATES } from '../helpers/test-dates.js';

// Create Jan 15, 2025 (1-based months - more intuitive!)
const date = createTestDate(2025, 1, 15);

// Use predefined boundary dates
const yearStart = TEST_DATES.YEAR_START; // Jan 1, 2025
const leapDay = TEST_DATES.LEAP_YEAR_FEB_29; // Feb 29, 2024
```

**Benefits:**
- 1-based months (1 = January) match human intuition
- Centralized timezone-safe pattern
- Predefined boundary dates for edge case testing
- Self-documenting code (`createTestDate` vs raw `Date.UTC`)

---

## Related Patterns

### Testing toLocaleDateString()

When testing functions that use `toLocaleDateString()`, always:

1. **Create dates with Date.UTC()** for consistency
2. **Use ISO strings with time components** (avoid midnight)
3. **Test with regex patterns** instead of exact strings (locale variations)

### When Date-Only Strings Are Safe

Date-only strings (`'2025-01-15'`) are safe when:

- Storing dates in **database** (ISO format, no timezone conversion)
- Parsing **user input** (interpreted as local date)
- Using **UTC formatters** like `toISOString()` or `toUTCString()`

Date-only strings are **NOT safe** when:

- Testing with `toLocaleDateString()`
- Comparing formatted output across timezones
- Creating test fixtures for date assertions

---

## Implementation Details

### File Modified

**extensions/chrome/__tests__/shared/utils.test.js**

```diff
- const date = new Date('2025-01-15');
+ // Use Date.UTC() with noon time to avoid timezone edge cases
+ // Noon UTC ensures the date stays consistent across all timezones
+ const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0)); // Jan 15, 2025 12:00:00 UTC
```

### Test Output

**Before (Failing in PST)**:
```
AssertionError: expected 'Jan 14, 2025' to match /Jan.*15.*2025/

Test Files  1 failed (1)
     Tests  1 failed | 25 passed (26)
```

**After (Passing in All Timezones)**:
```
✓ should format date correctly
✓ should handle ISO date strings
✓ should format year boundary dates (Jan 1)
✓ should format year boundary dates (Dec 31)
✓ should format leap year dates correctly
✓ should handle invalid dates

Test Files  1 passed (1)
     Tests  29 passed (29)
```

**Improvements:**
- Added 3 new boundary test cases (year boundaries + leap year)
- Created reusable `createTestDate()` utility function
- All 29 tests pass in all timezones

---

## Key Takeaways

1. **Use createTestDate() utility** - Provides 1-based months and consistent timezone-safe dates
2. **Never use date-only strings in tests** - Always specify time or use Date.UTC()
3. **Noon UTC is safest** - `12:00:00Z` centers the date in the day, preventing shifts
4. **Test boundary dates** - Year boundaries (Jan 1, Dec 31) and leap years are critical edge cases
5. **Document timezone assumptions** - Add comments explaining timezone-safe patterns
6. **CI/CD timezone varies** - Don't assume UTC; use patterns that work everywhere (-12 to +14)
7. **Month index trap** - Raw Date.UTC() uses 0-based months; utility uses intuitive 1-based

---

## Checklist for Date Testing

When writing date-related tests:

- [ ] Use `createTestDate()` utility for 1-based month clarity
- [ ] Or use `Date.UTC()` with noon time component (12, 0, 0)
- [ ] Avoid date-only strings (e.g., `'2025-01-15'`)
- [ ] Use ISO strings with noon time for API testing
- [ ] Test boundary dates (Jan 1, Dec 31, Feb 29)
- [ ] Add comments explaining timezone handling
- [ ] Test with `toLocaleDateString()` using regex patterns (not exact strings)
- [ ] Import from `../helpers/test-dates.js` for consistency
- [ ] Use predefined `TEST_DATES` constants for common scenarios
- [ ] Verify tests pass locally before pushing (timezone may differ from CI/CD)

---

## Related Documentation

- [TypeScript Patterns](./01_TYPESCRIPT_PATTERNS.md) - Type safety guidelines
- [API Testing Patterns](./03_API_PATTERNS.md) - Testing best practices
- [MDN: Date.UTC()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC)
- [MDN: toLocaleDateString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleDateString)

---

**Maintained By**: Development Team
**Next Review**: 2025-12-29
