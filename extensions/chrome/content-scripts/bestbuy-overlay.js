/**
 * PriceCompare Extension - Best Buy Content Script
 * Injects price history chart on Best Buy product pages
 */

(function () {
  'use strict';

  let overlayInjected = false;
  let currentProductData = null;

  /**
   * Check if we're on a product page
   */
  function isProductPage() {
    return (
      window.location.pathname.includes('/site/') &&
      (window.location.pathname.includes('/p/') || window.location.pathname.includes('/product/'))
    );
  }

  /**
   * Extract product SKU from URL or page
   */
  function extractSKU() {
    // Try URL first - Best Buy uses format: /site/product-name/skuId.p
    const urlMatch = window.location.pathname.match(/\/(\d{7,10})\.p/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Try data attribute
    const skuElement = document.querySelector('[data-sku-id]');
    if (skuElement) {
      return skuElement.getAttribute('data-sku-id');
    }

    // Try JSON-LD data
    const scriptTags = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scriptTags) {
      try {
        const data = JSON.parse(script.textContent);
        if (data.sku) {
          return data.sku;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    return null;
  }

  /**
   * Extract product title
   */
  function extractTitle() {
    const selectors = [
      'h1.sku-title',
      '[data-testid="product-title"]',
      '.sku-header h1',
      'h1[itemprop="name"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return 'Unknown Product';
  }

  /**
   * Extract current price
   */
  function extractPrice() {
    const selectors = [
      '[data-testid="customer-price"] span',
      '.priceView-customer-price span',
      '.priceView-hero-price span',
      '[aria-label*="price"] span'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.textContent.trim();
        const match = priceText.match(/[\d,]+\.?\d*/);
        if (match) {
          return parseFloat(match[0].replace(',', ''));
        }
      }
    }

    return null;
  }

  /**
   * Find insertion point for overlay
   */
  function findInsertionPoint() {
    const selectors = [
      '.shop-product-reviews',
      '[data-testid="shop-product-reviews"]',
      '.shop-product-specs',
      '.product-details',
      '.shop-overview'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }

    // Fallback: insert in main content
    return document.querySelector('main') || document.querySelector('.shop-container');
  }

  /**
   * Create overlay container
   */
  function createOverlay() {
    const overlay = createElement('div', {
      className: 'pricecompare-overlay',
      id: 'pricecompare-overlay'
    });

    // Header
    const header = createElement('div', {
      className: 'pricecompare-header'
    });

    const title = createElement(
      'h3',
      {
        className: 'pricecompare-title'
      },
      'Price History'
    );

    const badge = createElement(
      'span',
      {
        className: 'pricecompare-badge'
      },
      'PriceCompare'
    );

    const closeBtn = createElement(
      'button',
      {
        className: 'pricecompare-close'
      },
      '×'
    );

    closeBtn.addEventListener('click', () => {
      overlay.remove();
      overlayInjected = false;
    });

    header.appendChild(title);
    header.appendChild(badge);
    overlay.appendChild(header);
    overlay.appendChild(closeBtn);

    // Content container
    const content = createElement('div', {
      className: 'pricecompare-content',
      id: 'pricecompare-content'
    });

    overlay.appendChild(content);

    return overlay;
  }

  /**
   * Show loading state
   */
  function showLoading(container) {
    container.innerHTML = `
      <div class="pricecompare-loading">
        <div class="pricecompare-spinner"></div>
        <p class="pricecompare-loading-text">Loading price history...</p>
      </div>
    `;
  }

  /**
   * Show error state
   */
  function showError(container, message) {
    container.innerHTML = `
      <div class="pricecompare-error">
        <h4 class="pricecompare-error-title">Unable to Load Price History</h4>
        <p class="pricecompare-error-message">${message}</p>
      </div>
    `;
  }

  /**
   * Render price summary
   */
  function renderSummary(history, trend) {
    if (!history || history.length === 0) {
      return '';
    }

    const prices = history.map((h) => h.price);
    const currentPrice = prices[prices.length - 1];
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    return `
      <div class="pricecompare-summary">
        <div class="pricecompare-stat">
          <div class="pricecompare-stat-label">Current Price</div>
          <div class="pricecompare-stat-value">${formatPrice(currentPrice)}</div>
        </div>
        <div class="pricecompare-stat">
          <div class="pricecompare-stat-label">Average Price</div>
          <div class="pricecompare-stat-value">${formatPrice(avgPrice)}</div>
        </div>
        <div class="pricecompare-stat">
          <div class="pricecompare-stat-label">Lowest Price</div>
          <div class="pricecompare-stat-value positive">${formatPrice(lowestPrice)}</div>
        </div>
        <div class="pricecompare-stat">
          <div class="pricecompare-stat-label">Highest Price</div>
          <div class="pricecompare-stat-value negative">${formatPrice(highestPrice)}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render simple ASCII chart
   */
  function renderSimpleChart(history) {
    if (!history || history.length === 0) {
      return '<p>No price history available.</p>';
    }

    const prices = history.map((h) => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;

    const height = 15;
    const width = Math.min(history.length, 60);

    let chart = '<div class="pricecompare-simple-chart">';

    for (let y = height; y >= 0; y--) {
      let line = '';
      const threshold = min + (range * y) / height;

      for (let x = 0; x < width; x++) {
        const dataIndex = Math.floor((x * history.length) / width);
        const price = prices[dataIndex];

        if (price >= threshold) {
          line += '█';
        } else {
          line += ' ';
        }
      }

      const label = formatPrice(threshold).padStart(8);
      chart += `<div class="pricecompare-chart-line">${label} │${line}</div>`;
    }

    chart += '</div>';
    return chart;
  }

  /**
   * Render price history chart
   */
  async function renderChart(container, productId) {
    try {
      // Get price history
      const history = await api.getPriceHistory(productId, 30);
      const trend = await api.getPriceTrend(productId);

      if (!history || history.length === 0) {
        showError(container, 'No price history available for this product yet.');
        return;
      }

      // Render summary
      const summaryHTML = renderSummary(history, trend);

      // Render chart
      const chartHTML = renderSimpleChart(history);

      // Render alert section
      const currentPrice = extractPrice();
      const alertHTML = `
        <div class="pricecompare-alert-section">
          <h4 class="pricecompare-alert-title">Set Price Alert</h4>
          <div class="pricecompare-alert-form">
            <input
              type="email"
              class="pricecompare-alert-input"
              id="pricecompare-email"
              placeholder="your@email.com"
              value="${await storage.get('userEmail', '')}"
            />
            <input
              type="number"
              class="pricecompare-alert-input"
              id="pricecompare-target-price"
              placeholder="Target price"
              step="0.01"
              value="${currentPrice ? (currentPrice * 0.9).toFixed(2) : ''}"
            />
            <button class="pricecompare-alert-btn" id="pricecompare-create-alert">
              Create Alert
            </button>
          </div>
        </div>
      `;

      // Footer
      const footerHTML = `
        <div class="pricecompare-footer">
          Powered by <a href="http://localhost:3000" target="_blank">PriceCompare</a>
          • Track more products on our platform
        </div>
      `;

      // Combine all
      container.innerHTML = summaryHTML + chartHTML + alertHTML + footerHTML;

      // Attach alert button handler
      const alertBtn = document.getElementById('pricecompare-create-alert');
      if (alertBtn) {
        alertBtn.addEventListener('click', async () => {
          const email = document.getElementById('pricecompare-email').value;
          const targetPrice = parseFloat(
            document.getElementById('pricecompare-target-price').value
          );

          if (!email || !targetPrice) {
            alert('Please enter both email and target price');
            return;
          }

          try {
            alertBtn.disabled = true;
            alertBtn.textContent = 'Creating...';

            await api.createPriceAlert(productId, targetPrice, email);
            await storage.set('userEmail', email);
            await storage.updateStats({
              alertsCreated: (await storage.getStats()).alertsCreated + 1
            });

            alert('Price alert created successfully!');
            alertBtn.textContent = 'Alert Created ✓';
          } catch (error) {
            alert('Failed to create alert: ' + error.message);
            alertBtn.disabled = false;
            alertBtn.textContent = 'Create Alert';
          }
        });
      }

      // Update stats
      await storage.updateStats({
        chartsDisplayed: (await storage.getStats()).chartsDisplayed + 1
      });
    } catch (error) {
      logError('Failed to render chart', error);
      showError(container, 'Failed to load price data. Please try again later.');
    }
  }

  /**
   * Inject overlay into page
   */
  async function injectOverlay() {
    if (overlayInjected) {
      log('Overlay already injected');
      return;
    }

    // Check preferences
    const prefs = await storage.getPreferences();
    if (!prefs.enabled) {
      log('Extension disabled by user');
      return;
    }

    // Get product info
    const sku = extractSKU();
    if (!sku) {
      log('Could not extract SKU from page');
      return;
    }

    const productUrl = window.location.href;
    const title = extractTitle();
    const currentPrice = extractPrice();

    log('Product detected', { sku, title, currentPrice });

    // Search for product in PriceCompare
    const product = await api.searchProductByUrl(productUrl);

    if (!product) {
      log('Product not found in PriceCompare database');
      return;
    }

    currentProductData = product;

    // Track view
    await api.trackProductView(product.id);
    await storage.addRecentProduct({
      id: product.id,
      title: title,
      url: productUrl,
      currentPrice: currentPrice
    });
    await storage.updateStats({ productsViewed: (await storage.getStats()).productsViewed + 1 });

    // Create and inject overlay
    const overlay = createOverlay();
    const insertionPoint = findInsertionPoint();

    if (!insertionPoint) {
      log('Could not find insertion point');
      return;
    }

    insertionPoint.parentNode.insertBefore(overlay, insertionPoint.nextSibling);
    overlayInjected = true;

    // Show loading and fetch data
    const content = document.getElementById('pricecompare-content');
    showLoading(content);
    await renderChart(content, product.id);

    log('Overlay injected successfully');
  }

  /**
   * Initialize extension
   */
  async function init() {
    if (!isProductPage()) {
      log('Not a product page');
      return;
    }

    log('Best Buy product page detected');

    // Wait for page to stabilize
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(injectOverlay, 1500);
      });
    } else {
      setTimeout(injectOverlay, 1500);
    }

    // Listen for URL changes
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      const url = window.location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        overlayInjected = false;
        currentProductData = null;
        if (isProductPage()) {
          setTimeout(injectOverlay, 1500);
        }
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // Start
  init();
})();
