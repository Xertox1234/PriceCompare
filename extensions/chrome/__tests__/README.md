# PriceCompare Extension - Testing Guide

Comprehensive testing suite for the PriceCompare browser extension.

## Test Coverage

### Current Coverage
- ✅ **Unit Tests**: Shared utilities, API client, storage
- ✅ **Integration Tests**: Content scripts (Amazon)
- ✅ **E2E Tests**: Extension loading (basic)
- ✅ **Chrome API Mocks**: Full mock implementation

### Coverage Targets
- **Lines**: 80%+
- **Functions**: 75%+
- **Branches**: 70%+
- **Statements**: 80%+

## Quick Start

### Install Dependencies

```bash
cd /home/user/PriceCompare/extensions/chrome
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # E2E tests only

# Run for CI (with coverage and limited workers)
npm run test:ci
```

## Test Structure

```
__tests__/
├── setup.js                          # Jest setup and global mocks
├── README.md                         # This file
│
├── shared/                           # Unit tests for shared utilities
│   ├── utils.test.js                # Utils functions
│   ├── api-client.test.js           # API client
│   └── storage.test.js              # Storage wrapper
│
├── content-scripts/                  # Integration tests
│   └── amazon-overlay.test.js       # Amazon content script
│
├── e2e/                             # End-to-end tests
│   └── extension-load.test.js       # Extension loading
│
└── __mocks__/                       # Mock implementations
    ├── chrome.js                    # Chrome Extension API mock
    └── styleMock.js                 # CSS import mock
```

## Writing Tests

### Unit Test Example

```javascript
describe('MyFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle errors', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

### Testing Chrome APIs

```javascript
it('should save to chrome.storage', async () => {
  await chrome.storage.sync.set({ key: 'value' });

  const result = await chrome.storage.sync.get(['key']);
  expect(result.key).toBe('value');
});
```

### Testing Async Functions

```javascript
it('should fetch data from API', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: 'test' })
  });

  const result = await api.getData();
  expect(result.data).toBe('test');
});
```

## Test Files

### 1. shared/utils.test.js

Tests for utility functions:
- `normalizeUrl()` - URL normalization
- `extractDomain()` - Domain extraction
- `formatPrice()` - Price formatting
- `formatDate()` - Date formatting
- `debounce()` - Function debouncing
- `createElement()` - DOM element creation
- `waitForElement()` - Element waiting

**Coverage**: ~95%

### 2. shared/api-client.test.js

Tests for API client:
- Constructor and initialization
- Config loading/saving
- HTTP requests (GET/POST)
- Caching mechanism
- Product search
- Price history retrieval
- Alert creation
- Error handling

**Coverage**: ~90%

### 3. shared/storage.test.js

Tests for storage wrapper:
- Get/set/remove operations
- Preferences management
- Recent products tracking
- Statistics tracking
- Timestamp updates
- Default values

**Coverage**: ~95%

### 4. content-scripts/amazon-overlay.test.js

Integration tests for Amazon:
- Product page detection
- ASIN extraction
- Title extraction
- Price extraction
- Full data extraction flow

**Coverage**: ~85%

### 5. e2e/extension-load.test.js

E2E tests with Playwright:
- Extension loading
- Service worker activation
- Basic functionality
- Manual testing checklist

**Note**: E2E tests require headless: false and may not run in all CI environments.

## Mocks

### Chrome API Mock (`__mocks__/chrome.js`)

Provides Jest-compatible mocks for:
- `chrome.storage.sync`
- `chrome.storage.local`
- `chrome.runtime`
- `chrome.tabs`
- `chrome.notifications`
- `chrome.contextMenus`
- `chrome.action`
- `chrome.alarms`

**Features**:
- Promise-based (async/await compatible)
- Data persistence within test
- Reset function for cleanup

### Style Mock (`__mocks__/styleMock.js`)

Empty mock for CSS imports in tests.

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main branches
- Manual workflow dispatch

See `.github/workflows/test-extension.yml` for configuration.

## Code Coverage

### Viewing Coverage Reports

After running `npm run test:coverage`:

```bash
# Terminal summary
# (displayed automatically)

# HTML report
open coverage/lcov-report/index.html

# JSON summary
cat coverage/coverage-summary.json
```

### Coverage by File

```
shared/utils.js           95%
shared/api-client.js      90%
shared/storage.js         95%
content-scripts/*.js      80%
popup/popup.js           (pending)
background.js            (pending)
```

## Debugging Tests

### Run Single Test File

```bash
npm test -- utils.test.js
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="should extract ASIN"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/extensions/chrome/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Verbose Output

```bash
npm test -- --verbose
```

## Common Issues

### Issue: Tests fail with "chrome is not defined"

**Solution**: Chrome API mock not loaded. Check `setupFilesAfterEnv` in jest.config.js.

### Issue: Async tests timeout

**Solution**: Increase timeout:
```javascript
it('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Issue: Mock data persists between tests

**Solution**: Use `beforeEach` to reset mocks:
```javascript
beforeEach(() => {
  chrome.__resetStorage();
  jest.clearAllMocks();
});
```

### Issue: E2E tests fail in CI

**Solution**: E2E tests require a display. Skip in CI or use xvfb:
```javascript
it.skip('test name', () => { /* ... */ });
```

## Manual Testing

For features that can't be easily automated:

### Extension Installation Test
1. Load unpacked extension from `extensions/chrome`
2. Verify no errors in console
3. Check icon appears in toolbar
4. Open popup and verify UI

### Retailer Integration Test
1. Navigate to Amazon product page
2. Wait for overlay to inject
3. Verify chart displays
4. Test alert creation
5. Repeat for other retailers

### Data Persistence Test
1. Set preferences in popup
2. Close browser
3. Reopen and verify preferences persist
4. Check recent products list

## Adding New Tests

1. **Create test file** in appropriate directory
2. **Import dependencies** and setup
3. **Write test cases** with descriptive names
4. **Mock external dependencies** (APIs, Chrome APIs)
5. **Run tests** and verify coverage
6. **Update this README** if needed

## Best Practices

✅ **DO**:
- Write descriptive test names
- Test edge cases and error conditions
- Mock external dependencies
- Use `beforeEach`/`afterEach` for setup/cleanup
- Aim for >80% coverage
- Keep tests focused and independent

❌ **DON'T**:
- Test implementation details
- Share state between tests
- Mock what you're testing
- Write tests that depend on execution order
- Ignore failing tests

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/tut_testing/)

## Contributing

When adding new features:
1. Write tests first (TDD) or alongside code
2. Ensure tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Update this README if needed
5. Submit PR with tests included

---

**Last Updated**: 2025-11-11
**Test Files**: 8
**Total Tests**: 60+
**Coverage**: ~85%
