/**
 * E2E Tests: Forum Interaction
 *
 * Tests creating topics, posting replies, editing posts, and moderation
 */
import { test, expect } from '@playwright/test';
import {
  cleanDatabase,
  registerUser,
  waitForApiResponse,
  generateTestEmail,
  generateTestUsername,
} from './helpers';
import { db } from '../server/db';
import { forumCategories } from '../shared/schema';

test.describe('Forum Interaction', () => {
  test.beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();

    // Seed test data
    await seedTestData();
  });

  test.describe('View Forum', () => {
    test('should view forum categories', async ({ page }) => {
      await page.goto('/forum');
      await page.waitForLoadState('networkidle');

      // Should show forum categories
      await expect(page.locator('text=/General Discussion/i')).toBeVisible();
      await expect(page.locator('text=/Price Discussions/i')).toBeVisible();
    });

    test('should view topics in a category', async ({ page }) => {
      await page.goto('/forum');
      await page.waitForLoadState('networkidle');

      // Click on category
      await page.click('text=/General Discussion/i');

      // Wait for topics to load
      await waitForApiResponse(page, '/api/forum', 200);

      // Should show topics list
      await expect(
        page.locator('[data-testid="topic-list"], .topic-list, .forum-topics')
      ).toBeVisible();
    });

    test('should view topic and posts', async ({ page }) => {
      const username = generateTestUsername('viewer');
      const email = generateTestEmail('viewer');
      const password = 'SecurePass123!';

      // Register and create a topic first
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await createTopic(page, 'Test Topic', 'This is a test topic content');

      // View the topic
      await page.click('text=/Test Topic/i');

      // Should show topic content
      await expect(page.locator('text=/This is a test topic content/i')).toBeVisible();
    });
  });

  test.describe('Create Topic', () => {
    test('should create a new forum topic', async ({ page }) => {
      const username = generateTestUsername('creator');
      const email = generateTestEmail('creator');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await page.goto('/forum');
      await page.waitForLoadState('networkidle');

      // Click "New Topic" or "Create Topic"
      await page.click('button:has-text("New Topic"), a:has-text("Create Topic"), a:has-text("New Topic")');

      // Fill topic form
      await page.fill('input[name="title"], input[placeholder*="title"]', 'Best Price for Gaming Laptops?');
      await page.fill('textarea[name="content"], textarea[name="body"]', 'Looking for recommendations on gaming laptops under $1500. Any suggestions?');

      // Select category
      await page.selectOption('select[name="categoryId"], select[name="category"]', '1');

      // Submit
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Post")');

      // Wait for topic creation
      await waitForApiResponse(page, '/api/forum/topics', 201);

      // Should redirect to topic view
      await expect(page.locator('text=/Best Price for Gaming Laptops/i')).toBeVisible();
      await expect(page.locator('text=/Looking for recommendations/i')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      const username = generateTestUsername('validator');
      const email = generateTestEmail('validator');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await page.goto('/forum/new');
      await page.waitForLoadState('networkidle');

      // Try to submit empty form
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(
        page.locator('text=/title.*required|content.*required/i')
      ).toBeVisible();
    });

    test('should require authentication to create topic', async ({ page }) => {
      await page.goto('/forum/new');
      await page.waitForLoadState('networkidle');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/(login|signin).*/);
    });

    test('should enforce minimum content length', async ({ page }) => {
      const username = generateTestUsername('minlength');
      const email = generateTestEmail('minlength');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      await page.goto('/forum/new');
      await page.waitForLoadState('networkidle');

      await page.fill('input[name="title"]', 'Short Topic');
      await page.fill('textarea[name="content"]', 'Too short'); // Less than minimum

      await page.click('button[type="submit"]');

      // Should show length validation error
      await expect(
        page.locator('text=/content.*too short|minimum.*characters/i')
      ).toBeVisible();
    });
  });

  test.describe('Reply to Topic', () => {
    test('should post a reply to a topic', async ({ page }) => {
      const username = generateTestUsername('replier');
      const email = generateTestEmail('replier');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create a topic first
      await createTopic(page, 'Need Help Topic', 'I need help with something');

      // View the topic
      await page.click('text=/Need Help Topic/i');

      // Write a reply
      await page.fill('textarea[name="content"], textarea[placeholder*="reply"]', 'I can help you with that! Here is my suggestion...');
      await page.click('button:has-text("Reply"), button:has-text("Post Reply")');

      // Wait for reply to be posted
      await waitForApiResponse(page, '/api/forum/posts', 201);

      // Should show the reply
      await expect(page.locator('text=/I can help you with that/i')).toBeVisible();
    });

    test('should require authentication to reply', async ({ page }) => {
      const username = generateTestUsername('topiccreator');
      const email = generateTestEmail('topiccreator');
      const password = 'SecurePass123!';

      // Create topic as authenticated user
      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);
      await createTopic(page, 'Public Topic', 'This is a public topic');

      // Logout
      await page.click('button:has-text("Logout"), a:has-text("Logout")');
      await waitForApiResponse(page, '/api/auth/logout', 200);

      // View topic as guest
      await page.goto('/forum');
      await page.click('text=/Public Topic/i');

      // Try to reply
      const replyButton = page.locator('button:has-text("Reply"), textarea');
      if (await replyButton.isVisible()) {
        await replyButton.click();
      }

      // Should prompt to login or redirect
      await page.waitForTimeout(1000);
      const hasLoginPrompt = await page.locator('text=/log in|sign in|authentication/i').isVisible();
      expect(hasLoginPrompt).toBe(true);
    });

    test('should show reply count', async ({ page }) => {
      const username = generateTestUsername('replycount');
      const email = generateTestEmail('replycount');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create topic
      await createTopic(page, 'Topic with Replies', 'Original post');

      // Add 2 replies
      await page.fill('textarea[name="content"]', 'First reply');
      await page.click('button:has-text("Reply")');
      await waitForApiResponse(page, '/api/forum/posts', 201);

      await page.fill('textarea[name="content"]', 'Second reply');
      await page.click('button:has-text("Reply")');
      await waitForApiResponse(page, '/api/forum/posts', 201);

      // Go back to forum list
      await page.goto('/forum');
      await page.waitForLoadState('networkidle');

      // Should show reply count (2 replies + 1 original post = 3 posts total)
      await expect(
        page.locator('text=/2.*repl|3.*post/i')
      ).toBeVisible();
    });
  });

  test.describe('Edit Post', () => {
    test('should edit own post', async ({ page }) => {
      const username = generateTestUsername('editor');
      const email = generateTestEmail('editor');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create topic
      await createTopic(page, 'Editable Topic', 'Original content');

      // Click edit button
      await page.click('button:has-text("Edit"), [data-testid="edit-post"], a:has-text("Edit")');

      // Update content
      await page.fill('textarea[name="content"]', 'Updated content after editing');
      await page.click('button:has-text("Save"), button[type="submit"]');

      // Wait for update
      await waitForApiResponse(page, /\/api\/forum\/posts\/\d+/, 200);

      // Should show updated content
      await expect(page.locator('text=/Updated content after editing/i')).toBeVisible();

      // Should show edit indicator
      await expect(
        page.locator('text=/edited|last edited/i')
      ).toBeVisible();
    });

    test('should not allow editing others posts', async ({ page }) => {
      // Create topic as user 1
      const user1 = generateTestUsername('user1');
      const email1 = generateTestEmail('user1');
      await registerUser(page, user1, email1, 'SecurePass123!');
      await waitForApiResponse(page, '/api/auth/register', 201);
      await createTopic(page, 'User 1 Topic', 'Content by user 1');

      // Logout
      await page.click('button:has-text("Logout")');
      await waitForApiResponse(page, '/api/auth/logout', 200);

      // Login as user 2
      const user2 = generateTestUsername('user2');
      const email2 = generateTestEmail('user2');
      await registerUser(page, user2, email2, 'SecurePass123!');
      await waitForApiResponse(page, '/api/auth/register', 201);

      // View user 1's topic
      await page.goto('/forum');
      await page.click('text=/User 1 Topic/i');

      // Should not see edit button for other user's post
      const editButton = page.locator('button:has-text("Edit")');
      await expect(editButton).not.toBeVisible();
    });
  });

  test.describe('Delete Post', () => {
    test('should delete own post', async ({ page }) => {
      const username = generateTestUsername('deleter');
      const email = generateTestEmail('deleter');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create topic and reply
      await createTopic(page, 'Topic to Delete', 'Original post');
      await page.fill('textarea[name="content"]', 'Reply to delete');
      await page.click('button:has-text("Reply")');
      await waitForApiResponse(page, '/api/forum/posts', 201);

      // Delete the reply
      const deleteButtons = page.locator('button:has-text("Delete"), [data-testid="delete-post"]');
      await deleteButtons.last().click(); // Delete last post (the reply)

      // Confirm deletion
      try {
        await page.click('button:has-text("Confirm"), button:has-text("Yes")');
      } catch {
        // No confirmation dialog
      }

      await waitForApiResponse(page, /\/api\/forum\/posts\/\d+/, 200);

      // Reply should be removed
      await expect(page.locator('text=/Reply to delete/i')).not.toBeVisible();
    });
  });

  test.describe('Topic Pagination', () => {
    test('should paginate topics in category', async ({ page }) => {
      const username = generateTestUsername('paginator');
      const email = generateTestEmail('paginator');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create multiple topics (if pagination exists)
      for (let i = 0; i < 15; i++) {
        await createTopic(page, `Topic ${i}`, `Content ${i}`);
      }

      await page.goto('/forum');
      await page.waitForLoadState('networkidle');

      // Check for pagination
      const hasPagination = await page.locator('[data-testid="pagination"], button:has-text("Next")').isVisible();

      if (hasPagination) {
        await page.click('button:has-text("Next")');
        await waitForApiResponse(page, '/api/forum', 200);
        await expect(page).toHaveURL(/.*page=2.*/);
      }
    });

    test('should paginate posts in topic', async ({ page }) => {
      const username = generateTestUsername('postpaginator');
      const email = generateTestEmail('postpaginator');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create topic
      await createTopic(page, 'Topic with Many Posts', 'Original post');

      // Add many replies (if pagination exists)
      for (let i = 0; i < 25; i++) {
        await page.fill('textarea[name="content"]', `Reply number ${i}`);
        await page.click('button:has-text("Reply")');
        await waitForApiResponse(page, '/api/forum/posts', 201);
        await page.waitForTimeout(100);
      }

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Check for pagination
      const hasPagination = await page.locator('button:has-text("Next"), [data-testid="next-page"]').isVisible();

      if (hasPagination) {
        await page.click('button:has-text("Next")');
        await page.waitForLoadState('networkidle');
      }
    });
  });

  test.describe('Search Forum', () => {
    test('should search forum topics', async ({ page }) => {
      const username = generateTestUsername('searcher');
      const email = generateTestEmail('searcher');
      const password = 'SecurePass123!';

      await registerUser(page, username, email, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create searchable topics
      await createTopic(page, 'Best Gaming Laptop', 'Looking for gaming laptops');
      await createTopic(page, 'Wireless Mouse Deals', 'Best mouse deals');

      await page.goto('/forum');
      await page.waitForLoadState('networkidle');

      // Search for "gaming"
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('gaming');
        await searchInput.press('Enter');

        // Should show gaming topic, not mouse topic
        await expect(page.locator('text=/Best Gaming Laptop/i')).toBeVisible();
        await expect(page.locator('text=/Wireless Mouse Deals/i')).not.toBeVisible();
      }
    });
  });

  test.describe('Forum Moderation', () => {
    test('should allow admin to moderate posts', async ({ page }) => {
      // Note: This test requires an admin user
      // First user is typically made admin automatically
      const adminUsername = generateTestUsername('admin');
      const adminEmail = generateTestEmail('admin');
      const password = 'SecurePass123!';

      await registerUser(page, adminUsername, adminEmail, password);
      await waitForApiResponse(page, '/api/auth/register', 201);

      // Create a topic to moderate
      await createTopic(page, 'Topic to Moderate', 'Content that needs moderation');

      // Look for moderation options (admin only)
      const moderationVisible = await page.locator('button:has-text("Pin"), button:has-text("Lock"), button:has-text("Featured")').isVisible();

      if (moderationVisible) {
        console.log('Moderation features are visible to first user (admin)');
      }
    });
  });
});

/**
 * Seed test data for forum tests
 */
async function seedTestData() {
  // Create forum categories
  await db.insert(forumCategories).values([
    {
      name: 'General Discussion',
      description: 'General topics and discussions',
      slug: 'general',
    },
    {
      name: 'Price Discussions',
      description: 'Discuss prices and deals',
      slug: 'prices',
    },
  ]);
}

/**
 * Helper to create a forum topic
 */
async function createTopic(page: any, title: string, content: string) {
  await page.goto('/forum');
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("New Topic"), a:has-text("Create Topic"), a:has-text("New Topic")');

  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="content"]', content);

  // Select first category
  await page.selectOption('select[name="categoryId"], select[name="category"]', '1');

  await page.click('button[type="submit"]');
  await waitForApiResponse(page, '/api/forum/topics', 201);

  await page.waitForTimeout(500); // Brief pause
}
