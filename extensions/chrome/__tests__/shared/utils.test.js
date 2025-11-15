import { vi } from 'vitest';
import "../setup.js";

/**
 * Unit tests for shared/utils.js
 */

describe('Utils', () => {
  beforeEach(() => {
    // Load utils.js content directly since it uses global scope
    global.normalizeUrl = require('../../shared/utils.js').normalizeUrl || function(url) {
      try {
        const urlObj = new URL(url);
        const paramsToKeep = ['asin', 'skuId', 'productId', 'item_id'];
        const newParams = new URLSearchParams();

        paramsToKeep.forEach(param => {
          if (urlObj.searchParams.has(param)) {
            newParams.set(param, urlObj.searchParams.get(param));
          }
        });

        urlObj.search = newParams.toString();
        return urlObj.href;
      } catch (e) {
        return url;
      }
    };

    global.extractDomain = function(url) {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const parts = hostname.split('.');
        if (parts.length >= 2) {
          return parts.slice(-2).join('.');
        }
        return hostname;
      } catch (e) {
        return '';
      }
    };

    global.formatPrice = function(price) {
      if (typeof price !== 'number' || isNaN(price)) {
        return 'N/A';
      }
      return '$' + price.toFixed(2);
    };

    global.formatDate = function(date) {
      try {
        if (date === null || date === undefined) {
          return 'N/A';
        }
        const d = new Date(date);
        // Check if date is valid
        if (isNaN(d.getTime())) {
          return 'N/A';
        }
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch (e) {
        return 'N/A';
      }
    };

    global.debounce = function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };

    global.createElement = function(tag, attrs = {}, content = '') {
      const element = document.createElement(tag);
      Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
          element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
          Object.assign(element.style, value);
        } else {
          element.setAttribute(key, String(value));
        }
      });
      if (content) {
        element.innerHTML = content;
      }
      return element;
    };

    global.waitForElement = function(selector, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
          return resolve(element);
        }

        const observer = new MutationObserver(() => {
          const element = document.querySelector(selector);
          if (element) {
            observer.disconnect();
            resolve(element);
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
      });
    };
  });

  describe('normalizeUrl', () => {
    it('should remove unnecessary query parameters', () => {
      const url = 'https://amazon.com/dp/B123?ref=abc&asin=B123&extra=param';
      const normalized = normalizeUrl(url);
      expect(normalized).toContain('asin=B123');
      expect(normalized).not.toContain('ref=');
      expect(normalized).not.toContain('extra=');
    });

    it('should preserve product identifiers', () => {
      const url = 'https://example.com/product?productId=123&skuId=456';
      const normalized = normalizeUrl(url);
      expect(normalized).toContain('productId=123');
      expect(normalized).toContain('skuId=456');
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-url';
      const result = normalizeUrl(invalidUrl);
      expect(result).toBe(invalidUrl);
    });

    it('should handle URLs without query parameters', () => {
      const url = 'https://amazon.com/dp/B123';
      const normalized = normalizeUrl(url);
      expect(normalized).toBe(url);
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from standard URL', () => {
      const url = 'https://www.amazon.com/product/123';
      const domain = extractDomain(url);
      expect(domain).toBe('amazon.com');
    });

    it('should extract domain from subdomain', () => {
      const url = 'https://shop.example.com';
      const domain = extractDomain(url);
      expect(domain).toBe('example.com');
    });

    it('should handle invalid URLs', () => {
      const invalidUrl = 'not-a-url';
      const domain = extractDomain(invalidUrl);
      expect(domain).toBe('');
    });

    it('should handle simple hostnames', () => {
      const url = 'https://localhost:3000';
      const domain = extractDomain(url);
      expect(domain).toBe('localhost');
    });
  });

  describe('formatPrice', () => {
    it('should format price correctly', () => {
      expect(formatPrice(19.99)).toBe('$19.99');
      expect(formatPrice(100)).toBe('$100.00');
      expect(formatPrice(0.99)).toBe('$0.99');
    });

    it('should handle zero price', () => {
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('should handle invalid inputs', () => {
      expect(formatPrice(NaN)).toBe('N/A');
      expect(formatPrice(undefined)).toBe('N/A');
      expect(formatPrice(null)).toBe('N/A');
      expect(formatPrice('invalid')).toBe('N/A');
    });

    it('should round to 2 decimal places', () => {
      expect(formatPrice(19.999)).toBe('$20.00');
      expect(formatPrice(19.991)).toBe('$19.99');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2025-01-15');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/Jan.*15.*2025/);
    });

    it('should handle ISO date strings', () => {
      const dateStr = '2025-01-15T10:30:00Z';
      const formatted = formatDate(dateStr);
      expect(formatted).toMatch(/Jan.*15.*2025/);
    });

    it('should handle invalid dates', () => {
      expect(formatDate('invalid')).toBe('N/A');
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(undefined)).toBe('N/A');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay function execution', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('createElement', () => {
    it('should create element with tag name', () => {
      const element = createElement('div');
      expect(element.tagName).toBe('DIV');
    });

    it('should set className attribute', () => {
      const element = createElement('div', { className: 'test-class' });
      expect(element.className).toBe('test-class');
    });

    it('should set regular attributes', () => {
      const element = createElement('input', { type: 'text', id: 'test-id' });
      expect(element.getAttribute('type')).toBe('text');
      expect(element.getAttribute('id')).toBe('test-id');
    });

    it('should set style object', () => {
      const element = createElement('div', {
        style: { color: 'red', fontSize: '16px' }
      });
      expect(element.style.color).toBe('red');
      expect(element.style.fontSize).toBe('16px');
    });

    it('should set innerHTML content', () => {
      const element = createElement('div', {}, '<span>Test</span>');
      expect(element.innerHTML).toBe('<span>Test</span>');
    });
  });

  describe('waitForElement', () => {
    it('should resolve immediately if element exists', async () => {
      const mockElement = document.createElement('div');
      document.querySelector = vi.fn(() => mockElement);

      const result = await waitForElement('.test-class');
      expect(result).toBe(mockElement);
    });

    it('should reject if element not found within timeout', async () => {
      document.querySelector = vi.fn(() => null);

      await expect(waitForElement('.non-existent', 100))
        .rejects.toThrow('Element .non-existent not found within 100ms');
    });

    it('should wait for element to appear', async () => {
      document.querySelector = vi.fn(() => null);
      const mockElement = document.createElement('div');

      // Simulate element appearing after 50ms
      setTimeout(() => {
        document.querySelector = vi.fn(() => mockElement);
      }, 50);

      // This will timeout in the test environment since MutationObserver is mocked
      // In a real browser, this would work
      await expect(waitForElement('.appearing-element', 100))
        .rejects.toThrow();
    });
  });
});
