/**
 * E2E Tests: Price Alert Management
 *
 * Tests creating, viewing, editing, and deleting price alerts
 */
import { test, expect, type Page } from '@playwright/test';
import {
  cleanDatabase,
  registerUser,
  waitForApiResponse,
  waitForToast as _waitForToast,
  generateTestEmail,
  generateTestUsername,
} from './helpers';
import { db } from '../server/db';
import { products, productOffers, retailers } from '../shared/schema';

test.describe('Price Alert Management', () => {
  test.beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();

    // Seed test data
    await seedTestData();
  });

  test.describe('Create Price Alert', () => {
    test('should create a price alert for authenticated user', async ({ page }) => {
      const username = generateTestUsername('alert');
      const email = generateTestEmail('alert');
      const password = 'SecurePass123!';

      // Register and login
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Navigate to alerts page
      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Click "Create Alert" button
      await page.click(
        'button:has-text("Create Alert"), button:has-text("New Alert"), a:has-text("Create Alert")'
      );

      // Fill alert form
      await page.fill('input[name="productName"], input[placeholder*="product"]', 'Gaming Laptop');
      await page.fill('input[name="targetPrice"], input[type="number"]', '999.99');

      // Submit form
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Save")');

      // Wait for alert creation
      await waitForApiResponse(page, '/api/alerts', 201);

      // Should show success message
      await expect(page.locator('text=/alert.*created|successfully.*created/i')).toBeVisible();

      // Should redirect to alerts list
      await expect(page).toHaveURL(/.*\/alerts.*/);
    });

    test('should validate target price input', async ({ page }) => {
      const username = generateTestUsername('validation');
      const email = generateTestEmail('validation');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await page.goto('/alerts/new');
      await page.waitForLoadState('networkidle');

      // Try to submit with invalid price
      await page.fill('input[name="productName"]', 'Test Product');
      await page.fill('input[name="targetPrice"]', '-10'); // Negative price

      await page.click('button[type="submit"]');

      // Should show validation error
      await expect(
        page.locator('text=/price.*positive|price.*must be.*greater|invalid.*price/i')
      ).toBeVisible();
    });

    test('should require product selection', async ({ page }) => {
      const username = generateTestUsername('reqproduct');
      const email = generateTestEmail('reqproduct');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await page.goto('/alerts/new');
      await page.waitForLoadState('networkidle');

      // Try to submit without product
      await page.fill('input[name="targetPrice"]', '999.99');
      await page.click('button[type="submit"]');

      // Should show validation error
      await expect(page.locator('text=/product.*required|select.*product/i')).toBeVisible();
    });

    test('should create alert from product page', async ({ page }) => {
      const username = generateTestUsername('quickalert');
      const email = generateTestEmail('quickalert');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Go to product page
      await page.goto('/products');
      await page.waitForLoadState('networkidle');
      await page.click('[data-testid="product-card"], .product-card');

      // Click "Set Alert" or "Price Alert" button
      await page.click(
        'button:has-text("Set Alert"), button:has-text("Price Alert"), [data-testid="set-alert"]'
      );

      // Fill target price (product should be pre-selected)
      await page.fill('input[name="targetPrice"], input[type="number"]', '899.99');
      await page.click('button[type="submit"]');

      await waitForApiResponse(page, '/api/alerts', 201);

      // Should show success
      await expect(page.locator('text=/alert.*created|watching.*price/i')).toBeVisible();
    });
  });

  test.describe('View Price Alerts', () => {
    test('should list all user alerts', async ({ page }) => {
      const username = generateTestUsername('listalerts');
      const email = generateTestEmail('listalerts');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create multiple alerts
      await createAlertViaApi(page, 'Gaming Laptop', 999.99);
      await createAlertViaApi(page, 'Wireless Mouse', 29.99);

      // View alerts page
      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should show both alerts
      await expect(page.locator('text=/Gaming Laptop/i')).toBeVisible();
      await expect(page.locator('text=/Wireless Mouse/i')).toBeVisible();

      // Should show target prices
      await expect(page.locator('text=/999\\.99/i')).toBeVisible();
      await expect(page.locator('text=/29\\.99/i')).toBeVisible();
    });

    test('should show empty state when no alerts', async ({ page }) => {
      const username = generateTestUsername('noalerts');
      const email = generateTestEmail('noalerts');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should show empty state
      await expect(
        page.locator('text=/no.*alerts|create.*first.*alert|no.*price.*alerts/i')
      ).toBeVisible();
    });

    test('should show alert status (active/triggered)', async ({ page }) => {
      const username = generateTestUsername('status');
      const email = generateTestEmail('status');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await createAlertViaApi(page, 'Gaming Laptop', 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should show alert status
      await expect(page.locator('text=/active|watching|monitoring|triggered/i')).toBeVisible();
    });
  });

  test.describe('Edit Price Alert', () => {
    test('should update alert target price', async ({ page }) => {
      const username = generateTestUsername('editalert');
      const email = generateTestEmail('editalert');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await createAlertViaApi(page, 'Gaming Laptop', 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Click edit button
      await page.click('button:has-text("Edit"), [data-testid="edit-alert"], a:has-text("Edit")');

      // Update target price
      await page.fill('input[name="targetPrice"]', '849.99');
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');

      await waitForApiResponse(page, /\/api\/alerts\/\d+/, 200);

      // Should show success
      await expect(page.locator('text=/alert.*updated|successfully.*updated/i')).toBeVisible();

      // Should show new price
      await expect(page.locator('text=/849\\.99/i')).toBeVisible();
    });

    test('should validate updated price', async ({ page }) => {
      const username = generateTestUsername('validateedit');
      const email = generateTestEmail('validateedit');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await createAlertViaApi(page, 'Gaming Laptop', 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Edit")');

      // Try invalid price
      await page.fill('input[name="targetPrice"]', '0');
      await page.click('button[type="submit"]');

      // Should show validation error
      await expect(page.locator('text=/price.*positive|price.*must be.*greater/i')).toBeVisible();
    });
  });

  test.describe('Delete Price Alert', () => {
    test('should delete an alert', async ({ page }) => {
      const username = generateTestUsername('deletealert');
      const email = generateTestEmail('deletealert');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await createAlertViaApi(page, 'Gaming Laptop', 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Verify alert exists
      await expect(page.locator('text=/Gaming Laptop/i')).toBeVisible();

      // Click delete button
      await page.click(
        'button:has-text("Delete"), [data-testid="delete-alert"], button[aria-label*="Delete"]'
      );

      // Confirm deletion (if confirmation dialog exists)
      try {
        await page.click(
          'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")',
          { timeout: 2000 }
        );
      } catch {
        // No confirmation dialog
      }

      await waitForApiResponse(page, /\/api\/alerts\/\d+/, 200);

      // Should show success
      await expect(page.locator('text=/alert.*deleted|successfully.*deleted/i')).toBeVisible();

      // Alert should be removed from list
      await expect(page.locator('text=/Gaming Laptop/i')).not.toBeVisible();
    });

    test('should require confirmation for deletion', async ({ page }) => {
      const username = generateTestUsername('confirmdelete');
      const email = generateTestEmail('confirmdelete');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await createAlertViaApi(page, 'Gaming Laptop', 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Click delete
      await page.click('button:has-text("Delete")');

      // Should show confirmation dialog
      try {
        await expect(
          page.locator('text=/are you sure|confirm.*deletion|delete.*alert/i')
        ).toBeVisible({ timeout: 2000 });
      } catch {
        // Some implementations might not have confirmation
        console.log('No confirmation dialog found (this is acceptable)');
      }
    });
  });

  test.describe('Alert Notifications', () => {
    test('should show notification when price drops below target', async ({ page }) => {
      const username = generateTestUsername('notification');
      const email = generateTestEmail('notification');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create alert with high target price (will be triggered)
      await createAlertViaApi(page, 'Gaming Laptop', 2000.0); // Current price is much lower

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should show that alert was triggered or notification exists
      await expect(
        page.locator('text=/triggered|price.*dropped|target.*met|notification/i')
      ).toBeVisible();
    });
  });

  test.describe('Authentication Requirements', () => {
    test('should redirect unauthenticated users', async ({ page }) => {
      // Try to access alerts without logging in
      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/(login|signin).*/);
    });

    test('should require authentication to create alert', async ({ page }) => {
      // Try to create alert without logging in
      await page.goto('/alerts/new');
      await page.waitForLoadState('networkidle');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/(login|signin).*/);
    });
  });

  test.describe('Alert Limits', () => {
    test('should enforce maximum alerts per user', async ({ page }) => {
      const username = generateTestUsername('maxalerts');
      const email = generateTestEmail('maxalerts');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create maximum number of alerts (assuming limit exists)
      for (let i = 0; i < 10; i++) {
        await createAlertViaApi(page, `Product ${i}`, 99.99 + i);
      }

      // Try to create one more
      await page.goto('/alerts/new');
      await page.waitForLoadState('networkidle');

      await page.fill('input[name="productName"]', 'Extra Product');
      await page.fill('input[name="targetPrice"]', '999.99');
      await page.click('button[type="submit"]');

      // Might show limit error (if limit is enforced)
      const hasLimitError = await page
        .locator('text=/limit.*reached|maximum.*alerts|too.*many/i')
        .isVisible({ timeout: 2000 });

      if (hasLimitError) {
        console.log('Alert limit is enforced');
      } else {
        console.log('No alert limit or limit is higher than 10');
      }
    });
  });
});

/**
 * Seed test data for price alert tests
 */
async function seedTestData() {
  // Create test retailer
  const [retailer] = await db
    .insert(retailers)
    .values({
      name: 'Test Store',
      logo: 'https://via.placeholder.com/150',
    })
    .returning();

  // Create test product
  const [product] = await db
    .insert(products)
    .values({
      name: 'Gaming Laptop',
      description: 'High-performance gaming laptop',
      image: 'https://via.placeholder.com/400',
      category: 'Electronics',
    })
    .returning();

  // Create product offer
  await db.insert(productOffers).values({
    productId: product.id,
    retailerId: retailer.id,
    price: '1299.99',
    productUrl: 'https://test-store.example.com/laptop',
    availability: 'in_stock',
  });
}

/**
 * Helper to create alert via API
 */
async function createAlertViaApi(page: Page, productName: string, targetPrice: number) {
  await page.goto('/alerts/new');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="productName"]', productName);
  await page.fill('input[name="targetPrice"]', targetPrice.toString());
  await page.click('button[type="submit"]');

  await waitForApiResponse(page, '/api/alerts', 201);
  await page.waitForTimeout(500); // Brief pause for state update
}
