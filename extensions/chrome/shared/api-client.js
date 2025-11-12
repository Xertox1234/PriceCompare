/**
 * API Client for communicating with PriceCompare backend
 */

class PriceCompareAPI {
  constructor() {
    // Default to localhost, but allow configuration
    this.baseUrl = 'http://localhost:3000/api';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Load base URL from storage
    this.loadConfig();
  }

  /**
   * Load configuration from Chrome storage
   */
  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get(['apiBaseUrl']);
      if (result.apiBaseUrl) {
        this.baseUrl = result.apiBaseUrl;
      }
    } catch (error) {
      logError('Failed to load config', error);
    }
  }

  /**
   * Set API base URL
   * @param {string} url - Base URL
   */
  async setBaseUrl(url) {
    this.baseUrl = url;
    await chrome.storage.sync.set({ apiBaseUrl: url });
  }

  /**
   * Make HTTP request to API
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logError(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Get from cache or fetch
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data
   * @returns {Promise<any>} Cached or fresh data
   */
  async getCached(key, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      log(`Using cached data for ${key}`);
      return cached.data;
    }

    const data = await fetchFn();
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    return data;
  }

  /**
   * Search for product by URL
   * @param {string} productUrl - Product URL
   * @returns {Promise<Object|null>} Product data or null
   */
  async searchProductByUrl(productUrl) {
    try {
      const normalizedUrl = normalizeUrl(productUrl);
      const cacheKey = `product:${normalizedUrl}`;

      return await this.getCached(cacheKey, async () => {
        const encodedUrl = encodeURIComponent(normalizedUrl);
        const response = await this.request(`/products/search?url=${encodedUrl}`);
        return response.product || null;
      });
    } catch (error) {
      logError('Failed to search product', error);
      return null;
    }
  }

  /**
   * Get price history for a product
   * @param {number} productId - Product ID
   * @param {number} days - Number of days of history
   * @returns {Promise<Array>} Price history data
   */
  async getPriceHistory(productId, days = 30) {
    try {
      const cacheKey = `history:${productId}:${days}`;

      return await this.getCached(cacheKey, async () => {
        const response = await this.request(`/products/${productId}/price-history?days=${days}`);
        return response.history || [];
      });
    } catch (error) {
      logError('Failed to get price history', error);
      return [];
    }
  }

  /**
   * Get price trend analysis
   * @param {number} productId - Product ID
   * @returns {Promise<Object>} Trend data
   */
  async getPriceTrend(productId) {
    try {
      const cacheKey = `trend:${productId}`;

      return await this.getCached(cacheKey, async () => {
        const response = await this.request(`/products/${productId}/price-trend`);
        return response.trend || {};
      });
    } catch (error) {
      logError('Failed to get price trend', error);
      return null;
    }
  }

  /**
   * Get product offers (current prices from different retailers)
   * @param {number} productId - Product ID
   * @returns {Promise<Array>} Product offers
   */
  async getProductOffers(productId) {
    try {
      const cacheKey = `offers:${productId}`;

      return await this.getCached(cacheKey, async () => {
        const response = await this.request(`/products/${productId}/offers`);
        return response.offers || [];
      });
    } catch (error) {
      logError('Failed to get product offers', error);
      return [];
    }
  }

  /**
   * Create price alert
   * @param {number} productId - Product ID
   * @param {number} targetPrice - Target price
   * @param {string} email - User email
   * @returns {Promise<Object>} Alert data
   */
  async createPriceAlert(productId, targetPrice, email) {
    try {
      const response = await this.request(`/products/${productId}/alerts`, {
        method: 'POST',
        body: JSON.stringify({
          targetPrice,
          email,
          createdFromChart: true
        })
      });
      return response.alert;
    } catch (error) {
      logError('Failed to create price alert', error);
      throw error;
    }
  }

  /**
   * Track product view (analytics)
   * @param {number} productId - Product ID
   * @param {string} source - Source (extension)
   */
  async trackProductView(productId, source = 'extension') {
    try {
      // Fire and forget - don't wait for response
      this.request(`/analytics/product-view`, {
        method: 'POST',
        body: JSON.stringify({
          productId,
          source
        })
      }).catch(() => {
        // Silently fail - analytics shouldn't break UX
      });
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Get price predictions
   * @param {number} productId - Product ID
   * @param {number} days - Days to predict
   * @returns {Promise<Array>} Prediction data
   */
  async getPricePredictions(productId, days = 7) {
    try {
      const cacheKey = `predictions:${productId}:${days}`;

      return await this.getCached(cacheKey, async () => {
        const response = await this.request(`/products/${productId}/price-predictions?days=${days}`);
        return response.predictions || [];
      });
    } catch (error) {
      logError('Failed to get price predictions', error);
      return [];
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    log('Cache cleared');
  }
}

// Create global instance
const api = new PriceCompareAPI();
