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

    test.skip('should display user growth chart - UI not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when admin dashboard UI is built
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
          logoUrl: 'https://techmart.com/logo.png',
          isActive: true,
        },
      });

      expect(response.status()).toBe(201);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.name).toBe('TechMart');
    });

    test.skip('should create retailer via UI form - UI not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when retailer creation UI is built
      // Expected flow:
      // 1. Click "Add Retailer" button
      // 2. Fill form with retailer details
      // 3. Upload logo (if supported)
      // 4. Submit form
      // 5. Verify retailer appears in list
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

    test.skip('should edit product via UI form - UI not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when product edit UI is built
      // Expected flow:
      // 1. Navigate to product details
      // 2. Click "Edit Product" button
      // 3. Update description and category fields
      // 4. Save changes
      // 5. Verify updated values display
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

    test.skip('should delete product via UI - UI not yet implemented', async ({ page: _page }) => {
      // TODO: Implement when product deletion UI is built
      // Expected flow:
      // 1. Navigate to admin products page
      // 2. Find product in list
      // 3. Click delete button
      // 4. Confirm deletion in dialog
      // 5. Verify product removed from list
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

    test.skip('should display real-time monitoring dashboard - UI not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when monitoring dashboard UI is built
      // Expected features:
      // - Real-time API response times chart
      // - Database connection pool stats
      // - Scraping job status
      // - System resource usage (CPU, memory)
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

    test.skip('should view user details in modal - UI not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when user management UI is built
      // Expected flow:
      // 1. Navigate to /admin/users
      // 2. Click on a user in the list
      // 3. User details modal opens
      // 4. Modal shows user info and action buttons
      // 5. Options to suspend or promote user
    });

    test.skip('should suspend user account - feature not yet implemented', async ({
      page: _page,
    }) => {
      // TODO: Implement when user suspension feature is added
      // Expected flow:
      // 1. Open user details
      // 2. Click "Suspend User" button
      // 3. Confirm suspension
      // 4. User account is suspended (can't login)
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
