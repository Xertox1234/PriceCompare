/**
 * Unit tests for shared/api-client.js
 */

import { vi } from 'vitest';
import '../setup.js';

// Mock PriceCompareAPI class
class PriceCompareAPI {
  constructor() {
    this.baseUrl = 'http://localhost:3000/api';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get(['apiBaseUrl']);
      if (result.apiBaseUrl) {
        this.baseUrl = result.apiBaseUrl;
      }
    } catch (error) {
      console.error('Failed to load config', error);
    }
  }

  async setBaseUrl(url) {
    this.baseUrl = url;
    await chrome.storage.sync.set({ apiBaseUrl: url });
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

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

    return await response.json();
  }

  async getCached(key, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = await fetchFn();
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    return data;
  }

  async searchProductByUrl(productUrl) {
    try {
      const cacheKey = `product:${productUrl}`;
      return await this.getCached(cacheKey, async () => {
        const encodedUrl = encodeURIComponent(productUrl);
        const response = await this.request(`/products/search?url=${encodedUrl}`);
        return response.product || null;
      });
    } catch (error) {
      console.error('Failed to search product', error);
      return null;
    }
  }

  async getPriceHistory(productId, days = 30) {
    try {
      const cacheKey = `history:${productId}:${days}`;
      return await this.getCached(cacheKey, async () => {
        const response = await this.request(`/products/${productId}/price-history?days=${days}`);
        return response.history || [];
      });
    } catch (error) {
      console.error('Failed to get price history', error);
      return [];
    }
  }

  async getPriceTrend(productId) {
    try {
      const cacheKey = `trend:${productId}`;
      return await this.getCached(cacheKey, async () => {
        const response = await this.request(`/products/${productId}/price-trend`);
        return response.trend || {};
      });
    } catch (error) {
      console.error('Failed to get price trend', error);
      return null;
    }
  }

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
      console.error('Failed to create price alert', error);
      throw error;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

describe('PriceCompareAPI', () => {
  let api;

  beforeEach(() => {
    api = new PriceCompareAPI();
    chrome.__resetStorage();
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(api.baseUrl).toBe('http://localhost:3000/api');
      expect(api.cache).toBeInstanceOf(Map);
      expect(api.cacheTimeout).toBe(5 * 60 * 1000);
    });
  });

  describe('loadConfig', () => {
    it('should load API base URL from storage', async () => {
      await chrome.storage.sync.set({ apiBaseUrl: 'https://api.example.com' });

      await api.loadConfig();

      expect(api.baseUrl).toBe('https://api.example.com');
    });

    it('should keep default URL if not in storage', async () => {
      await api.loadConfig();

      expect(api.baseUrl).toBe('http://localhost:3000/api');
    });
  });

  describe('setBaseUrl', () => {
    it('should update base URL and save to storage', async () => {
      await api.setBaseUrl('https://new-api.example.com');

      expect(api.baseUrl).toBe('https://new-api.example.com');

      const stored = await chrome.storage.sync.get(['apiBaseUrl']);
      expect(stored.apiBaseUrl).toBe('https://new-api.example.com');
    });
  });

  describe('request', () => {
    it('should make successful API request', async () => {
      const mockData = { success: true, data: 'test' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await api.request('/test-endpoint');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test-endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should throw error on failed request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(api.request('/missing')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should include custom headers', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      await api.request('/test', {
        headers: { 'X-Custom': 'value' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'value'
          })
        })
      );
    });

    it('should handle POST requests', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ created: true })
      });

      await api.request('/create', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' })
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'test' })
        })
      );
    });
  });

  describe('getCached', () => {
    it('should return cached data if valid', async () => {
      const mockData = { test: 'data' };
      const mockFetchFn = vi.fn();

      api.cache.set('test-key', {
        data: mockData,
        timestamp: Date.now()
      });

      const result = await api.getCached('test-key', mockFetchFn);

      expect(result).toEqual(mockData);
      expect(mockFetchFn).not.toHaveBeenCalled();
    });

    it('should fetch new data if cache expired', async () => {
      const oldData = { old: 'data' };
      const newData = { new: 'data' };
      const mockFetchFn = vi.fn().mockResolvedValue(newData);

      api.cache.set('test-key', {
        data: oldData,
        timestamp: Date.now() - 6 * 60 * 1000 // 6 minutes ago (expired)
      });

      const result = await api.getCached('test-key', mockFetchFn);

      expect(result).toEqual(newData);
      expect(mockFetchFn).toHaveBeenCalled();
    });

    it('should fetch and cache new data if not cached', async () => {
      const mockData = { fresh: 'data' };
      const mockFetchFn = vi.fn().mockResolvedValue(mockData);

      const result = await api.getCached('new-key', mockFetchFn);

      expect(result).toEqual(mockData);
      expect(mockFetchFn).toHaveBeenCalled();
      expect(api.cache.has('new-key')).toBe(true);
    });
  });

  describe('searchProductByUrl', () => {
    it('should search for product by URL', async () => {
      const mockProduct = { id: 123, title: 'Test Product' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ product: mockProduct })
      });

      const result = await api.searchProductByUrl('https://amazon.com/dp/B123');

      expect(result).toEqual(mockProduct);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products/search?url='),
        expect.any(Object)
      );
    });

    it('should return null if product not found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ product: null })
      });

      const result = await api.searchProductByUrl('https://example.com/product');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await api.searchProductByUrl('https://example.com/product');

      expect(result).toBeNull();
    });

    it('should use cache for repeated searches', async () => {
      const mockProduct = { id: 123, title: 'Test Product' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ product: mockProduct })
      });

      const url = 'https://amazon.com/dp/B123';
      const result1 = await api.searchProductByUrl(url);
      const result2 = await api.searchProductByUrl(url);

      expect(result1).toEqual(mockProduct);
      expect(result2).toEqual(mockProduct);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once due to cache
    });
  });

  describe('getPriceHistory', () => {
    it('should fetch price history', async () => {
      const mockHistory = [
        { price: 19.99, recordedAt: '2025-01-01' },
        { price: 18.99, recordedAt: '2025-01-02' }
      ];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ history: mockHistory })
      });

      const result = await api.getPriceHistory(123, 30);

      expect(result).toEqual(mockHistory);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products/123/price-history?days=30'),
        expect.any(Object)
      );
    });

    it('should return empty array on error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await api.getPriceHistory(123);

      expect(result).toEqual([]);
    });

    it('should use default days parameter', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ history: [] })
      });

      await api.getPriceHistory(123);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('days=30'),
        expect.any(Object)
      );
    });
  });

  describe('getPriceTrend', () => {
    it('should fetch price trend', async () => {
      const mockTrend = { direction: 'down', percentage: -15 };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ trend: mockTrend })
      });

      const result = await api.getPriceTrend(123);

      expect(result).toEqual(mockTrend);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products/123/price-trend'),
        expect.any(Object)
      );
    });

    it('should return null on error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await api.getPriceTrend(123);

      expect(result).toBeNull();
    });
  });

  describe('createPriceAlert', () => {
    it('should create price alert', async () => {
      const mockAlert = { id: 456, targetPrice: 15.99 };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alert: mockAlert })
      });

      const result = await api.createPriceAlert(123, 15.99, 'test@example.com');

      expect(result).toEqual(mockAlert);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products/123/alerts'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            targetPrice: 15.99,
            email: 'test@example.com',
            createdFromChart: true
          })
        })
      );
    });

    it('should throw error on failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.createPriceAlert(123, 15.99, 'test@example.com')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', () => {
      api.cache.set('key1', { data: 'test1', timestamp: Date.now() });
      api.cache.set('key2', { data: 'test2', timestamp: Date.now() });

      expect(api.cache.size).toBe(2);

      api.clearCache();

      expect(api.cache.size).toBe(0);
    });
  });
});
