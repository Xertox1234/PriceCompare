# E2E Tests with Playwright

This directory contains end-to-end tests for the PriceCompare application using [Playwright](https://playwright.dev/).

## Running Tests

### Run all tests (headless)
```bash
npm run test:e2e
```

### Run tests with browser UI visible
```bash
npm run test:e2e:headed
```

### Run tests in interactive UI mode
```bash
npm run test:e2e:ui
```

### Debug a specific test
```bash
npm run test:e2e:debug
```

### Run a specific test file
```bash
npx playwright test homepage.spec.ts
```

## Test Structure

- `homepage.spec.ts` - Homepage and navigation tests
- `auth.spec.ts` - User authentication flows (registration, login, logout)
- `product-search.spec.ts` - Product search and filtering
- `watchlist.spec.ts` - Watchlist functionality
- `setup.ts` - Global setup for authenticated tests

## Writing New Tests

1. Create a new `.spec.ts` file in this directory
2. Import test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Write tests using Playwright's API:
   ```typescript
   test('should do something', async ({ page }) => {
     await page.goto('/');
     await expect(page.getByRole('heading')).toBeVisible();
   });
   ```

## Best Practices

### Selectors
- **Prefer accessible selectors**: `getByRole()`, `getByLabel()`, `getByPlaceholder()`
- **Use data-testid** for elements without semantic meaning: `[data-testid="product-card"]`
- **Avoid CSS selectors** unless necessary

### Waiting
- **Auto-waiting**: Playwright automatically waits for elements to be actionable
- **Explicit waits**: Use `waitForLoadState()` for network activity
- **Avoid timeouts**: Use `page.waitForTimeout()` only as a last resort

### Test Organization
- **Use describe blocks** to group related tests
- **Use beforeEach** for common setup
- **Keep tests independent** - don't rely on order

### Assertions
```typescript
// Visibility
await expect(element).toBeVisible();
await expect(element).toBeHidden();

// Text content
await expect(element).toHaveText('expected text');
await expect(element).toContainText('partial text');

// Attributes
await expect(element).toHaveAttribute('href', '/link');

// URL
await expect(page).toHaveURL(/\/expected-path/);
```

## Configuration

See `playwright.config.ts` in the project root for configuration options:
- Base URL
- Timeouts
- Browser settings
- Retry strategy
- Screenshots and videos

## CI/CD

E2E tests run automatically on:
- Pull requests (`.github/workflows/e2e-tests.yml`)
- Manual workflow dispatch

Test results, screenshots, and videos are uploaded as GitHub Actions artifacts.

## Debugging

### View test report
After running tests, open the HTML report:
```bash
npx playwright show-report
```

### Generate trace
Traces are automatically captured on first retry. View them:
```bash
npx playwright show-trace test-results/path-to-trace.zip
```

### Playwright Inspector
Run with `--debug` flag to use the inspector:
```bash
npm run test:e2e:debug
```

## Troubleshooting

### Tests are flaky
- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Use `toBeVisible()` before interacting with elements
- Increase timeout if needed: `{ timeout: 10000 }`

### Element not found
- Check if element is in viewport: `await element.scrollIntoViewIfNeeded()`
- Verify selector with: `await page.locator('selector').count()`
- Use Playwright Inspector to debug selectors

### Server not starting in CI
- Check environment variables are set
- Verify database migrations run successfully
- Ensure ports are not in use

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [API Reference](https://playwright.dev/docs/api/class-test)
