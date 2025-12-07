# Quick Reference: Timezone-Safe Date Testing

> **TL;DR**: Never use `new Date('2025-01-15')` in tests. Always use noon UTC to prevent timezone shifts.

---

## The Problem

```javascript
// ❌ FAILS IN PST - Midnight UTC becomes previous day
const date = new Date('2025-01-15'); // 00:00:00 UTC
date.toLocaleDateString('en-US'); // "Jan 14, 2025" in PST ❌
```

---

## Quick Solutions

### Chrome Extension Tests

```javascript
import { createTestDate, TEST_DATES } from '../helpers/test-dates.js';

// ✅ Best - 1-based months (intuitive)
const date = createTestDate(2025, 1, 15); // Jan 15, 2025

// ✅ Predefined boundaries
const jan1 = TEST_DATES.YEAR_START;
const dec31 = TEST_DATES.YEAR_END;
const leapDay = TEST_DATES.LEAP_YEAR_FEB_29;
```

### Server Tests

```javascript
// ✅ Good - Direct Date.UTC() with noon
const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0));

// ✅ Good - ISO string with time
const isoDate = '2025-01-15T12:00:00Z';
```

---

## Pattern Cheat Sheet

| Pattern | Safe? | When to Use |
|---------|-------|-------------|
| `createTestDate(2025, 1, 15)` | ✅ | Chrome extension tests |
| `Date.UTC(2025, 0, 15, 12, 0, 0)` | ✅ | Server tests, API tests |
| `'2025-01-15T12:00:00Z'` | ✅ | Query params, API payloads |
| `TEST_DATES.YEAR_START` | ✅ | Boundary testing (Jan 1) |
| `TEST_DATES.YEAR_END` | ✅ | Boundary testing (Dec 31) |
| `TEST_DATES.LEAP_YEAR_FEB_29` | ✅ | Leap year testing |
| `new Date('2025-01-15')` | ❌ | NEVER - Shifts in PST/EST |
| `new Date(2025, 0, 15)` | ❌ | NEVER - Local timezone |
| `Date.UTC(2025, 0, 15)` | ⚠️ | Risky - Midnight can shift |

---

## Why Noon UTC?

**12-hour buffer prevents date shifts across ALL timezones (-12 to +14):**

```
Noon UTC (12:00:00) converted to local time:
  UTC-12: 00:00 (midnight) → Still Jan 15 ✅
  PST (UTC-8): 04:00 AM → Still Jan 15 ✅
  UTC: 12:00 PM → Still Jan 15 ✅
  AEST (UTC+11): 11:00 PM → Still Jan 15 ✅
  UTC+14: 02:00 AM (next day clock) → Still Jan 15 ✅
```

---

## Common Mistakes

### ❌ Date-Only String
```javascript
const date = new Date('2025-01-15');
// Midnight UTC → Previous day in PST
```

### ❌ Local Timezone Constructor
```javascript
const date = new Date(2025, 0, 15);
// Midnight local time → Inconsistent across machines
```

### ❌ Assuming CI/CD is UTC
```javascript
// Test passes on GitHub Actions (UTC)
// Test FAILS on developer machine (PST)
```

---

## Boundary Dates (Critical!)

Always test these edge cases:

```javascript
// Year boundaries
const jan1 = createTestDate(2025, 1, 1);   // Jan 1
const dec31 = createTestDate(2024, 12, 31); // Dec 31

// Leap year
const feb29 = createTestDate(2024, 2, 29); // Feb 29 (leap day)
const mar1 = createTestDate(2024, 3, 1);   // Mar 1 (after leap)
```

---

## Month Index Trap

```javascript
// ❌ Date.UTC() uses 0-based months
new Date(Date.UTC(2025, 0, 15)); // 0 = January (confusing!)

// ✅ createTestDate() uses 1-based months
createTestDate(2025, 1, 15); // 1 = January (intuitive!)
```

---

## Test Examples

### Format Testing
```javascript
it('should format dates correctly', () => {
  const date = createTestDate(2025, 1, 15);
  expect(formatDate(date)).toMatch(/Jan.*15.*2025/);
});
```

### API Request Testing
```javascript
it('should filter by date range', async () => {
  const response = await request(app)
    .get('/api/products')
    .query({
      startDate: '2025-01-01T12:00:00Z',
      endDate: '2025-01-31T12:00:00Z'
    });
  // ...
});
```

### Boundary Testing
```javascript
it('should handle year boundaries', () => {
  const jan1 = TEST_DATES.YEAR_START;
  const dec31 = TEST_DATES.YEAR_END;

  expect(formatDate(jan1)).toMatch(/Jan.*1.*2025/);
  expect(formatDate(dec31)).toMatch(/Dec.*31.*2024/);
});
```

---

## CI/CD Timezone Gotchas

**Don't assume CI runs in UTC!**

- GitHub Actions: Depends on runner location
- GitLab CI: Configurable per project
- CircleCI: Depends on executor
- Developer machines: Varies (PST, EST, etc.)

**Solution**: Use timezone-safe patterns everywhere.

---

## Checklist

Before writing date tests:

- [ ] Import `createTestDate` from `../helpers/test-dates.js`
- [ ] Use 1-based months for clarity
- [ ] Test year boundaries (Jan 1, Dec 31)
- [ ] Test leap year dates (Feb 29)
- [ ] Use regex patterns, not exact strings
- [ ] Verify tests pass locally (your timezone may differ from CI)

---

## See Also

- **Detailed Guide**: `docs/LEARNINGS_TODO_176_TIMEZONE_DATE_TESTS.md`
- **TypeScript Patterns**: `docs/01_TYPESCRIPT_PATTERNS.md` - Date Testing Patterns
- **API Patterns**: `docs/03_API_PATTERNS.md` - Timezone-Safe Date Testing

---

**Last Updated**: 2025-12-07
**Issue Reference**: GitHub Issue #176
