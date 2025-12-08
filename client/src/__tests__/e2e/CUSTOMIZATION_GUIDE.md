# Customizing E2E Tests for Your UI

This guide shows you **exactly** how to update the E2E tests to match your actual PriceCompare UI components.

## 🎯 How the Current Tests Work

The tests use **generic selectors** like:

```typescript
page.getByRole('link', { name: /sign up|register/i });
page.getByPlaceholder(/search/i);
page.getByRole('button', { name: /log out|sign out/i });
```

These are flexible and work with any UI, but they might not match your specific component structure.

## 🔧 Your Actual UI Structure

Based on your codebase, here's what you have:

### Navigation (`client/src/components/shared-navigation.tsx`)

- **Sign In button**: `<Button>Sign In</Button>` (desktop and mobile)
- **Sign Up button**: `<Button>Sign Up</Button>` (desktop and mobile)
- **Sign out button**: `<Button>Sign out</Button>` (shown when logged in)
- **Home link**: `<Link href="/">Home</Link>`
- **Products link**: `<Link href="/products">Products</Link>`

### Authentication (`client/src/components/auth/auth-modal.tsx` + `login-form.tsx`)

- **Auth Modal**: Opens when clicking Sign In or Sign Up
- **Login Form**:
  - Email input: `id="email"` with `placeholder="Enter your email"`
  - Password input: `id="password"` with `placeholder="Enter your password"`
  - Submit button: `<Button type="submit">Sign In</Button>`
- **Register Form**:
  - Username input: `id="username"` with `placeholder="Choose a username"`
  - Email input: `id="email"` with `placeholder="Enter your email"`
  - Password input: `id="password"` with `placeholder="Create a password"`
  - Confirm Password: `id="confirmPassword"` with `placeholder="Confirm your password"`
  - Submit button: `<Button type="submit">Create Account</Button>`

### Search (`client/src/components/new-hero-section.tsx` + `enhanced-search-header.tsx`)

- **Hero search input**: `placeholder="What are you looking for?"`
- **Enhanced search**: `placeholder="Search for products to compare prices..."`

### Products (`client/src/pages/products.tsx` + `product-grid.tsx`)

- Products are displayed in a grid
- Empty state shows: "No products found"

## ✏️ Step-by-Step Customization

### 1. Update `homepage.spec.ts`

**Current generic code:**

```typescript
const homeLink = page.getByRole('link', { name: /home/i });
```

**Change to your specific UI:**

```typescript
// Option 1: More specific text match
const homeLink = page.getByRole('link', { name: 'Home' });

// Option 2: Use the exact button structure
const homeButton = page.getByRole('button', { name: /Home/i });
```

**Full file update:**
Replace the entire file with this updated version:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage successfully', async ({ page }) => {
    // Check for the main hero heading
    await expect(page.getByText(/Shop and Save on Millions of Products/i)).toBeVisible();

    // Verify main search is visible
    const searchInput = page.getByPlaceholder('What are you looking for?');
    await expect(searchInput).toBeVisible();
  });

  test('should display navigation elements', async ({ page }) => {
    // Check navigation brand
    await expect(page.getByText('PriceCompare')).toBeVisible();

    // Desktop navigation links (visible on desktop)
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
  });

  test('should have authentication buttons', async ({ page }) => {
    // Check for Sign In button
    const signInButton = page.getByRole('button', { name: 'Sign In' }).first();
    await expect(signInButton).toBeVisible();

    // Check for Sign Up button
    const signUpButton = page.getByRole('button', { name: 'Sign Up' }).first();
    await expect(signUpButton).toBeVisible();
  });

  test('should have responsive layout', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('body')).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();

    // On mobile, check for mobile menu button
    const mobileMenuButton = page.getByRole('button').filter({ has: page.locator('svg') });
    // Mobile menu should be visible on small screens
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const criticalErrors = consoleErrors.filter(
      (error) => !error.includes('favicon') && !error.includes('404')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
```

---

### 2. Update `auth.spec.ts`

**Change this file to use your actual UI elements:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Sign Up Flow', () => {
    test('should open registration modal', async ({ page }) => {
      // Click Sign Up button
      await page.getByRole('button', { name: 'Sign Up' }).first().click();

      // Modal should open with "Create Account" title
      await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    });

    test('should show validation for empty form', async ({ page }) => {
      // Open registration modal
      await page.getByRole('button', { name: 'Sign Up' }).first().click();

      // Try to submit without filling anything
      await page.getByRole('button', { name: 'Create Account' }).click();

      // Browser validation should prevent submission
      const usernameInput = page.locator('#username');
      const isInvalid = await usernameInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
      expect(isInvalid).toBe(true);
    });

    test('should register new user', async ({ page }) => {
      const timestamp = Date.now();
      const testUser = {
        username: `testuser_${timestamp}`,
        email: `test_${timestamp}@example.com`,
        password: 'TestPass123!',
      };

      // Open registration modal
      await page.getByRole('button', { name: 'Sign Up' }).first().click();

      // Fill form with exact IDs
      await page.locator('#username').fill(testUser.username);
      await page.locator('#email').fill(testUser.email);
      await page.locator('#password').fill(testUser.password);
      await page.locator('#confirmPassword').fill(testUser.password);

      // Submit
      await page.getByRole('button', { name: 'Create Account' }).click();

      // Wait for success (modal closes and user is logged in)
      await page.waitForTimeout(2000);

      // Should show Sign out button now
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Sign In Flow', () => {
    test('should open login modal', async ({ page }) => {
      // Click Sign In button
      await page.getByRole('button', { name: 'Sign In' }).first().click();

      // Modal should open with "Sign In" title
      await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      // Open login modal
      await page.getByRole('button', { name: 'Sign In' }).first().click();

      // Fill with invalid credentials
      await page.locator('#email').fill('invalid@example.com');
      await page.locator('#password').fill('wrongpassword');

      // Submit
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for error message
      await expect(
        page.getByText(/Login failed|Invalid credentials|check your credentials/i)
      ).toBeVisible({ timeout: 5000 });
    });

    test('should toggle to registration form', async ({ page }) => {
      // Open login modal
      await page.getByRole('button', { name: 'Sign In' }).first().click();

      // Click "Sign up" link at bottom
      await page.getByRole('button', { name: 'Sign up' }).click();

      // Should now show Create Account form
      await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test.skip('should logout user', async ({ page }) => {
      // This test requires an authenticated user
      // You'll need to implement login first or use a setup fixture
      // For now, we skip it
    });
  });
});
```

---

### 3. Update `product-search.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Product Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display hero search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder('What are you looking for?');
    await expect(searchInput).toBeVisible();
  });

  test('should navigate to products page on search', async ({ page }) => {
    const searchInput = page.getByPlaceholder('What are you looking for?');

    // Enter search query and press Enter
    await searchInput.fill('laptop');
    await searchInput.press('Enter');

    // Should navigate to products page with search query
    await expect(page).toHaveURL(/\/products\?search=laptop/);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display search results on products page', async ({ page }) => {
    // Go directly to products page with search
    await page.goto('/products?search=phone');

    // Wait for results
    await page.waitForLoadState('networkidle');

    // Check for search results heading
    await expect(
      page.getByRole('heading', { name: /Results for|Featured Products/i })
    ).toBeVisible();

    // Products grid should be visible (even if empty)
    const productsSection = page.locator('section[aria-label="Product comparison results"]');
    await expect(productsSection).toBeVisible();
  });

  test('should show empty state for no results', async ({ page }) => {
    await page.goto('/products?search=xyznonexistent12345');
    await page.waitForLoadState('networkidle');

    // Look for "No products found" message
    await expect(page.getByText(/No products found|Try adjusting/i)).toBeVisible({ timeout: 5000 });
  });

  test('should use enhanced search header on products page', async ({ page }) => {
    await page.goto('/products');

    // Enhanced search header should have this placeholder
    const enhancedSearch = page.getByPlaceholder(/Search for products to compare prices/i);
    await expect(enhancedSearch).toBeVisible();

    // Enter new search
    await enhancedSearch.fill('tablet');
    await enhancedSearch.press('Enter');

    // URL should update
    await expect(page).toHaveURL(/search=tablet/);
  });
});
```

---

### 4. Update `watchlist.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Watchlist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.skip('should navigate to watchlists page', async ({ page }) => {
    // Watchlist link only visible when logged in
    // Check if it exists
    const watchlistLink = page.getByRole('link', { name: /watchlist|watch lists/i });

    const isVisible = await watchlistLink.isVisible().catch(() => false);

    if (isVisible) {
      await watchlistLink.click();
      await expect(page).toHaveURL(/\/watchlists/);
    } else {
      // Skip if user not logged in
      test.skip();
    }
  });

  test('should require authentication for watchlist features', async ({ page }) => {
    // Try to access watchlist page directly
    await page.goto('/watchlists');

    // Should either redirect or show login prompt
    // (depends on your auth implementation)
    await page.waitForLoadState('networkidle');

    // If not authenticated, should see Sign In button
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    const isVisible = await signInButton.isVisible().catch(() => false);

    expect(isVisible).toBe(true);
  });
});
```

---

## 🚀 Running Your Updated Tests

After making these changes:

1. **Run tests in UI mode** (best for development):

   ```bash
   npm run test:e2e:ui
   ```

   This opens an interactive browser where you can:
   - See exactly which elements the tests are finding
   - Debug selectors that don't work
   - Record new tests by clicking through your UI

2. **Run in headed mode** (see the browser):

   ```bash
   npm run test:e2e:headed
   ```

3. **Run headless** (like CI):
   ```bash
   npm run test:e2e
   ```

## 🔍 Finding the Right Selectors

If a test fails because it can't find an element:

1. **Use Playwright Inspector**:

   ```bash
   npm run test:e2e:debug
   ```

   This pauses execution and lets you:
   - Hover over elements to see their properties
   - Try different selectors in the console
   - Step through test line by line

2. **Use the locator picker in UI mode**:
   - Click the "Pick locator" button
   - Click the element in the browser
   - Playwright suggests the best selector

3. **Common selector strategies** for your UI:

   ```typescript
   // By role (best for accessibility)
   page.getByRole('button', { name: 'Sign In' });
   page.getByRole('link', { name: 'Products' });

   // By label (for form inputs)
   page.getByLabel('Email');
   page.getByLabel('Password');

   // By ID (when using form inputs)
   page.locator('#email');
   page.locator('#password');

   // By placeholder
   page.getByPlaceholder('What are you looking for?');

   // By text content
   page.getByText('PriceCompare Community');
   page.getByText(/No products found/i); // case-insensitive regex
   ```

## 📝 Adding Data Test IDs (Recommended)

For more stable tests, add `data-testid` attributes to your components:

```tsx
// In your components (e.g., product-card.tsx)
<div data-testid="product-card">
  <h3 data-testid="product-name">{product.name}</h3>
  <span data-testid="product-price">{product.price}</span>
  <button data-testid="add-to-watchlist">Add to Watchlist</button>
</div>
```

Then use them in tests:

```typescript
const productCard = page.getByTestId('product-card');
const productName = page.getByTestId('product-name');
const addButton = page.getByTestId('add-to-watchlist');
```

## ⚡ Pro Tips

1. **Start with the UI mode**: Always use `npm run test:e2e:ui` when developing tests
2. **Use `.first()` carefully**: If you have multiple "Sign In" buttons (mobile + desktop), use `.first()` or be more specific
3. **Wait for network**: Use `await page.waitForLoadState('networkidle')` after navigation
4. **Skip flaky tests temporarily**: Use `test.skip()` for tests that need auth or specific data
5. **Test real user flows**: Don't just test individual features - test complete user journeys

## 🎯 Next Steps

1. Update the 4 test files with the examples above
2. Run `npm run test:e2e:ui` to see them in action
3. Fix any failing tests by adjusting selectors
4. Add more tests for your specific features (price history, analytics, etc.)
5. Add `data-testid` attributes to complex components

Need help with a specific component? Check the actual rendered HTML in the browser and use Playwright Inspector to find the best selector!
