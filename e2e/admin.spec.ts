/**
 * E2E Tests: Admin Features
 *
 * Tests admin dashboard, analytics, product/retailer management,
 * and performance monitoring.
 *
 * Test Coverage:
 * - Admin dashboard access
 * - Analytics overview
 * - Retailer creation and management
 * - Product editing and deletion
 * - Performance metrics viewing
 * - User account management
 */
import { test, expect } from './fixtures';
import {
  registerUser,
  loginUser,
  logoutUser,
  waitForApiResponse as _waitForApiResponse,
} from './helpers';
import {
  createAdminUser,
  seedTestProduct,
  seedAnalyticsData,
  seedMultipleProducts,
} from './helpers/admin-helpers';

test.describe('Admin - Dashboard Management', () => {
  test.describe('Dashboard Access', () => {
    test('should allow admin to access admin dashboard', async ({ page }) => {
      await createAdminUser(page);

      // Navigate to admin area
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Verify dashboard loads (may vary based on actual implementation)
      // Use flexible selectors that work with different UI variations
      await expect(page.getByRole('heading', { name: /admin|dashboard/i })).toBeVisible();
    });

    test('should redirect non-admin users from admin dashboard', async ({ page }) => {
      // Create admin first (first user)
      await createAdminUser(page);
      await logoutUser(page);

      // Create regular user (second user, not admin)
      await registerUser(page, 'regularuser', 'user@example.com', 'UserPass123!');

      // Try to access admin area
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should redirect to home or show access denied
      // Check for either redirect or error message
      const isRedirected = page.url().includes('/admin') === false;
      const hasAccessDenied = await page
        .getByText(/access denied|unauthorized|forbidden/i)
        .isVisible()
        .catch(() => false);

      expect(isRedirected || hasAccessDenied).toBe(true);
    });

    test('should redirect unauthenticated users from admin dashboard', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should redirect to home page (route protection in admin.tsx:lines 38-42)
      await expect(page).toHaveURL('http://localhost:5001/');
    });
  });

  test.describe('Analytics Overview', () => {
    test('should display analytics overview with statistics', async ({ page }) => {
      await createAdminUser(page);

      // Seed analytics data
      await seedAnalyticsData({ productCount: 5, priceHistoryCount: 20 });

      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Verify dashboard displays with statistics
      // The dashboard should show metrics for users, products, retailers, and alerts
      await expect(page.getByText(/Administration Panel/i)).toBeVisible();

      // Verify analytics data is visible (data loaded and displayed)
      await expect(page.getByText(/Total Users|Users/i).first()).toBeVisible();
      await expect(page.getByText(/Products/i).first()).toBeVisible();
      await expect(page.getByText(/Retailers/i).first()).toBeVisible();
    });

    test('should display user growth chart', async ({ page }) => {
      await createAdminUser(page);

      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/User Growth/i)).toBeVisible();
    });
  });

  test.describe('Retailer Management', () => {
    test('should create new retailer via API', async ({ page }) => {
      await createAdminUser(page);

      // Navigate to admin retailers section
      await page.goto('/admin/retailers');
      await page.waitForLoadState('networkidle');

      // Get CSRF token first
      const csrfResponse = await page.request.get('/api/csrf-token');
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.data.csrfToken;

      // Create retailer via API (UI may not be implemented yet)
      const response = await page.request.post('/api/admin/retailers', {
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        data: {
          name: 'TechMart',
          website: 'https://techmart.com',
          logo: 'https://techmart.com/logo.png',
          isActive: true,
        },
      });

      expect(response.status()).toBe(201);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.name).toBe('TechMart');
    });

    test('should create retailer via UI form', async ({ page }) => {
      await createAdminUser(page);

      await page.goto('/admin/retailers');
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /add retailer/i }).click();

      await page.getByLabel(/retailer name/i).fill('UITest Retailer');
      await page.getByLabel(/website url/i).fill('https://ui-test-retailer.example');
      await page.getByLabel(/logo url/i).fill('https://ui-test-retailer.example/logo.png');

      await page.getByRole('button', { name: /create retailer/i }).click();

      await expect(page.getByText('UITest Retailer')).toBeVisible({ timeout: 5000 });
    });

    test('should list all retailers', async ({ page }) => {
      await createAdminUser(page);

      // Seed retailers via analytics helper
      await seedAnalyticsData({ productCount: 2, priceHistoryCount: 0 });

      // Navigate to admin page
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Click on Retailers tab to view retailers
      await page.getByRole('tab', { name: /retailers/i }).click();

      // Wait for tab content to load before verification
      await page
        .getByText(/amazon|best buy|walmart/i)
        .first()
        .waitFor({
          state: 'visible',
          timeout: 5000,
        });

      // Verify retailers content is visible
      // seedAnalyticsData creates Amazon, Best Buy, and Walmart retailers
      await expect(page.getByText(/amazon|best buy|walmart/i).first()).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('Product Management', () => {
    test('should edit existing product via API', async ({ page }) => {
      await createAdminUser(page);

      // Create test product
      const { product } = await seedTestProduct();

      // Get CSRF token
      const csrfResponse = await page.request.get('/api/csrf-token');
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.data.csrfToken;

      // Update product via API
      const response = await page.request.put(`/api/admin/products/${product.id}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        data: {
          description: 'Updated description with new features',
          category: 'Smartphones',
        },
      });

      expect(response.status()).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.description).toBe('Updated description with new features');
      expect(responseData.data.category).toBe('Smartphones');
    });

    test('should edit product via UI form', async ({ page }) => {
      await createAdminUser(page);
      const { product } = await seedTestProduct({ name: 'UI Edit Product' });

      await page.goto('/admin/products');
      await page.waitForLoadState('networkidle');

      await page.getByRole('tab', { name: /^products$/i }).click();

      await page.getByTestId(`admin-product-edit-${product.id}`).click();
      await expect(page.getByRole('dialog', { name: /edit product/i })).toBeVisible();

      // Brand is required in the admin edit form; seeded products may not include it
      await page.getByLabel(/^brand$/i).fill('TestBrand');
      await page.getByLabel(/description/i).fill('Updated description with new features');
      await page.getByRole('button', { name: /save changes/i }).click();

      // Mutation success closes the dialog
      await expect(page.getByRole('dialog', { name: /edit product/i })).toBeHidden({
        timeout: 5000,
      });

      // Verify updated description is rendered in the list
      await expect(page.getByText(/Updated description with new features/i)).toBeVisible({
        timeout: 5000,
      });
    });

    test('should delete product via API', async ({ page }) => {
      await createAdminUser(page);

      // Create test product to delete
      const { product } = await seedTestProduct({ name: 'Product To Delete' });

      // Get CSRF token
      const csrfResponse = await page.request.get('/api/csrf-token');
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.data.csrfToken;

      // Delete product via API
      const response = await page.request.delete(`/api/admin/products/${product.id}`, {
        headers: {
          'x-csrf-token': csrfToken,
        },
      });

      expect(response.status()).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.message).toMatch(/deleted/i);

      // Verify product is actually deleted
      const getResponse = await page.request.get(`/api/admin/products/${product.id}`);
      expect(getResponse.status()).toBe(404);
    });

    test('should delete product via UI', async ({ page }) => {
      await createAdminUser(page);
      const { product } = await seedTestProduct({ name: 'UI Delete Product' });

      await page.goto('/admin/products');
      await page.waitForLoadState('networkidle');

      await page.getByRole('tab', { name: /^products$/i }).click();

      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      await page.getByTestId(`admin-product-delete-${product.id}`).click();

      // Toast renders in multiple places (region + aria-live); use a strict single locator
      await expect(page.getByText('Product Deleted', { exact: true })).toBeVisible({
        timeout: 5000,
      });
    });

    test('should list all products in admin view', async ({ page }) => {
      await createAdminUser(page);

      // Create multiple test products
      await seedMultipleProducts(3);

      // Navigate to admin page
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Click on Products tab to view products
      await page.getByRole('tab', { name: /^products$/i }).click();

      // Wait for tab content to load before verification
      await page
        .getByText(/bulk product/i)
        .first()
        .waitFor({
          state: 'visible',
          timeout: 5000,
        });

      // Verify products content is visible
      // seedMultipleProducts creates products named "Bulk Product 1", "Bulk Product 2", etc.
      await expect(page.getByText(/bulk product/i).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Performance Monitoring', () => {
    test('should fetch performance statistics', async ({ page }) => {
      await createAdminUser(page);

      // Make a direct API call to performance stats endpoint
      const response = await page.request.get('/api/admin/performance/stats');

      expect(response.status()).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeDefined();

      // Performance stats should include basic metrics
      const stats = responseData.data;
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('averageDuration');
    });

    test('should fetch slowest endpoints', async ({ page }) => {
      await createAdminUser(page);

      // Make a direct API call to slowest endpoints
      const response = await page.request.get('/api/admin/performance/slowest?limit=5');

      expect(response.status()).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(Array.isArray(responseData.data)).toBe(true);
    });

    test('should display real-time monitoring dashboard', async ({ page }) => {
      await createAdminUser(page);

      await page.goto('/monitoring');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: /AI Agent Monitoring/i })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(/System Health/i)).toBeVisible();
    });
  });

  test.describe('User Management', () => {
    test('should list all users', async ({ page }) => {
      await createAdminUser(page);

      // Create additional test users
      await logoutUser(page);
      await registerUser(page, 'testuser1', 'user1@example.com', 'TestUserPass123!');
      await logoutUser(page);
      await registerUser(page, 'testuser2', 'user2@example.com', 'TestUserPass123!');
      await logoutUser(page);

      // Login as admin
      await loginUser(page, 'admin@pricecompare.com', 'AdminPass123!');

      // Fetch users via API
      const response = await page.request.get('/api/admin/users');

      expect(response.status()).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(Array.isArray(responseData.data)).toBe(true);
      expect(responseData.data.length).toBeGreaterThanOrEqual(3); // Admin + 2 users
    });

    test('should view user details in modal', async ({ page }) => {
      await createAdminUser(page);

      // Create an additional user to open details for
      await logoutUser(page);
      await registerUser(page, 'modaluser', 'modaluser@example.com', 'TestUserPass123!');
      await logoutUser(page);
      await loginUser(page, 'admin@pricecompare.com', 'AdminPass123!');

      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle');

      await page.getByRole('tab', { name: /users/i }).click();

      const usersResponse = await page.request.get('/api/admin/users');
      expect(usersResponse.status()).toBe(200);
      const usersData = await usersResponse.json();
      const modalUser = (usersData.data as Array<{ id: number; username: string }>).find(
        (u) => u.username === 'modaluser'
      );
      expect(modalUser).toBeDefined();
      // Type assertion: modalUser is verified as defined in previous assertion
      const modalUserId = (modalUser as { id: number }).id;
      await page.getByTestId(`admin-user-view-${modalUserId}`).click();

      await expect(page.getByRole('dialog', { name: /user details/i })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /suspend user|reinstate user/i })
      ).toBeVisible();
    });

    test('should suspend user account', async ({ page }) => {
      await createAdminUser(page);

      await logoutUser(page);
      await registerUser(page, 'suspendme', 'suspendme@example.com', 'TestUserPass123!');
      await logoutUser(page);
      await loginUser(page, 'admin@pricecompare.com', 'AdminPass123!');

      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle');
      await page.getByRole('tab', { name: /users/i }).click();

      const usersResponse = await page.request.get('/api/admin/users');
      expect(usersResponse.status()).toBe(200);
      const usersData = await usersResponse.json();
      const suspendMeUser = (usersData.data as Array<{ id: number; username: string }>).find(
        (u) => u.username === 'suspendme'
      );
      expect(suspendMeUser).toBeDefined();
      // Type assertion: suspendMeUser is verified as defined in previous assertion
      const suspendMeUserId = (suspendMeUser as { id: number }).id;

      await page.getByTestId(`admin-user-view-${suspendMeUserId}`).click();
      await page.getByRole('button', { name: /suspend user/i }).click();

      // Suspension mutation closes the modal on success
      await expect(page.getByRole('dialog', { name: /user details/i })).toBeHidden({
        timeout: 10000,
      });

      // Confirm suspended state via admin users API (more robust than toast assertions)
      await expect
        .poll(
          async () => {
            const refreshed = await page.request.get('/api/admin/users');
            if (!refreshed.ok()) return false;
            const refreshedData = await refreshed.json();
            const refreshedUser = (
              refreshedData.data as Array<{ id: number; isSuspended?: boolean }>
            ).find((u) => u.id === suspendMeUserId);
            return Boolean(refreshedUser?.isSuspended);
          },
          { timeout: 10000 }
        )
        .toBe(true);

      // Verify suspended user cannot login
      await logoutUser(page);

      // Attempt login and assert we see the error (don't use loginUser helper; it expects success)
      await page.goto('/price-watch');
      await page.waitForLoadState('networkidle');
      await page
        .getByRole('button', { name: /sign in/i })
        .first()
        .click();
      await page.waitForSelector('input#email', { state: 'visible', timeout: 5000 });
      await page.getByLabel(/email/i).fill('suspendme@example.com');
      await page
        .getByLabel(/^password$/i)
        .first()
        .fill('TestUserPass123!');
      await page.getByRole('button', { name: /^sign in$/i }).click();

      await expect(page.getByText(/account suspended|account inactive/i)).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe('Admin Creation', () => {
    test('should automatically make first user an admin', async ({ page }) => {
      // Register first user
      const _admin = await createAdminUser(page);

      // Verify admin has access to admin routes
      const response = await page.request.get('/api/admin/users');
      expect(response.status()).toBe(200); // Admin endpoints are accessible
    });

    test('should not make second user an admin', async ({ page }) => {
      // Create first user (admin)
      await createAdminUser(page);
      await logoutUser(page);

      // Create second user (should be regular user)
      await registerUser(page, 'regularuser', 'regular@example.com', 'RegularPass123!');

      // Try to access admin endpoint
      const response = await page.request.get('/api/admin/users');

      // Should get 403 Forbidden or redirect
      expect(response.status()).not.toBe(200);
    });
  });
});
