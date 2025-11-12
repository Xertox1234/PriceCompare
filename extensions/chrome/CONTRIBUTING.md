# Contributing to PriceCompare Extension

Thank you for your interest in contributing to the PriceCompare browser extension! This guide will help you get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Adding Features](#adding-features)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

---

## Getting Started

### Prerequisites

- **Node.js**: v18.x or v20.x
- **npm**: v9+ (comes with Node.js)
- **Chrome** or **Edge**: Latest version
- **Git**: For version control
- **Code Editor**: VS Code recommended

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Xertox1234/PriceCompare.git
cd PriceCompare/extensions/chrome

# 2. Install dependencies
npm install

# 3. Run tests to verify setup
npm test

# 4. Load extension in Chrome
# Navigate to chrome://extensions/
# Enable "Developer mode"
# Click "Load unpacked"
# Select the extensions/chrome directory
```

---

## Development Setup

### IDE Configuration

#### VS Code (Recommended)

Install recommended extensions:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "orta.vscode-jest",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "jest.autoRun": "watch"
}
```

### Environment Setup

The extension connects to a backend API. Configure the API endpoint:

1. **Development**: `http://localhost:3000/api` (default)
2. **Testing**: Use mock responses in tests
3. **Production**: Update in extension settings UI

---

## Project Structure

```
extensions/chrome/
├── manifest.json              # Extension configuration
├── background.js             # Service worker (event handlers)
├── ARCHITECTURE.md           # Architecture documentation
├── CONTRIBUTING.md           # This file
├── README.md                 # User-facing documentation
│
├── shared/                   # Shared utilities
│   ├── utils.js             # Helper functions
│   ├── api-client.js        # API communication
│   └── storage.js           # Chrome storage wrapper
│
├── content-scripts/         # Retailer-specific scripts
│   ├── amazon-overlay.js    # Amazon integration
│   ├── bestbuy-overlay.js   # Best Buy integration
│   ├── generic-overlay.js   # Generic retailers
│   └── overlay-styles.css   # Shared styles
│
├── popup/                   # Extension popup UI
│   ├── popup.html          # Popup structure
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
│
├── icons/                   # Extension icons
│   └── README.md           # Icon guidelines
│
└── __tests__/              # Test suite
    ├── __mocks__/          # Mock implementations
    ├── shared/             # Unit tests
    ├── content-scripts/    # Integration tests
    ├── e2e/                # E2E tests
    ├── setup.js            # Test configuration
    └── README.md           # Testing guide
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed patterns and design decisions.

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

Edit files in your editor. The extension will need to be reloaded in Chrome after changes.

### 3. Reload Extension

After making changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on the PriceCompare extension
3. Reload any open retailer pages to see changes

**Pro Tip**: Use the Extension Reloader extension for faster reloads.

### 4. Test Your Changes

```bash
# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run specific test file
npm test -- utils.test.js

# Check coverage
npm run test:coverage
```

### 5. Manual Testing

Test on actual retailer pages:
- Amazon: https://www.amazon.com/dp/B08N5WRWNW
- Best Buy: https://www.bestbuy.com/site/[product-sku].p
- Walmart: https://www.walmart.com/ip/[product-id]

Checklist:
- [ ] Product detected correctly
- [ ] Price history displays
- [ ] Alert creation works
- [ ] No console errors
- [ ] Popup functions correctly
- [ ] Mobile responsive (use DevTools device mode)

---

## Adding Features

### Adding a New Retailer

1. **Create content script** (or extend `generic-overlay.js`):

```javascript
// content-scripts/newretailer-overlay.js
(function () {
  'use strict';

  function isProductPage() {
    // Detect product page
    return window.location.pathname.includes('/product/');
  }

  function extractProductId() {
    // Extract product identifier
    const match = window.location.pathname.match(/\/product\/(\d+)/);
    return match ? match[1] : null;
  }

  function extractTitle() {
    const element = document.querySelector('.product-title');
    return element ? element.textContent.trim() : 'Unknown Product';
  }

  function extractPrice() {
    const element = document.querySelector('.price');
    if (!element) return null;

    const priceText = element.textContent.trim();
    const match = priceText.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(',', '')) : null;
  }

  // ... rest of overlay logic (copy from amazon-overlay.js)

  init();
})();
```

2. **Update manifest.json**:

```json
{
  "content_scripts": [
    {
      "matches": ["*://*.newretailer.com/*"],
      "js": [
        "shared/utils.js",
        "shared/api-client.js",
        "content-scripts/newretailer-overlay.js"
      ],
      "css": ["content-scripts/overlay-styles.css"],
      "run_at": "document_idle"
    }
  ],
  "host_permissions": [
    "*://*.newretailer.com/*"
  ]
}
```

3. **Add tests**:

```javascript
// __tests__/content-scripts/newretailer-overlay.test.js
describe('NewRetailer Overlay', () => {
  it('should detect product page', () => {
    window.location.pathname = '/product/12345';
    expect(isProductPage()).toBe(true);
  });

  it('should extract product ID', () => {
    window.location.pathname = '/product/12345';
    expect(extractProductId()).toBe('12345');
  });
});
```

### Adding a New API Endpoint

1. **Add method to api-client.js**:

```javascript
// shared/api-client.js
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
```

2. **Add tests**:

```javascript
// __tests__/shared/api-client.test.js
it('should fetch product offers', async () => {
  const mockOffers = [{ retailer: 'Amazon', price: 19.99 }];
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ offers: mockOffers })
  });

  const result = await api.getProductOffers(123);

  expect(result).toEqual(mockOffers);
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/products/123/offers'),
    expect.any(Object)
  );
});
```

### Adding a UI Component

1. **Add to popup HTML**:

```html
<!-- popup/popup.html -->
<div class="new-section">
  <h3 class="section-title">New Feature</h3>
  <div id="new-feature-content"></div>
</div>
```

2. **Add styles**:

```css
/* popup/popup.css */
.new-section {
  padding: 15px 20px;
  border-bottom: 1px solid #e5e7eb;
}
```

3. **Add logic**:

```javascript
// popup/popup.js
async function loadNewFeature() {
  const data = await api.getNewFeatureData();
  document.getElementById('new-feature-content').innerHTML = renderData(data);
}

// Call during initialization
init() {
  // ... existing code
  await loadNewFeature();
}
```

---

## Testing

### Test-Driven Development (TDD)

We encourage TDD:

1. **Write test first**:

```javascript
// __tests__/shared/utils.test.js
it('should calculate discount percentage', () => {
  const original = 100;
  const current = 75;
  const result = calculateDiscount(original, current);
  expect(result).toBe(25); // 25% discount
});
```

2. **Implement function**:

```javascript
// shared/utils.js
function calculateDiscount(original, current) {
  if (original <= 0 || current < 0) return 0;
  return Math.round(((original - current) / original) * 100);
}
```

3. **Run tests**:

```bash
npm test -- --watch
```

### Test Coverage Requirements

- **Lines**: 80% minimum
- **Functions**: 75% minimum
- **Branches**: 70% minimum
- **Statements**: 80% minimum

Check coverage:
```bash
npm run test:coverage
```

### Writing Good Tests

✅ **DO**:
```javascript
// Clear test names
it('should return empty array when product not found', () => {});

// Arrange-Act-Assert pattern
it('should format price with currency symbol', () => {
  // Arrange
  const price = 19.99;

  // Act
  const result = formatPrice(price);

  // Assert
  expect(result).toBe('$19.99');
});

// Test edge cases
it('should handle null price', () => {
  expect(formatPrice(null)).toBe('N/A');
});
```

❌ **DON'T**:
```javascript
// Vague test names
it('should work', () => {});

// Testing implementation details
it('should call internal helper function', () => {});

// Tests that depend on each other
let sharedState;
it('test 1', () => { sharedState = 'value'; });
it('test 2', () => { expect(sharedState).toBe('value'); });
```

See [__tests__/README.md](__tests__/README.md) for comprehensive testing guide.

---

## Code Style

### JavaScript Style Guide

We follow industry-standard JavaScript conventions:

```javascript
// Use const/let, never var
const apiUrl = 'http://localhost:3000/api';
let counter = 0;

// Use arrow functions for callbacks
const filtered = items.filter(item => item.active);

// Use template literals
const message = `Hello, ${name}!`;

// Use async/await over callbacks
async function fetchData() {
  const response = await fetch(url);
  return await response.json();
}

// Destructuring
const { id, title, price } = product;
const [first, second] = array;

// Spread operator
const merged = { ...defaults, ...userOptions };

// Optional chaining
const title = product?.details?.title ?? 'Unknown';
```

### Naming Conventions

```javascript
// Variables and functions: camelCase
const userName = 'John';
function calculateTotal() {}

// Classes: PascalCase
class PriceCompareAPI {}

// Constants: UPPER_SNAKE_CASE
const API_TIMEOUT = 5000;
const MAX_RETRIES = 3;

// Private/internal: underscore prefix
function _internalHelper() {}

// Boolean variables: is/has/can prefix
const isLoading = true;
const hasData = false;
const canEdit = true;
```

### File Naming

- **JavaScript files**: `kebab-case.js`
  - `api-client.js`
  - `amazon-overlay.js`
  - `price-history-chart.js`

- **Test files**: `*.test.js`
  - `utils.test.js`
  - `api-client.test.js`

- **Documentation**: `UPPERCASE.md`
  - `README.md`
  - `ARCHITECTURE.md`
  - `CONTRIBUTING.md`

### Code Formatting

We use Prettier for consistent formatting:

```bash
# Format all files
npm run format

# Format on save (VS Code)
# Configured automatically with .vscode/settings.json
```

Prettier config (in `package.json`):
```json
{
  "prettier": {
    "semi": true,
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "none",
    "printWidth": 100
  }
}
```

### Linting

We use ESLint:

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

---

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic changes)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```bash
# Feature
git commit -m "feat(api): add price predictions endpoint"

# Bug fix
git commit -m "fix(amazon): correct ASIN extraction regex"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Test
git commit -m "test(storage): add tests for recent products"

# Multi-line commit
git commit -m "feat(overlay): add dark mode support

- Detect system dark mode preference
- Add dark mode CSS variables
- Update overlay styles for dark theme
- Add toggle in settings

Closes #123"
```

### Commit Best Practices

✅ **DO**:
- Write clear, descriptive commit messages
- Make atomic commits (one logical change per commit)
- Reference issues: `Closes #123` or `Fixes #456`
- Use present tense: "add feature" not "added feature"

❌ **DON'T**:
- Commit commented-out code
- Commit debug logs (`console.log`)
- Make huge commits with multiple unrelated changes
- Use vague messages like "fix stuff" or "update"

---

## Pull Request Process

### Before Creating PR

1. **Ensure all tests pass**:
   ```bash
   npm test
   ```

2. **Check code coverage**:
   ```bash
   npm run test:coverage
   ```

3. **Lint code**:
   ```bash
   npm run lint
   ```

4. **Manual testing** on all supported retailers

5. **Update documentation** if needed

### Creating the PR

1. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR on GitHub**:
   - Navigate to the repository
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template

3. **PR Title Format**:
   ```
   feat(scope): Brief description
   ```

4. **PR Description Template**:

   ```markdown
   ## Description
   Brief description of what this PR does

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   - [ ] Tested on Amazon
   - [ ] Tested on Best Buy
   - [ ] Tested on Generic retailers

   ## Screenshots (if applicable)
   Add screenshots of UI changes

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Comments added for complex logic
   - [ ] Documentation updated
   - [ ] No new warnings
   - [ ] Tests added/updated
   - [ ] All tests passing
   ```

### PR Review Process

1. **Automated checks** must pass:
   - Tests
   - Linting
   - Coverage thresholds

2. **Code review** by maintainers:
   - Code quality
   - Test coverage
   - Documentation
   - Performance implications

3. **Address feedback**:
   - Make requested changes
   - Push new commits
   - Re-request review

4. **Merge**:
   - Squash and merge (preferred)
   - Maintainers will merge when approved

---

## Getting Help

### Resources

- **Architecture Documentation**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Testing Guide**: [__tests__/README.md](__tests__/README.md)
- **User Documentation**: [README.md](README.md)
- **Chrome Extension Docs**: https://developer.chrome.com/docs/extensions/

### Communication

- **Issues**: Report bugs or request features via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions
- **Pull Requests**: For code contributions

### Common Issues

See [README.md - Troubleshooting](README.md#troubleshooting) section.

---

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions
- No harassment or discrimination

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

**Thank you for contributing to PriceCompare!** 🎉

Every contribution, no matter how small, helps make this extension better for everyone.
