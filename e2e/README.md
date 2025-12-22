# E2E Tests with Playwright

This directory contains end-to-end (E2E) tests for the PriceCompare platform using Playwright.

## Overview

E2E tests validate complete user journeys through the application, testing the full stack:

- Frontend (React UI)
- Backend (Express API)
- Database (PostgreSQL)

**Test Coverage**: 60-80 tests across 5 critical user flows

## Test Suites

### 1. Authentication Flow (`auth.spec.ts`)

Tests user authentication and session management:

- User registration with validation
- Login with valid/invalid credentials
- Account lockout after failed attempts
- Logout and session clearing
- Session persistence across navigation
- Authentication guards for protected routes

Notes:
- Auth is modal-based (no `/login` route); tests open the Sign In/Sign Up modals from `/price-watch`.
- Logged-in state is asserted via `data-testid="user-menu-button"`.

**12 tests** covering authentication scenarios

### 2. Product Discovery (`product-discovery.spec.ts`)

Tests product search and price tracking features:

- Product search by name and category
- Product details viewing
- Price history charts (30-day, 90-day)
- Price trend indicators
- Multiple retailer offers
- Watchlist management (add/remove)
- Price comparison across retailers
- Pagination of results

**18 tests** covering product discovery

### 3. Price Alerts (`price-alerts.spec.ts`)

Tests price alert creation and management:

- Create price alert with validation
- View all user alerts
- Edit alert target price
- Delete alerts with confirmation
- Alert notifications when price drops
- Authentication requirements
- Alert limits per user

**12 tests** covering price alerts

### 4. Admin Features (`admin.spec.ts`)

Tests admin dashboard and management features:

- Admin dashboard access and authorization
- Analytics overview (products, users, activity)
- Retailer creation and management
- Product editing and deletion
- Performance monitoring (API stats, slowest endpoints)
- User account management
- Admin role assignment (first user becomes admin)

**21 tests** covering admin features (14 runnable, 7 skipped pending UI implementation)

### 5. Accessibility (`accessibility.spec.ts`)

Accessibility smoke checks using Playwright + Axe:

- WCAG A/AA scans for key pages (scoped to reduce noise)
- Keyboard operability checks for modal-based auth
- Focus containment checks within dialogs

**8 tests** covering accessibility (expandable)

## Running Tests

### Prerequisites

1. Install Playwright:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

2. Ensure test database is configured
3. Ensure development server can start

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Tests in Headed Mode (with visible browser)

```bash
npm run test:e2e:headed
```

### Run Tests in UI Mode (interactive)

```bash
npm run test:e2e:ui
```

### Debug Tests

```bash
npm run test:e2e:debug
```

### Run Specific Test File

```bash
npx playwright test e2e/auth.spec.ts
```

### Run Tests Matching Pattern

```bash
npx playwright test --grep "should login"
```

### Run a CI-Style Shard (sequential)

Useful for reproducing GitHub Actions sharding locally.

**DB safety rule**: shards may run in parallel, but each shard must run Playwright sequentially (`--workers=1`).

```bash
npx playwright test --shard=1/4 --workers=1
```

## Configuration

E2E tests are configured in `playwright.config.ts`:

- **Test Directory**: `./e2e`
- **Workers**: 1 (sequential execution to avoid database conflicts)
- **Base URL (local default)**: `http://localhost:5001` (macOS AirPlay Receiver often uses 5000)
- **Override**: set `PLAYWRIGHT_TEST_BASE_URL` (e.g. in `.env.test`)
- **CI**: GitHub Actions workflow uses `http://localhost:5000`
- **Retries**: 2 on CI, 0 locally
- **Timeout**: 30 seconds per test
- **Screenshots**: On failure only
- **Video**: Retained on failure

### Why Sequential Execution?

Tests run sequentially (`workers: 1`) because:

1. **Database Isolation**: Each test cleans the database before running
2. **Prevent Race Conditions**: Concurrent tests would conflict on shared data
3. **Session Management**: Avoid cookie/session conflicts between parallel tests

## Test Patterns

Canonical E2E patterns (fixtures, DB safety, CI sharding): `docs/08_TESTING_PATTERNS.md`.

### Opt-in Fixtures (Phase 4.1)

An optional fixtures layer exists at `e2e/fixtures/index.ts` (re-exported by `e2e/fixtures.ts`) to reduce per-test boilerplate.

- Prefer importing from `./fixtures` (barrel export).
- `cleanDb` is an auto fixture that cleans DB state before each test.
- Example migrated suites: `e2e/accessibility.spec.ts`, `e2e/admin.spec.ts`, `e2e/auth.spec.ts`.

```ts
import { test, expect } from './fixtures';

test('example (already cleaned DB)', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/price-watch');
  await expect(authenticatedPage.getByTestId('user-menu-button').first()).toBeVisible();
});
```

### Database Cleanup

Many suites (legacy pattern) use `cleanDatabase()` in `beforeEach`:

```typescript
test.beforeEach(async () => {
  await cleanDatabase(); // Truncate all tables
  await seedSomeSuiteData(); // Insert test data (prefer `e2e/helpers/*-seed-helpers.ts`)
});
```

If a suite uses the opt-in fixtures, prefer relying on the auto `cleanDb` fixture instead of calling `cleanDatabase()` directly.

### Helper Functions

Shared utilities in `helpers.ts`:

- `cleanDatabase()` - Reset database state
- `registerUser()` - Register through UI
- `loginUser()` - Login through UI
- `logoutUser()` - Logout through UI
- `waitForApiResponse()` - Wait for specific API call
- `waitForToast()` - Wait for notification message
- `isLoggedIn()` - Check authentication state
- `generateTestEmail()` - Generate unique test emails
- `generateTestUsername()` - Generate unique test usernames

Suite-specific utilities in `e2e/helpers/` (preferred for DB seeding and feature helpers):

- `helpers/skip-helpers.ts` - `skipIfMissing()` for standardized “feature missing” skips
- `helpers/user-helpers.ts` - `getUserIdByEmail()` (avoid repeating DB lookup boilerplate)
- `helpers/watchlist-helpers.ts` - `ensureUserHasWatchlist()`
- `helpers/*-seed-helpers.ts` - per-suite DB seeding helpers (keeps specs UI-focused)

Admin-specific utilities in `helpers/admin-helpers.ts`:

- `createAdminUser()` - Register first user (auto-assigned admin role)
- `seedTestProduct()` - Create product with retailer and offers
- `seedAnalyticsData()` - Create sample data for analytics dashboard
- `seedMultipleProducts()` - Create multiple products for bulk testing

### Test Data

Tests seed their own data to ensure isolation.

Preferred pattern: keep DB seeding out of spec files; put it in `e2e/helpers/*-seed-helpers.ts` and call it from `beforeEach` (or a fixture) so specs stay focused on UI flows.

```ts
// e2e/helpers/some-suite-seed-helpers.ts
export async function seedSomeSuiteData() {
  // Insert retailers/products/offers/price history via Drizzle
}

// e2e/some-suite.spec.ts
import { test } from './fixtures';
import { seedSomeSuiteData } from './helpers/some-suite-seed-helpers';

test.beforeEach(async () => {
  await seedSomeSuiteData();
});
```

## Test Structure

### Good Test Pattern

```typescript
test('should perform action successfully', async ({ page }) => {
  // Arrange - Set up test data
  const username = generateTestUsername('test');
  const email = generateTestEmail('test');
  await registerUser(page, username, email, 'SecurePass123!');

  // Act - Perform the action
  await page.goto('/products');
  await page.click('[data-testid="product-card"]');

  // Assert - Verify the result
  await expect(page.locator('h1')).toBeVisible();
  await waitForApiResponse(page, '/api/products', 200);
});
```

### What to Test

Focus on:

- **User-visible behavior** (not implementation details)
- **Critical user journeys** (registration, purchase flow)
- **Error handling** (validation, network errors)
- **Cross-page flows** (login → shop → checkout)
- **Authentication requirements** (protected routes)

### What NOT to Test

Avoid:

- **API unit tests** (use integration tests instead)
- **Component unit tests** (use React Testing Library)
- **Visual regression** (unless specifically needed)
- **Third-party libraries** (trust they work)

## Debugging Failed Tests

### View Test Report

```bash
npx playwright show-report
```

### Debug Specific Test

```bash
npx playwright test --debug e2e/auth.spec.ts
```

### Screenshots and Videos

On test failure:

- **Screenshots**: Saved to `test-results/`
- **Videos**: Saved to `test-results/` (if enabled)
- **Traces**: Available in HTML report

### Common Issues

**Issue**: Tests fail with "Timeout waiting for element"
**Solution**: Increase timeout or check selector

**Issue**: Database constraint violations
**Solution**: Ensure `cleanDatabase()` is called in `beforeEach`

**Issue**: "Element is not visible"
**Solution**: Wait for page load or use `waitForLoadState('networkidle')`

**Issue**: Authentication failures
**Solution**: Check session cookies are enabled, verify CSRF token handling

## CI/CD Integration

E2E tests run in CI with:

- 2 retries for flaky tests
- HTML and JUnit reports
- GitHub Actions integration
- Sequential execution (workers: 1)
- Job-level sharding (each shard uses `--workers=1`)

### GitHub Actions Example

```yaml
- name: Run E2E Tests
  run: |
    npm run test:e2e
  env:
    PLAYWRIGHT_TEST_BASE_URL: http://localhost:5000
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

## Best Practices

### 1. Use Data Attributes for Selectors

```typescript
// Good
await page.click('[data-testid="login-button"]');

// Avoid (brittle)
await page.click('button.btn-primary.btn-lg');
```

### 2. Wait for Network Requests

```typescript
await waitForApiResponse(page, '/api/products', 200);
```

### 3. Generate Unique Test Data

```typescript
const email = generateTestEmail('test'); // test-1234567890-abc@example.com
```

### 4. Clean Up After Tests

```typescript
test.beforeEach(async () => {
  await cleanDatabase(); // Ensures isolation
});
```

### 5. Use Descriptive Test Names

```typescript
// Good
test('should show validation error when email is invalid', async ({ page }) => {

// Bad
test('email validation', async ({ page }) => {
```

## Performance Optimization

- **Reuse browser contexts** where possible
- **Minimize page.waitForTimeout()** - use specific waiters
- **Seed only necessary data** - don't over-seed
- **Use transactions** in test setup when possible

## Coverage Goals

E2E tests complement unit and integration tests:

- **Unit Tests** (267): Business logic, utilities, services
- **Integration Tests** (134): API routes, database interactions
- **E2E Tests** (60-80): Complete user journeys

**Total Coverage**: 461+ tests

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Project CLAUDE.md](../CLAUDE.md) - Project guidelines

## Questions?

For questions about E2E tests:

1. Check this README
2. Review existing test files for patterns
3. Check Playwright documentation
4. Review `docs/TYPESCRIPT_PATTERNS.md` for type safety
