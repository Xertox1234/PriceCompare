/**
 * PriceCompare Extension - Background Service Worker
 * Handles extension lifecycle, messaging, and background tasks
 */

// Extension installation handler
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[PriceCompare] Extension installed/updated', details.reason);

  if (details.reason === 'install') {
    // First time installation
    await chrome.storage.sync.set({
      preferences: {
        enabled: true,
        showOnPageLoad: true,
        defaultTimeRange: 30,
        apiBaseUrl: 'http://localhost:3000/api',
        userEmail: '',
        darkMode: false
      }
    });

    await chrome.storage.local.set({
      stats: {
        productsViewed: 0,
        chartsDisplayed: 0,
        alertsCreated: 0,
        lastUsed: new Date().toISOString()
      },
      recentProducts: []
    });

    // Open welcome page
    chrome.tabs.create({
      url: 'http://localhost:3000/welcome?source=extension'
    });

    console.log('[PriceCompare] Welcome page opened');
  } else if (details.reason === 'update') {
    // Extension updated
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;

    console.log(`[PriceCompare] Updated from ${previousVersion} to ${currentVersion}`);

    // Show update notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'PriceCompare Updated',
      message: `Extension updated to version ${currentVersion}`
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[PriceCompare] Message received', message);

  switch (message.type) {
    case 'GET_PREFERENCES':
      handleGetPreferences(sendResponse);
      return true; // Async response

    case 'UPDATE_PREFERENCES':
      handleUpdatePreferences(message.preferences, sendResponse);
      return true;

    case 'GET_STATS':
      handleGetStats(sendResponse);
      return true;

    case 'UPDATE_STATS':
      handleUpdateStats(message.stats, sendResponse);
      return true;

    case 'CLEAR_CACHE':
      handleClearCache(sendResponse);
      return true;

    case 'TRACK_EVENT':
      handleTrackEvent(message.event, message.data);
      return false; // Sync response

    case 'SHOW_NOTIFICATION':
      handleShowNotification(message.title, message.message);
      return false;

    default:
      console.warn('[PriceCompare] Unknown message type', message.type);
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

// Get preferences
async function handleGetPreferences(sendResponse) {
  try {
    const result = await chrome.storage.sync.get(['preferences']);
    const defaults = {
      enabled: true,
      showOnPageLoad: true,
      defaultTimeRange: 30,
      apiBaseUrl: 'http://localhost:3000/api',
      userEmail: '',
      darkMode: false
    };
    const preferences = { ...defaults, ...result.preferences };
    sendResponse({ success: true, preferences });
  } catch (error) {
    console.error('[PriceCompare] Failed to get preferences', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Update preferences
async function handleUpdatePreferences(updates, sendResponse) {
  try {
    const result = await chrome.storage.sync.get(['preferences']);
    const current = result.preferences || {};
    const updated = { ...current, ...updates };

    await chrome.storage.sync.set({ preferences: updated });
    console.log('[PriceCompare] Preferences updated', updated);

    sendResponse({ success: true, preferences: updated });
  } catch (error) {
    console.error('[PriceCompare] Failed to update preferences', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get stats
async function handleGetStats(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['stats']);
    const stats = result.stats || {
      productsViewed: 0,
      chartsDisplayed: 0,
      alertsCreated: 0,
      lastUsed: null
    };
    sendResponse({ success: true, stats });
  } catch (error) {
    console.error('[PriceCompare] Failed to get stats', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Update stats
async function handleUpdateStats(updates, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['stats']);
    const current = result.stats || {
      productsViewed: 0,
      chartsDisplayed: 0,
      alertsCreated: 0,
      lastUsed: null
    };
    const updated = {
      ...current,
      ...updates,
      lastUsed: new Date().toISOString()
    };

    await chrome.storage.local.set({ stats: updated });
    console.log('[PriceCompare] Stats updated', updated);

    sendResponse({ success: true, stats: updated });
  } catch (error) {
    console.error('[PriceCompare] Failed to update stats', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Clear cache
async function handleClearCache(sendResponse) {
  try {
    // Clear local storage (keeps sync data)
    const syncData = await chrome.storage.sync.get(null);
    await chrome.storage.local.clear();

    console.log('[PriceCompare] Cache cleared');

    sendResponse({ success: true });
  } catch (error) {
    console.error('[PriceCompare] Failed to clear cache', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Track event (analytics)
function handleTrackEvent(event, data) {
  console.log('[PriceCompare] Event tracked', event, data);

  // Could send to analytics service here
  // For now, just log to console
}

// Show notification
function handleShowNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message
  });
}

// Browser action (icon) click handler
chrome.action.onClicked.addListener((tab) => {
  console.log('[PriceCompare] Extension icon clicked');

  // Open popup (this is handled automatically if popup is defined in manifest)
  // This handler only fires if no popup is defined
});

// Context menu integration
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'pricecompare-search',
    title: 'Search in PriceCompare',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'pricecompare-add-product',
    title: 'Add this product to PriceCompare',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'pricecompare-search') {
    const searchQuery = info.selectionText;
    chrome.tabs.create({
      url: `http://localhost:3000/search?q=${encodeURIComponent(searchQuery)}`
    });
  } else if (info.menuItemId === 'pricecompare-add-product') {
    chrome.tabs.create({
      url: `http://localhost:3000/add-product?url=${encodeURIComponent(tab.url)}`
    });
  }
});

// Alarm for periodic tasks
chrome.alarms.create('pricecompare-sync', {
  periodInMinutes: 60 // Check every hour
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pricecompare-sync') {
    console.log('[PriceCompare] Running periodic sync');
    // Could sync data, check for updates, etc.
  }
});

// Listen for tab updates to inject content scripts dynamically
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = tab.url.toLowerCase();

    // Check if it's a supported retailer
    const supportedRetailers = [
      'amazon.com',
      'bestbuy.com',
      'walmart.com',
      'target.com',
      'ebay.com'
    ];

    const isSupported = supportedRetailers.some((retailer) => url.includes(retailer));

    if (isSupported) {
      console.log('[PriceCompare] Supported retailer page detected', tab.url);
      // Content scripts are already injected via manifest
      // This is just for logging/tracking
    }
  }
});

// Handle extension uninstall
chrome.runtime.setUninstallURL('http://localhost:3000/uninstall-feedback');

console.log('[PriceCompare] Background service worker initialized');
