# Coverage Enforcement Guide

## Overview

This guide documents the test coverage enforcement strategy for the PriceCompare application. We enforce **80% minimum coverage** across all code metrics to ensure code quality and reliability.

## Coverage Thresholds

### Global Thresholds (80%)
All production code must meet these minimums:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Critical File Thresholds (90%)
Security-critical files have stricter requirements:
- `server/auth.ts` - Authentication logic
- `server/middleware/csrf.ts` - CSRF protection

## Running Coverage Reports

### Local Development

```bash
# Run all tests with coverage
npm run test:coverage

# Watch mode with coverage updates
npm run test:watch

# Generate HTML report (opens in browser)
npm run test:coverage
open coverage/index.html
```

### Coverage Output

```
✓ Test Files  20 passed (20)
✓ Tests  467 passed (467)

--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   85.23 |    82.45 |   87.12 |   85.67 |
 server/            |   88.45 |    85.23 |   89.34 |   88.90 |
  auth.ts           |   92.34 |    90.12 |   93.45 |   92.67 |
  storage.ts        |   87.23 |    84.56 |   88.12 |   87.45 |
 server/middleware/ |   90.12 |    88.23 |   91.34 |   90.45 |
  csrf.ts           |   94.56 |    92.34 |   95.23 |   94.67 |
  ...               |   ...   |    ...   |   ...   |   ...   |
--------------------|---------|----------|---------|---------|
```

## What's Excluded from Coverage

Coverage reports **exclude**:
- Test files (`**/*.test.ts`, `**/__tests__/**`)
- E2E tests (`e2e/**`)
- Configuration files (`**/*.config.*`)
- Type definitions (`**/*.d.ts`)
- Third-party components (`client/src/components/ui/**`)
- Build scripts (`scripts/**`)
- Database migrations (`migrations/**`)
- Entry points (`server/index.ts`, `client/src/main.tsx`)
- Documentation (`docs/**`)

**Rationale**: These files either:
- Are test infrastructure (testing the tests is redundant)
- Have minimal logic (entry points, config)
- Are third-party code (already tested upstream)
- Are declarative (migrations, types)

## CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/test-coverage.yml` workflow:

1. **Runs on**:
   - Every push to `main`, `develop`, `add_scraping`
   - Every pull request to `main`, `develop`

2. **Test Pipeline**:
   - Sets up PostgreSQL + Redis services
   - Runs database migrations
   - Executes unit tests with coverage
   - Runs E2E tests with Playwright
   - Uploads coverage to Codecov & Coveralls
   - Comments PR with coverage delta

3. **Enforcement**:
   - ❌ Fails if coverage < 80% (any metric)
   - ❌ Fails if critical files < 90%
   - ✅ Passes only when all thresholds met

### Coverage Badges

Add badges to README.md:

```markdown
[![codecov](https://codecov.io/gh/YOUR_ORG/PriceCompare/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_ORG/PriceCompare)
[![Coverage Status](https://coveralls.io/repos/github/YOUR_ORG/PriceCompare/badge.svg?branch=main)](https://coveralls.io/github/YOUR_ORG/PriceCompare?branch=main)
```

## Coverage Best Practices

### 1. Write Tests Before Implementation (TDD)

```typescript
// ❌ BAD: Implement first, test later
export function calculateDiscount(price: number, percent: number): number {
  return price * (1 - percent / 100);
}
// (Then forget to test edge cases...)

// ✅ GOOD: Test first, implement second
describe('calculateDiscount', () => {
  it('should calculate 10% discount correctly', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
  });

  it('should handle 0% discount', () => {
    expect(calculateDiscount(100, 0)).toBe(100);
  });

  it('should handle 100% discount', () => {
    expect(calculateDiscount(100, 100)).toBe(0);
  });

  it('should throw on negative price', () => {
    expect(() => calculateDiscount(-100, 10)).toThrow();
  });
});
```

### 2. Test Edge Cases and Error Paths

Coverage metrics track:
- **Branches**: All `if/else`, `switch`, ternary paths
- **Functions**: All function calls
- **Lines**: All executable lines
- **Statements**: All expressions

```typescript
// This function has 4 branch paths - test all of them!
export function validateAge(age: number | null): string {
  if (age === null) return 'Age required';        // Branch 1
  if (age < 0) return 'Age cannot be negative';   // Branch 2
  if (age < 18) return 'Must be 18 or older';     // Branch 3
  return 'Valid';                                  // Branch 4
}

// ✅ Test suite covering all branches
describe('validateAge', () => {
  it('should require age', () => {
    expect(validateAge(null)).toBe('Age required');
  });

  it('should reject negative age', () => {
    expect(validateAge(-1)).toBe('Age cannot be negative');
  });

  it('should reject under 18', () => {
    expect(validateAge(17)).toBe('Must be 18 or older');
  });

  it('should accept 18+', () => {
    expect(validateAge(18)).toBe('Valid');
    expect(validateAge(25)).toBe('Valid');
  });
});
```

### 3. Integration Tests Count Toward Coverage

Both unit and integration tests contribute to coverage metrics:

```typescript
// server/routes/product-routes.ts
app.get('/api/products/:id', async (req, res) => {
  const id = parseIntSafe(req.params.id, 'productId');  // Line covered by integration test
  const product = await storage.getProductById(id);     // Line covered by integration test
  res.json(product);                                     // Line covered by integration test
});

// server/routes/__tests__/product-routes.test.ts
it('should get product by ID', async () => {
  const res = await request(app).get('/api/products/1'); // Covers all 3 lines above!
  expect(res.status).toBe(200);
  expect(res.body.id).toBe(1);
});
```

### 4. Don't Game the Metrics

```typescript
// ❌ BAD: Tests that don't actually validate behavior
it('should not crash', () => {
  calculateDiscount(100, 10); // No assertion - useless!
});

// ❌ BAD: Shallow tests that don't test logic
it('should return a number', () => {
  expect(typeof calculateDiscount(100, 10)).toBe('number'); // Too shallow!
});

// ✅ GOOD: Tests that validate actual behavior
it('should calculate 10% discount on $100 as $90', () => {
  expect(calculateDiscount(100, 10)).toBe(90);
});
```

## Maintaining High Coverage

### New Feature Checklist

When adding new code:
- [ ] Write unit tests for business logic
- [ ] Write integration tests for API endpoints
- [ ] Add E2E tests for user-facing features
- [ ] Run `npm run test:coverage` locally
- [ ] Verify coverage hasn't dropped below 80%
- [ ] Commit tests WITH the feature code

### Code Review Checklist

When reviewing PRs:
- [ ] Check CI coverage report in PR comments
- [ ] Verify new code has corresponding tests
- [ ] Look for untested edge cases
- [ ] Ensure error paths are tested
- [ ] Reject PRs that drop coverage below threshold

### Refactoring Strategy

When refactoring existing code:
1. **Run tests first** - Ensure current tests pass
2. **Refactor code** - Make your changes
3. **Run tests again** - Verify tests still pass
4. **Add missing tests** - Cover any new branches
5. **Check coverage** - Ensure it didn't drop

## Troubleshooting Coverage Issues

### Coverage Doesn't Match Expectations

```bash
# Generate detailed HTML report
npm run test:coverage

# Open in browser
open coverage/index.html

# Click on specific file to see line-by-line coverage
# Red lines = not covered, need tests
# Green lines = covered
# Yellow lines = partially covered (some branches missed)
```

### Coverage Dropped After Changes

```bash
# See which files have low coverage
npm run test:coverage -- --reporter=json

# Check coverage/coverage-final.json for specific files
cat coverage/coverage-final.json | jq '.["server/auth.ts"]'
```

### CI Failing on Coverage

```bash
# Run same command as CI locally
CI=true npm run test:coverage

# This will fail if coverage < 80%, showing which files need work
```

## Coverage vs Quality

**Important**: 100% coverage ≠ bug-free code!

Coverage measures **what code was executed**, not:
- ❌ If assertions are meaningful
- ❌ If edge cases are tested
- ❌ If integration points work
- ❌ If UX flows are smooth

**Best approach**: Combine coverage metrics with:
- Code review (human verification)
- Integration tests (API contracts)
- E2E tests (user journeys)
- Static analysis (TypeScript, ESLint)
- Security scans (dependency audits)

## Current Test Suite

### Test Breakdown (467 total tests)

| Layer | Tests | Purpose |
|-------|-------|---------|
| **Unit Tests** | 267 | Business logic, utilities, services |
| **Integration Tests** | 134 | API endpoints, database operations |
| **E2E Tests** | 66 | User journeys, full-stack validation |

### Coverage by Area

| Area | Coverage | Notes |
|------|----------|-------|
| **Authentication** | 92% | auth.ts, password reset, sessions |
| **Middleware** | 90% | CSRF, security headers, sanitization |
| **API Routes** | 82% | Products, alerts, retailers, forum |
| **Services** | 85% | Email, notifications, price tracking |
| **Database** | 88% | storage.ts, query patterns |

## Quick Reference

```bash
# Development
npm run test:watch           # Watch mode with instant feedback
npm run test:coverage        # Full coverage report

# CI/CD
npm run test                 # Run all tests (CI mode)
npm run test:e2e            # Run E2E tests
npm run check               # TypeScript type checking

# Coverage files (generated)
coverage/                    # HTML report (browsable)
coverage/lcov.info          # LCOV format (for CI tools)
coverage/coverage-final.json # JSON format (for scripts)
```

## Additional Resources

- [Vitest Coverage Guide](https://vitest.dev/guide/coverage.html)
- [Playwright Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)

---

**Remember**: Coverage is a tool, not a goal. Write tests that give you confidence in your code!
