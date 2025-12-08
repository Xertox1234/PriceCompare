/**
 * Storage utilities for PriceCompare extension
 * Wraps Chrome storage API with convenient methods
 */

class ExtensionStorage {
  /**
   * Get value from storage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if not found
   * @returns {Promise<any>} Stored value
   */
  async get(key, defaultValue = null) {
    try {
      const result = await chrome.storage.sync.get([key]);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      logError(`Failed to get ${key} from storage`, error);
      return defaultValue;
    }
  }

  /**
   * Set value in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
      log(`Stored ${key} in storage`);
    } catch (error) {
      logError(`Failed to set ${key} in storage`, error);
      throw error;
    }
  }

  /**
   * Remove value from storage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      await chrome.storage.sync.remove(key);
      log(`Removed ${key} from storage`);
    } catch (error) {
      logError(`Failed to remove ${key} from storage`, error);
      throw error;
    }
  }

  /**
   * Clear all storage
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      await chrome.storage.sync.clear();
      log('Cleared all storage');
    } catch (error) {
      logError('Failed to clear storage', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   * @returns {Promise<Object>} User preferences
   */
  async getPreferences() {
    const defaults = {
      enabled: true,
      showOnPageLoad: true,
      defaultTimeRange: 30,
      apiBaseUrl: 'http://localhost:3000/api',
      userEmail: '',
      darkMode: false
    };

    try {
      const result = await chrome.storage.sync.get(['preferences']);
      return { ...defaults, ...result.preferences };
    } catch (error) {
      logError('Failed to get preferences', error);
      return defaults;
    }
  }

  /**
   * Save user preferences
   * @param {Object} preferences - Preferences to save
   * @returns {Promise<void>}
   */
  async savePreferences(preferences) {
    try {
      const current = await this.getPreferences();
      const updated = { ...current, ...preferences };
      await chrome.storage.sync.set({ preferences: updated });
      log('Saved preferences', updated);
    } catch (error) {
      logError('Failed to save preferences', error);
      throw error;
    }
  }

  /**
   * Get recently viewed products
   * @param {number} limit - Maximum number to return
   * @returns {Promise<Array>} Recent products
   */
  async getRecentProducts(limit = 10) {
    try {
      const result = await chrome.storage.local.get(['recentProducts']);
      const recent = result.recentProducts || [];
      return recent.slice(0, limit);
    } catch (error) {
      logError('Failed to get recent products', error);
      return [];
    }
  }

  /**
   * Add product to recent list
   * @param {Object} product - Product data
   * @returns {Promise<void>}
   */
  async addRecentProduct(product) {
    try {
      const recent = await this.getRecentProducts(50);

      // Remove if already exists
      const filtered = recent.filter((p) => p.id !== product.id);

      // Add to front
      const updated = [
        {
          ...product,
          viewedAt: new Date().toISOString()
        },
        ...filtered
      ].slice(0, 50); // Keep max 50

      await chrome.storage.local.set({ recentProducts: updated });
      log('Added recent product', product);
    } catch (error) {
      logError('Failed to add recent product', error);
    }
  }

  /**
   * Get cached price data
   * @param {number} productId - Product ID
   * @returns {Promise<Object|null>} Cached data or null
   */
  async getCachedPriceData(productId) {
    try {
      const key = `priceData_${productId}`;
      const result = await chrome.storage.local.get([key]);
      const cached = result[key];

      if (!cached) return null;

      // Check if cache is still valid (5 minutes)
      const age = Date.now() - cached.timestamp;
      if (age > 5 * 60 * 1000) {
        await chrome.storage.local.remove(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      logError('Failed to get cached price data', error);
      return null;
    }
  }

  /**
   * Cache price data
   * @param {number} productId - Product ID
   * @param {Object} data - Price data to cache
   * @returns {Promise<void>}
   */
  async cachePriceData(productId, data) {
    try {
      const key = `priceData_${productId}`;
      await chrome.storage.local.set({
        [key]: {
          data,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      logError('Failed to cache price data', error);
    }
  }

  /**
   * Get statistics
   * @returns {Promise<Object>} Usage statistics
   */
  async getStats() {
    try {
      const result = await chrome.storage.local.get(['stats']);
      return (
        result.stats || {
          productsViewed: 0,
          chartsDisplayed: 0,
          alertsCreated: 0,
          lastUsed: null
        }
      );
    } catch (error) {
      logError('Failed to get stats', error);
      return {
        productsViewed: 0,
        chartsDisplayed: 0,
        alertsCreated: 0,
        lastUsed: null
      };
    }
  }

  /**
   * Update statistics
   * @param {Object} updates - Stats to update
   * @returns {Promise<void>}
   */
  async updateStats(updates) {
    try {
      const current = await this.getStats();
      const updated = {
        ...current,
        ...updates,
        lastUsed: new Date().toISOString()
      };
      await chrome.storage.local.set({ stats: updated });
    } catch (error) {
      logError('Failed to update stats', error);
    }
  }
}

// Create global instance
const storage = new ExtensionStorage();
