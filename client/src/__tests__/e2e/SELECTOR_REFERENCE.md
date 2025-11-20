# E2E Test Selector Quick Reference

## Your PriceCompare UI Selectors

### Authentication
```typescript
// Open modals
page.getByRole('button', { name: 'Sign In' }).first().click()
page.getByRole('button', { name: 'Sign Up' }).first().click()

// Login form
page.locator('#email').fill('user@example.com')
page.locator('#password').fill('password123')
page.getByRole('button', { name: 'Sign In' }).click()

// Register form
page.locator('#username').fill('username')
page.locator('#email').fill('email@example.com')
page.locator('#password').fill('password')
page.locator('#confirmPassword').fill('password')
page.getByRole('button', { name: 'Create Account' }).click()

// Check if logged in
page.getByRole('button', { name: 'Sign out' })
```

### Navigation
```typescript
// Main navigation
page.getByRole('link', { name: 'Home' })
page.getByRole('link', { name: 'Products' })
page.getByRole('link', { name: 'Community Forum' })

// Brand
page.getByText('PriceCompare Community')
```

### Search
```typescript
// Hero search (homepage)
page.getByPlaceholder('What are you looking for?')

// Enhanced search (products page)
page.getByPlaceholder(/Search for products to compare prices/i)

// Perform search
const search = page.getByPlaceholder('What are you looking for?')
await search.fill('laptop')
await search.press('Enter')
```

### Products
```typescript
// Products grid
page.locator('section[aria-label="Product comparison results"]')

// Empty state
page.getByText(/No products found|Try adjusting/i)

// Results heading
page.getByRole('heading', { name: /Results for|Featured Products/i })
```

### Common Patterns
```typescript
// Wait for page to load
await page.waitForLoadState('networkidle')

// Check URL
await expect(page).toHaveURL(/\/products/)

// Check for errors in console
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(msg.text())
})

// Take screenshot
await page.screenshot({ path: 'screenshot.png' })
```

## Playwright UI Mode Commands

```bash
npm run test:e2e:ui       # Interactive mode (best for development)
npm run test:e2e:headed   # See browser while tests run
npm run test:e2e          # Headless (like CI)
npm run test:e2e:debug    # Pause and inspect
```

## Debugging Failed Tests

1. **Run in UI mode**: `npm run test:e2e:ui`
2. **Click the failed test**
3. **Use "Pick locator"** button to find elements
4. **Check the trace** to see what happened

## Best Practices

✅ **DO**:
- Use `getByRole()` for accessibility
- Use `getByLabel()` for form fields
- Use `data-testid` for complex components
- Wait for `networkidle` after navigation
- Use `.first()` when multiple elements match

❌ **DON'T**:
- Use CSS selectors like `.class-name`
- Use XPath unless necessary
- Use `page.waitForTimeout()` (flaky)
- Hardcode test data (use timestamps)
- Test implementation details
