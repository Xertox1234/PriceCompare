# PriceCompare Extension - Architecture & Patterns

**Version**: 1.0.0
**Last Updated**: 2025-11-11
**Status**: Production Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Design Patterns](#design-patterns)
3. [Code Organization](#code-organization)
4. [Data Flow](#data-flow)
5. [Communication Patterns](#communication-patterns)
6. [Error Handling](#error-handling)
7. [Performance Patterns](#performance-patterns)
8. [Testing Patterns](#testing-patterns)
9. [Security Patterns](#security-patterns)
10. [Best Practices](#best-practices)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Extension                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Popup UI   │    │   Content    │    │  Background  │  │
│  │              │    │   Scripts    │    │   Worker     │  │
│  │  - Stats     │    │              │    │              │  │
│  │  - Recent    │    │  - Amazon    │    │  - Lifecycle │  │
│  │  - Settings  │    │  - BestBuy   │    │  - Messaging │  │
│  │              │    │  - Generic   │    │  - Storage   │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                            │                                 │
│         ┌──────────────────┴────────────────────┐           │
│         │       Shared Components                │           │
│         │  - API Client                         │           │
│         │  - Storage Wrapper                    │           │
│         │  - Utilities                          │           │
│         └──────────────┬────────────────────────┘           │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  PriceCompare API    │
              │  (localhost:3000)    │
              └──────────────────────┘
```

### Component Layers

1. **Presentation Layer**
   - Popup UI (HTML/CSS/JS)
   - Injected overlays on retailer pages

2. **Business Logic Layer**
   - Content scripts (product detection, data extraction)
   - Background worker (lifecycle, events)

3. **Data Layer**
   - API client (HTTP communication)
   - Storage wrapper (Chrome storage abstraction)
   - Cache layer (in-memory + persistent)

4. **Infrastructure Layer**
   - Chrome Extension APIs
   - Utilities and helpers

---

## Design Patterns

### 1. Singleton Pattern

**Used in**: API Client, Storage Wrapper

```javascript
// shared/api-client.js
class PriceCompareAPI {
  constructor() {
    this.baseUrl = 'http://localhost:3000/api';
    this.cache = new Map();
  }
  // ... methods
}

// Single global instance
const api = new PriceCompareAPI();
```

**Benefits**:

- Single source of truth for configuration
- Shared cache across all content scripts
- Consistent API access

**Pattern**: Eager initialization with global export

---

### 2. Factory Pattern

**Used in**: DOM Element Creation

```javascript
// shared/utils.js
function createElement(tag, attrs = {}, content = '') {
  const element = document.createElement(tag);

  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  if (content) element.innerHTML = content;
  return element;
}
```

**Benefits**:

- Consistent element creation
- Centralized attribute handling
- Type-safe creation

**Pattern**: Function factory with configuration object

---

### 3. Strategy Pattern

**Used in**: Content Scripts (Per-Retailer Logic)

```javascript
// Different strategies for different retailers

// Amazon strategy
function extractASIN() {
  const urlMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
  if (urlMatch) return urlMatch[1];
  // ... fallback strategies
}

// Best Buy strategy
function extractSKU() {
  const urlMatch = window.location.pathname.match(/\/(\d{7,10})\.p/);
  if (urlMatch) return urlMatch[1];
  // ... fallback strategies
}

// Generic strategy
function extractFromMeta() {
  // Generic extraction logic
}
```

**Benefits**:

- Retailer-specific logic encapsulated
- Easy to add new retailers
- Testable in isolation

**Pattern**: Multiple implementations of same interface

---

### 4. Observer Pattern

**Used in**: Chrome Extension Events

```javascript
// background.js
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[PriceCompare] Extension installed', details.reason);
  // Handle installation
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[PriceCompare] Message received', message);
  // Handle messages
  return true; // Async response
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Handle page load
  }
});
```

**Benefits**:

- React to events without polling
- Decoupled components
- Efficient resource usage

**Pattern**: Event-driven architecture with listeners

---

### 5. Decorator Pattern

**Used in**: Cache Wrapper

```javascript
// shared/api-client.js
async getCached(key, fetchFn) {
  const cached = this.cache.get(key);

  // Check cache first (decorator behavior)
  if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
    return cached.data;
  }

  // Fetch and cache
  const data = await fetchFn();
  this.cache.set(key, {
    data,
    timestamp: Date.now()
  });

  return data;
}

// Usage - decorated fetch
async getPriceHistory(productId, days = 30) {
  const cacheKey = `history:${productId}:${days}`;
  return await this.getCached(cacheKey, async () => {
    const response = await this.request(`/products/${productId}/price-history?days=${days}`);
    return response.history || [];
  });
}
```

**Benefits**:

- Transparent caching
- No changes to calling code
- Separation of concerns

**Pattern**: Higher-order function wrapping

---

### 6. Adapter Pattern

**Used in**: Storage Wrapper

```javascript
// shared/storage.js
class ExtensionStorage {
  // Adapts Chrome storage API to simpler interface
  async get(key, defaultValue = null) {
    try {
      const result = await chrome.storage.sync.get([key]);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      logError(`Failed to get ${key} from storage`, error);
      return defaultValue;
    }
  }

  async set(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (error) {
      logError(`Failed to set ${key} in storage`, error);
      throw error;
    }
  }
}
```

**Benefits**:

- Simplified API surface
- Error handling centralized
- Easy to mock for testing

**Pattern**: Wrapper class with simplified methods

---

### 7. Template Method Pattern

**Used in**: Content Script Initialization

```javascript
// content-scripts/amazon-overlay.js
async function init() {
  // Template method defining algorithm

  // Step 1: Check if product page
  if (!isProductPage()) {
    log('Not a product page');
    return;
  }

  // Step 2: Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(injectOverlay, 1000);
    });
  } else {
    setTimeout(injectOverlay, 1000);
  }

  // Step 3: Listen for changes
  observeUrlChanges();
}

// Each step can be overridden by specific retailers
```

**Benefits**:

- Consistent initialization flow
- Customizable steps
- Clear algorithm structure

**Pattern**: Fixed algorithm with customizable steps

---

## Code Organization

### File Structure Pattern

```
extensions/chrome/
├── manifest.json              # Extension config (declarative)
├── background.js             # Event handlers (observer)
│
├── shared/                   # Shared components (singleton)
│   ├── utils.js             # Pure functions (functional)
│   ├── api-client.js        # API wrapper (singleton + decorator)
│   └── storage.js           # Storage wrapper (adapter)
│
├── content-scripts/         # Page-specific logic (strategy)
│   ├── amazon-overlay.js    # Amazon strategy
│   ├── bestbuy-overlay.js   # BestBuy strategy
│   ├── generic-overlay.js   # Generic strategy
│   └── overlay-styles.css   # Shared styles
│
├── popup/                   # UI components (MVC-lite)
│   ├── popup.html          # View
│   ├── popup.css           # Styles
│   └── popup.js            # Controller
│
└── __tests__/              # Test infrastructure
    ├── __mocks__/          # Mock objects (mock pattern)
    ├── shared/             # Unit tests
    ├── content-scripts/    # Integration tests
    └── e2e/                # End-to-end tests
```

### Naming Conventions

```javascript
// Classes: PascalCase
class PriceCompareAPI {}
class ExtensionStorage {}

// Functions: camelCase
function extractASIN() {}
function formatPrice() {}

// Constants: UPPER_SNAKE_CASE
const API_BASE_URL = 'http://localhost:3000/api';
const CACHE_TIMEOUT = 5 * 60 * 1000;

// Private/internal: underscore prefix
function _internalHelper() {}

// Files: kebab-case
// amazon-overlay.js
// api-client.js
// overlay-styles.css

// Test files: *.test.js
// utils.test.js
// api-client.test.js
```

---

## Data Flow

### Request Flow Pattern

```
User Action → Content Script → API Client → Backend API
     ↓              ↓              ↓              ↓
  DOM Event    Extract Data    HTTP Request   Process
     ↓              ↓              ↓              ↓
  Trigger      Validate         Cache         Response
     ↓              ↓              ↓              ↓
  Handler      Transform        Return         JSON
     ↓              ↓              ↓              ↓
  Update UI    Render          Display        Update
```

### Detailed Flow: Product Detection

```javascript
// 1. Page Load Event
window.addEventListener('load', () => {
  // 2. Detection Phase
  if (isProductPage()) {
    const productUrl = window.location.href;

    // 3. Data Extraction Phase
    const asin = extractASIN();
    const title = extractTitle();
    const price = extractPrice();

    // 4. API Query Phase
    api
      .searchProductByUrl(productUrl)
      .then((product) => {
        if (!product) return;

        // 5. Data Fetching Phase
        return Promise.all([
          api.getPriceHistory(product.id, 30),
          api.getPriceTrend(product.id),
          storage.getPreferences()
        ]);
      })
      .then(([history, trend, prefs]) => {
        // 6. Rendering Phase
        const overlay = createOverlay();
        const content = renderChart(history, trend);
        overlay.appendChild(content);

        // 7. Injection Phase
        const insertionPoint = findInsertionPoint();
        insertionPoint.parentNode.insertBefore(overlay, insertionPoint.nextSibling);

        // 8. Tracking Phase
        api.trackProductView(product.id);
        storage.updateStats({ chartsDisplayed: +1 });
      })
      .catch((error) => {
        logError('Failed to load price history', error);
        showError(container, 'Failed to load price data.');
      });
  }
});
```

---

## Communication Patterns

### 1. Message Passing (Background ↔ Content Script)

```javascript
// content-script.js → background.js
chrome.runtime.sendMessage({
  type: 'TRACK_EVENT',
  event: 'product_viewed',
  data: { productId: 123 }
});

// background.js (listener)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TRACK_EVENT':
      handleTrackEvent(message.event, message.data);
      sendResponse({ success: true });
      break;
  }
  return true; // Async response
});
```

**Pattern**: Request/Response with typed messages

---

### 2. Storage-Based Communication

```javascript
// Component A writes
await chrome.storage.sync.set({ preferences: { enabled: false } });

// Component B reads (via storage listener or direct access)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.preferences) {
    const newPrefs = changes.preferences.newValue;
    updateUI(newPrefs);
  }
});
```

**Pattern**: Pub/Sub via storage changes

---

### 3. Event-Driven Communication

```javascript
// Popup triggers action
document.getElementById('clear-cache').addEventListener('click', async () => {
  await storage.clearCache();

  // Notify background
  chrome.runtime.sendMessage({ type: 'CACHE_CLEARED' });

  // Update UI
  showNotification('Cache cleared!');
});
```

**Pattern**: Event-driven with side effects

---

## Error Handling

### Error Handling Strategy

```javascript
// Level 1: Try/Catch with Fallback
async function getPriceHistory(productId, days = 30) {
  try {
    const response = await this.request(`/products/${productId}/price-history?days=${days}`);
    return response.history || [];
  } catch (error) {
    logError('Failed to get price history', error);
    return []; // Fallback to empty array
  }
}

// Level 2: Graceful Degradation
async function injectOverlay() {
  try {
    const product = await api.searchProductByUrl(productUrl);
    if (!product) {
      log('Product not found in database');
      return; // Silent failure
    }

    // Continue with injection
  } catch (error) {
    logError('Failed to inject overlay', error);
    // Don't break the page
  }
}

// Level 3: User-Facing Errors
function showError(container, message) {
  container.innerHTML = `
    <div class="pricecompare-error">
      <h4>Unable to Load Price History</h4>
      <p>${message}</p>
    </div>
  `;
}
```

**Patterns**:

- Try/catch with sensible defaults
- Silent failures for non-critical operations
- User-friendly error messages for critical failures
- Always log errors for debugging

---

## Performance Patterns

### 1. Caching Strategy

```javascript
// Multi-level caching

// L1: In-memory cache (Map)
this.cache = new Map();

// L2: Chrome storage cache
async getCachedPriceData(productId) {
  const key = `priceData_${productId}`;
  const result = await chrome.storage.local.get([key]);
  const cached = result[key];

  if (!cached) return null;

  // Check TTL
  const age = Date.now() - cached.timestamp;
  if (age > 5 * 60 * 1000) {
    await chrome.storage.local.remove(key);
    return null;
  }

  return cached.data;
}
```

**Pattern**: Multi-tier caching with TTL

---

### 2. Debouncing

```javascript
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

// Usage
const debouncedSearch = debounce(searchProducts, 300);
inputElement.addEventListener('input', debouncedSearch);
```

**Pattern**: Debounce for expensive operations

---

### 3. Lazy Loading

```javascript
// Delay non-critical operations
setTimeout(() => {
  injectOverlay();
}, 1000); // Wait 1s after page load

// Progressive enhancement
async function loadData() {
  // Load critical data first
  const basicData = await api.getBasicInfo(productId);
  renderBasicView(basicData);

  // Load extended data in background
  setTimeout(async () => {
    const extendedData = await api.getExtendedInfo(productId);
    enhanceView(extendedData);
  }, 500);
}
```

**Pattern**: Progressive loading with priorities

---

## Testing Patterns

### 1. Arrange-Act-Assert (AAA)

```javascript
it('should format price correctly', () => {
  // Arrange
  const price = 19.99;

  // Act
  const result = formatPrice(price);

  // Assert
  expect(result).toBe('$19.99');
});
```

---

### 2. Test Doubles (Mocks, Stubs, Spies)

```javascript
// Mock
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'test' })
});

// Stub
document.querySelector = jest.fn(() => ({
  textContent: 'Stubbed Value'
}));

// Spy
const consoleSpy = jest.spyOn(console, 'error');
expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));
```

---

### 3. Test Fixtures

```javascript
// __tests__/fixtures/products.js
export const mockProduct = {
  id: 123,
  title: 'Test Product',
  currentPrice: 19.99
};

export const mockPriceHistory = [
  { price: 19.99, recordedAt: '2025-01-01' },
  { price: 18.99, recordedAt: '2025-01-02' }
];

// Usage in tests
import { mockProduct, mockPriceHistory } from './fixtures/products';
```

---

## Security Patterns

### 1. Input Sanitization

```javascript
// HTML escaping
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Usage
container.innerHTML = `
  <div class="product-name">${escapeHtml(product.title)}</div>
`;
```

---

### 2. URL Validation

```javascript
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    // Only keep safe parameters
    const safeParams = ['asin', 'skuId', 'productId'];
    // ... sanitize
    return urlObj.href;
  } catch (e) {
    return url; // Fallback to original
  }
}
```

---

### 3. Content Security Policy

```json
// manifest.json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## Best Practices

### 1. Logging

```javascript
// Consistent logging with prefix
function log(message, data = null) {
  const prefix = '[PriceCompare Extension]';
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

function logError(message, error = null) {
  const prefix = '[PriceCompare Extension ERROR]';
  if (error) {
    console.error(prefix, message, error);
  } else {
    console.error(prefix, message);
  }
}
```

---

### 2. Async/Await Over Callbacks

```javascript
// ❌ Avoid callback hell
chrome.storage.sync.get(['key'], (result) => {
  api.getData(result.key, (data) => {
    processData(data, (processed) => {
      // Nested callbacks
    });
  });
});

// ✅ Use async/await
async function loadData() {
  const result = await chrome.storage.sync.get(['key']);
  const data = await api.getData(result.key);
  const processed = await processData(data);
  return processed;
}
```

---

### 3. Fail Fast

```javascript
async function injectOverlay() {
  // Check prerequisites early
  if (!isProductPage()) {
    log('Not a product page');
    return; // Fail fast
  }

  const prefs = await storage.getPreferences();
  if (!prefs.enabled) {
    log('Extension disabled');
    return; // Fail fast
  }

  const asin = extractASIN();
  if (!asin) {
    log('Could not extract ASIN');
    return; // Fail fast
  }

  // Proceed with main logic
  // ...
}
```

---

### 4. Dependency Injection

```javascript
// ❌ Hard dependency
class MyClass {
  constructor() {
    this.api = new API(); // Hard-coded
  }
}

// ✅ Injected dependency
class MyClass {
  constructor(api = defaultApi) {
    this.api = api; // Can be mocked
  }
}
```

---

## Summary

### Key Architectural Decisions

1. **Manifest V3**: Future-proof, service worker-based
2. **Modular Structure**: Separation of concerns by functionality
3. **Shared Components**: DRY principle with singleton utilities
4. **Strategy Pattern**: Retailer-specific logic encapsulated
5. **Caching Layer**: Performance optimization with TTL
6. **Error Boundaries**: Graceful degradation, never break host page
7. **Event-Driven**: React to user actions and browser events
8. **Test-First**: 85% coverage with comprehensive test suite

### Design Principles Applied

- **SOLID**: Single Responsibility, Open/Closed, Interface Segregation
- **DRY**: Don't Repeat Yourself (shared utilities)
- **KISS**: Keep It Simple (no over-engineering)
- **YAGNI**: You Aren't Gonna Need It (no speculative features)
- **Separation of Concerns**: Clear boundaries between layers
- **Fail Fast**: Early validation and error checking
- **Defensive Programming**: Always handle errors gracefully

---

**Document Maintained By**: PriceCompare Development Team
**Review Cycle**: Quarterly or when major architectural changes occur
**Version**: 1.0.0
