/**
 * Shared utility functions for PriceCompare extension
 */

/**
 * Normalize product URL for matching
 * @param {string} url - The product URL
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    // Remove query parameters that don't affect product identity
    const paramsToKeep = ['asin', 'skuId', 'productId', 'item_id'];
    const newParams = new URLSearchParams();

    paramsToKeep.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        newParams.set(param, urlObj.searchParams.get(param));
      }
    });

    urlObj.search = newParams.toString();
    return urlObj.href;
  } catch (e) {
    return url;
  }
}

/**
 * Extract domain from URL
 * @param {string} url - The URL
 * @returns {string} Domain name
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    // Extract main domain (e.g., amazon.com from www.amazon.com)
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch (e) {
    return '';
  }
}

/**
 * Format price for display
 * @param {number} price - Price value
 * @returns {string} Formatted price
 */
function formatPrice(price) {
  if (typeof price !== 'number' || isNaN(price)) {
    return 'N/A';
  }
  return '$' + price.toFixed(2);
}

/**
 * Format date for display
 * @param {string|Date} date - Date value
 * @returns {string} Formatted date
 */
function formatDate(date) {
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
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create a DOM element with attributes
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes object
 * @param {string} content - Inner content
 * @returns {HTMLElement} Created element
 */
function createElement(tag, attrs = {}, content = '') {
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
}

/**
 * Wait for element to appear in DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Element>} Promise resolving to element
 */
function waitForElement(selector, timeout = 5000) {
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
}

/**
 * Log message with extension prefix
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
function log(message, data = null) {
  const prefix = '[PriceCompare Extension]';
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

/**
 * Log error with extension prefix
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
function logError(message, error = null) {
  const prefix = '[PriceCompare Extension ERROR]';
  if (error) {
    console.error(prefix, message, error);
  } else {
    console.error(prefix, message);
  }
}
