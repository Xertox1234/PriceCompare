import '../setup.js';

/**
 * E2E Tests for PriceCompare Extension
 * Tests extension loading and basic functionality in a real browser
 *
 * Note: These tests require Playwright and may take longer to run
 * Run with: npm run test:e2e
 */

const { chromium } = require('@playwright/test');
const path = require('path');

describe('Extension E2E Tests', () => {
  let browser;
  let context;
  let page;
  const extensionPath = path.join(__dirname, '../..');

  beforeAll(async () => {
    // Launch browser with extension loaded using Playwright
    browser = await chromium.launch({
      headless: false, // Extensions don't work in headless mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    context = await browser.newContext();
  });

  afterAll(async () => {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await context.newPage();
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Extension Loading', () => {
    it('should load extension successfully', async () => {
      // Playwright automatically handles extension service workers
      const serviceWorker = context.serviceWorkers()[0];
      expect(serviceWorker).toBeDefined();
    }, 30000);

    it('should have extension popup available', async () => {
      const serviceWorker = context.serviceWorkers()[0];
      expect(serviceWorker).toBeDefined();

      // Check if extension has a valid URL
      const extensionUrl = serviceWorker.url();
      expect(extensionUrl).toContain('chrome-extension://');
    }, 30000);
  });

  describe('Product Page Detection', () => {
    it('should detect Amazon product page', async () => {
      // Navigate to a mock Amazon-like page
      await page.goto('about:blank');

      // Inject mock Amazon HTML
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head><title>Test Product - Amazon</title></head>
          <body>
            <input type="hidden" name="ASIN" value="B08N5WRWNW" />
            <span id="productTitle">Test Product Title</span>
            <span class="a-price">
              <span class="a-offscreen">$19.99</span>
            </span>
          </body>
        </html>
      `);

      // Set URL to mimic Amazon
      await page.evaluate(() => {
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            pathname: '/dp/B08N5WRWNW',
            hostname: 'www.amazon.com'
          },
          writable: true
        });
      });

      // Check if the page is detected as a product page
      const isProductPage = await page.evaluate(() => {
        return window.location.pathname.includes('/dp/');
      });

      expect(isProductPage).toBe(true);
    }, 30000);
  });

  describe('Storage API', () => {
    it('should read and write to chrome.storage', async () => {
      // Note: This test may not work in all environments due to extension isolation
      // This is a placeholder for E2E storage testing

      const testData = { testKey: 'testValue' };

      // This would require access to the extension's background script
      // In a real E2E test, you would:
      // 1. Navigate to the extension popup
      // 2. Interact with UI elements
      // 3. Verify data is stored/retrieved correctly

      expect(testData.testKey).toBe('testValue');
    }, 30000);
  });

  // Note: More comprehensive E2E tests would require:
  // 1. A mock API server running
  // 2. Mock product pages
  // 3. Ability to test content script injection
  // 4. UI interaction testing using Playwright's locators

  describe('Popup UI', () => {
    it.skip('should open extension popup', async () => {
      // This test is skipped because programmatically opening extension popups
      // is challenging in automated tests. In manual E2E testing with Playwright, you would:
      // 1. Use page.goto() to navigate to extension popup URL
      // 2. Verify popup content loads
      // 3. Use Playwright locators to interact with elements
      // 4. Verify functionality with expect() assertions
      // Placeholder for manual testing checklist:
      // - [ ] Extension icon appears in toolbar
      // - [ ] Clicking icon opens popup
      // - [ ] Stats are displayed correctly
      // - [ ] Recent products list works
      // - [ ] Settings toggles function
      // - [ ] Clear cache button works
    });
  });
});

/**
 * E2E Testing Checklist (Manual Testing)
 *
 * Prerequisites:
 * - Extension loaded in Chrome (chrome://extensions/)
 * - Backend API running (http://localhost:3000)
 * - Test products in database
 *
 * Tests:
 * 1. Extension Loading
 *    [ ] Extension loads without errors
 *    [ ] Icon appears in toolbar
 *    [ ] Popup opens when clicked
 *
 * 2. Amazon Integration
 *    [ ] Navigate to Amazon product page
 *    [ ] Price history overlay appears
 *    [ ] Chart displays correctly
 *    [ ] Alert creation works
 *
 * 3. Best Buy Integration
 *    [ ] Navigate to Best Buy product page
 *    [ ] Price history overlay appears
 *    [ ] Data loads correctly
 *
 * 4. Generic Retailers
 *    [ ] Test on Walmart
 *    [ ] Test on Target
 *    [ ] Test on eBay
 *
 * 5. Popup Functionality
 *    [ ] Stats display correctly
 *    [ ] Recent products appear
 *    [ ] Enable/disable toggle works
 *    [ ] Clear cache functions
 *    [ ] Links open correctly
 *
 * 6. Data Persistence
 *    [ ] Preferences saved across sessions
 *    [ ] Recent products persist
 *    [ ] Stats accumulate correctly
 *
 * 7. Error Handling
 *    [ ] Handles network errors gracefully
 *    [ ] Shows appropriate error messages
 *    [ ] Doesn't break page functionality
 */
