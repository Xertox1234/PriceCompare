/**
 * PriceCompare Extension Popup Script
 */

// DOM Elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const productsViewedEl = document.getElementById('products-viewed');
const chartsDisplayedEl = document.getElementById('charts-displayed');
const alertsCreatedEl = document.getElementById('alerts-created');
const recentProductsEl = document.getElementById('recent-products');
const openDashboardBtn = document.getElementById('open-dashboard');
const clearCacheBtn = document.getElementById('clear-cache');
const enabledToggle = document.getElementById('enabled-toggle');
const autoShowToggle = document.getElementById('auto-show-toggle');
const settingsLink = document.getElementById('settings-link');

/**
 * Initialize popup
 */
async function init() {
  console.log('[PriceCompare Popup] Initializing...');

  // Load stats
  await loadStats();

  // Load recent products
  await loadRecentProducts();

  // Load preferences
  await loadPreferences();

  // Setup event listeners
  setupEventListeners();

  console.log('[PriceCompare Popup] Initialized');
}

/**
 * Load statistics
 */
async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['stats']);
    const stats = result.stats || {
      productsViewed: 0,
      chartsDisplayed: 0,
      alertsCreated: 0
    };

    productsViewedEl.textContent = stats.productsViewed;
    chartsDisplayedEl.textContent = stats.chartsDisplayed;
    alertsCreatedEl.textContent = stats.alertsCreated;

    console.log('[PriceCompare Popup] Stats loaded', stats);
  } catch (error) {
    console.error('[PriceCompare Popup] Failed to load stats', error);
  }
}

/**
 * Load recent products
 */
async function loadRecentProducts() {
  try {
    const result = await chrome.storage.local.get(['recentProducts']);
    const products = result.recentProducts || [];

    if (products.length === 0) {
      recentProductsEl.innerHTML = '<p class="empty-state">No recent products</p>';
      return;
    }

    // Show up to 5 recent products
    const recentProducts = products.slice(0, 5);

    recentProductsEl.innerHTML = recentProducts
      .map((product) => {
        const timeAgo = getTimeAgo(new Date(product.viewedAt));
        return `
        <div class="recent-product" data-url="${product.url}">
          <div class="product-name">${escapeHtml(product.title)}</div>
          <div class="product-meta">
            <span class="product-time">${timeAgo}</span>
            <span class="product-price">${product.currentPrice ? '$' + product.currentPrice.toFixed(2) : 'N/A'}</span>
          </div>
        </div>
      `;
      })
      .join('');

    // Add click handlers
    document.querySelectorAll('.recent-product').forEach((el) => {
      el.addEventListener('click', () => {
        const url = el.getAttribute('data-url');
        chrome.tabs.create({ url });
      });
    });

    console.log('[PriceCompare Popup] Recent products loaded', recentProducts.length);
  } catch (error) {
    console.error('[PriceCompare Popup] Failed to load recent products', error);
    recentProductsEl.innerHTML = '<p class="empty-state">Failed to load products</p>';
  }
}

/**
 * Load preferences
 */
async function loadPreferences() {
  try {
    const result = await chrome.storage.sync.get(['preferences']);
    const prefs = result.preferences || {
      enabled: true,
      showOnPageLoad: true
    };

    enabledToggle.checked = prefs.enabled;
    autoShowToggle.checked = prefs.showOnPageLoad;

    // Update status
    updateStatus(prefs.enabled);

    console.log('[PriceCompare Popup] Preferences loaded', prefs);
  } catch (error) {
    console.error('[PriceCompare Popup] Failed to load preferences', error);
  }
}

/**
 * Update status indicator
 */
function updateStatus(enabled) {
  if (enabled) {
    statusIndicator.classList.remove('inactive');
    statusText.textContent = 'Active';
  } else {
    statusIndicator.classList.add('inactive');
    statusText.textContent = 'Disabled';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Open dashboard
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
  });

  // Clear cache
  clearCacheBtn.addEventListener('click', async () => {
    clearCacheBtn.disabled = true;
    clearCacheBtn.textContent = 'Clearing...';

    try {
      // Clear local storage except preferences
      const sync = await chrome.storage.sync.get(null);
      await chrome.storage.local.clear();

      // Reset stats
      await chrome.storage.local.set({
        stats: {
          productsViewed: 0,
          chartsDisplayed: 0,
          alertsCreated: 0,
          lastUsed: new Date().toISOString()
        },
        recentProducts: []
      });

      // Reload UI
      await loadStats();
      await loadRecentProducts();

      clearCacheBtn.textContent = 'Cleared!';
      setTimeout(() => {
        clearCacheBtn.textContent = 'Clear Cache';
        clearCacheBtn.disabled = false;
      }, 2000);

      console.log('[PriceCompare Popup] Cache cleared');
    } catch (error) {
      console.error('[PriceCompare Popup] Failed to clear cache', error);
      clearCacheBtn.textContent = 'Error';
      setTimeout(() => {
        clearCacheBtn.textContent = 'Clear Cache';
        clearCacheBtn.disabled = false;
      }, 2000);
    }
  });

  // Enabled toggle
  enabledToggle.addEventListener('change', async () => {
    try {
      const result = await chrome.storage.sync.get(['preferences']);
      const prefs = result.preferences || {};
      prefs.enabled = enabledToggle.checked;

      await chrome.storage.sync.set({ preferences: prefs });
      updateStatus(prefs.enabled);

      console.log('[PriceCompare Popup] Extension', prefs.enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('[PriceCompare Popup] Failed to update enabled state', error);
    }
  });

  // Auto-show toggle
  autoShowToggle.addEventListener('change', async () => {
    try {
      const result = await chrome.storage.sync.get(['preferences']);
      const prefs = result.preferences || {};
      prefs.showOnPageLoad = autoShowToggle.checked;

      await chrome.storage.sync.set({ preferences: prefs });

      console.log('[PriceCompare Popup] Auto-show', prefs.showOnPageLoad ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('[PriceCompare Popup] Failed to update auto-show', error);
    }
  });

  // Settings link
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'http://localhost:3000/settings' });
  });
}

/**
 * Get human-readable time ago
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + 'y ago';

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + 'mo ago';

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + 'd ago';

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + 'h ago';

  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + 'm ago';

  return 'Just now';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
