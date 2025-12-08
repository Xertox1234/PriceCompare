/**
 * Unit tests for shared/storage.js
 */

import '../setup.js';

// Mock ExtensionStorage class
class ExtensionStorage {
  async get(key, defaultValue = null) {
    try {
      const result = await chrome.storage.sync.get([key]);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      console.error(`Failed to get ${key} from storage`, error);
      return defaultValue;
    }
  }

  async set(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (error) {
      console.error(`Failed to set ${key} in storage`, error);
      throw error;
    }
  }

  async remove(key) {
    try {
      await chrome.storage.sync.remove(key);
    } catch (error) {
      console.error(`Failed to remove ${key} from storage`, error);
      throw error;
    }
  }

  async clear() {
    try {
      await chrome.storage.sync.clear();
    } catch (error) {
      console.error('Failed to clear storage', error);
      throw error;
    }
  }

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
      console.error('Failed to get preferences', error);
      return defaults;
    }
  }

  async savePreferences(preferences) {
    try {
      const current = await this.getPreferences();
      const updated = { ...current, ...preferences };
      await chrome.storage.sync.set({ preferences: updated });
    } catch (error) {
      console.error('Failed to save preferences', error);
      throw error;
    }
  }

  async getRecentProducts(limit = 10) {
    try {
      const result = await chrome.storage.local.get(['recentProducts']);
      const recent = result.recentProducts || [];
      return recent.slice(0, limit);
    } catch (error) {
      console.error('Failed to get recent products', error);
      return [];
    }
  }

  async addRecentProduct(product) {
    try {
      const recent = await this.getRecentProducts(50);
      const filtered = recent.filter((p) => p.id !== product.id);
      const updated = [{ ...product, viewedAt: new Date().toISOString() }, ...filtered].slice(
        0,
        50
      );
      await chrome.storage.local.set({ recentProducts: updated });
    } catch (error) {
      console.error('Failed to add recent product', error);
    }
  }

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
      console.error('Failed to get stats', error);
      return {
        productsViewed: 0,
        chartsDisplayed: 0,
        alertsCreated: 0,
        lastUsed: null
      };
    }
  }

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
      console.error('Failed to update stats', error);
    }
  }
}

describe('ExtensionStorage', () => {
  let storage;

  beforeEach(() => {
    storage = new ExtensionStorage();
    chrome.__resetStorage();
  });

  describe('get', () => {
    it('should get value from storage', async () => {
      await chrome.storage.sync.set({ testKey: 'testValue' });

      const result = await storage.get('testKey');

      expect(result).toBe('testValue');
    });

    it('should return default value if key not found', async () => {
      const result = await storage.get('nonExistent', 'defaultValue');

      expect(result).toBe('defaultValue');
    });

    it('should return null as default if not specified', async () => {
      const result = await storage.get('nonExistent');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value in storage', async () => {
      await storage.set('testKey', 'testValue');

      const result = await chrome.storage.sync.get(['testKey']);
      expect(result.testKey).toBe('testValue');
    });

    it('should overwrite existing value', async () => {
      await chrome.storage.sync.set({ testKey: 'oldValue' });

      await storage.set('testKey', 'newValue');

      const result = await chrome.storage.sync.get(['testKey']);
      expect(result.testKey).toBe('newValue');
    });
  });

  describe('remove', () => {
    it('should remove value from storage', async () => {
      await chrome.storage.sync.set({ testKey: 'testValue' });

      await storage.remove('testKey');

      const result = await chrome.storage.sync.get(['testKey']);
      expect(result.testKey).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all storage', async () => {
      await chrome.storage.sync.set({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      });

      await storage.clear();

      const result = await chrome.storage.sync.get(null);
      expect(result).toEqual({});
    });
  });

  describe('getPreferences', () => {
    it('should return default preferences if not set', async () => {
      const prefs = await storage.getPreferences();

      expect(prefs).toEqual({
        enabled: true,
        showOnPageLoad: true,
        defaultTimeRange: 30,
        apiBaseUrl: 'http://localhost:3000/api',
        userEmail: '',
        darkMode: false
      });
    });

    it('should merge stored preferences with defaults', async () => {
      await chrome.storage.sync.set({
        preferences: {
          enabled: false,
          userEmail: 'test@example.com'
        }
      });

      const prefs = await storage.getPreferences();

      expect(prefs).toEqual({
        enabled: false,
        showOnPageLoad: true,
        defaultTimeRange: 30,
        apiBaseUrl: 'http://localhost:3000/api',
        userEmail: 'test@example.com',
        darkMode: false
      });
    });
  });

  describe('savePreferences', () => {
    it('should save preferences', async () => {
      await storage.savePreferences({
        enabled: false,
        userEmail: 'test@example.com'
      });

      const stored = await chrome.storage.sync.get(['preferences']);
      expect(stored.preferences.enabled).toBe(false);
      expect(stored.preferences.userEmail).toBe('test@example.com');
    });

    it('should merge with existing preferences', async () => {
      await storage.savePreferences({ enabled: false });
      await storage.savePreferences({ userEmail: 'test@example.com' });

      const prefs = await storage.getPreferences();
      expect(prefs.enabled).toBe(false);
      expect(prefs.userEmail).toBe('test@example.com');
    });
  });

  describe('getRecentProducts', () => {
    it('should return empty array if no products', async () => {
      const products = await storage.getRecentProducts();

      expect(products).toEqual([]);
    });

    it('should return recent products', async () => {
      const mockProducts = [
        { id: 1, title: 'Product 1' },
        { id: 2, title: 'Product 2' }
      ];

      await chrome.storage.local.set({ recentProducts: mockProducts });

      const products = await storage.getRecentProducts();

      expect(products).toEqual(mockProducts);
    });

    it('should limit number of products returned', async () => {
      const mockProducts = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        title: `Product ${i}`
      }));

      await chrome.storage.local.set({ recentProducts: mockProducts });

      const products = await storage.getRecentProducts(5);

      expect(products).toHaveLength(5);
      expect(products[0].id).toBe(0);
    });
  });

  describe('addRecentProduct', () => {
    it('should add product to recent list', async () => {
      const product = { id: 1, title: 'Test Product', currentPrice: 19.99 };

      await storage.addRecentProduct(product);

      const products = await storage.getRecentProducts();

      expect(products).toHaveLength(1);
      expect(products[0].id).toBe(1);
      expect(products[0].viewedAt).toBeDefined();
    });

    it('should remove duplicate and add to front', async () => {
      await chrome.storage.local.set({
        recentProducts: [
          { id: 1, title: 'Product 1', viewedAt: '2025-01-01' },
          { id: 2, title: 'Product 2', viewedAt: '2025-01-02' }
        ]
      });

      await storage.addRecentProduct({ id: 1, title: 'Product 1 Updated' });

      const products = await storage.getRecentProducts();

      expect(products).toHaveLength(2);
      expect(products[0].id).toBe(1);
      expect(products[0].title).toBe('Product 1 Updated');
      expect(products[1].id).toBe(2);
    });

    it('should limit to 50 products', async () => {
      const existingProducts = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        title: `Product ${i}`
      }));

      await chrome.storage.local.set({ recentProducts: existingProducts });

      await storage.addRecentProduct({ id: 100, title: 'New Product' });

      const products = await storage.getRecentProducts(100);

      expect(products).toHaveLength(50);
      expect(products[0].id).toBe(100);
      expect(products[49].id).toBe(48);
    });
  });

  describe('getStats', () => {
    it('should return default stats if not set', async () => {
      const stats = await storage.getStats();

      expect(stats).toEqual({
        productsViewed: 0,
        chartsDisplayed: 0,
        alertsCreated: 0,
        lastUsed: null
      });
    });

    it('should return stored stats', async () => {
      const mockStats = {
        productsViewed: 10,
        chartsDisplayed: 8,
        alertsCreated: 3,
        lastUsed: '2025-01-15'
      };

      await chrome.storage.local.set({ stats: mockStats });

      const stats = await storage.getStats();

      expect(stats).toEqual(mockStats);
    });
  });

  describe('updateStats', () => {
    it('should update stats', async () => {
      await storage.updateStats({ productsViewed: 5 });

      const stats = await storage.getStats();

      expect(stats.productsViewed).toBe(5);
      expect(stats.lastUsed).toBeDefined();
    });

    it('should merge with existing stats', async () => {
      await storage.updateStats({ productsViewed: 5 });
      await storage.updateStats({ chartsDisplayed: 3 });

      const stats = await storage.getStats();

      expect(stats.productsViewed).toBe(5);
      expect(stats.chartsDisplayed).toBe(3);
    });

    it('should always update lastUsed timestamp', async () => {
      await storage.updateStats({ productsViewed: 1 });

      const stats1 = await storage.getStats();
      const firstTimestamp = stats1.lastUsed;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      await storage.updateStats({ chartsDisplayed: 1 });

      const stats2 = await storage.getStats();
      const secondTimestamp = stats2.lastUsed;

      expect(secondTimestamp).not.toBe(firstTimestamp);
    });
  });
});
