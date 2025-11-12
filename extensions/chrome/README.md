# PriceCompare Browser Extension

A Chrome/Edge browser extension that displays price history charts directly on retailer product pages.

## Features

- 📊 **Price History Charts**: View price trends directly on Amazon, Best Buy, Walmart, Target, and eBay product pages
- 🔔 **Price Alerts**: Set price alerts right from the retailer's website
- 📈 **Price Statistics**: See lowest, highest, and average prices at a glance
- 🎯 **Smart Detection**: Automatically detects product pages and injects price data
- 💾 **Local Caching**: Fast loading with intelligent caching
- 🌐 **Multi-Retailer Support**: Works across major e-commerce platforms

## Supported Retailers

- Amazon.com
- BestBuy.com
- Walmart.com
- Target.com
- eBay.com

## Installation

### From Source (Development)

1. **Clone the repository**
   ```bash
   cd /path/to/PriceCompare/extensions/chrome
   ```

2. **Create placeholder icons** (temporary - replace with actual icons later)
   ```bash
   mkdir -p icons
   # Create simple placeholder icons (you can replace these with real icons)
   # For now, the extension will work without icons but Chrome will show warnings
   ```

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `extensions/chrome` directory
   - The extension should now be installed!

4. **Load the extension in Edge**
   - Open Edge and navigate to `edge://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extensions/chrome` directory

## Configuration

### API Endpoint

By default, the extension connects to `http://localhost:3000/api`. To change this:

1. Click the extension icon in your browser toolbar
2. Click "Settings"
3. Update the API Base URL
4. Save changes

You can also modify the default in:
- `shared/api-client.js` - Change the `baseUrl` property
- `manifest.json` - Update permissions if using a different domain

## Usage

### Automatic Price History Display

1. Navigate to any supported retailer's product page
2. The extension will automatically detect the product
3. If the product is in the PriceCompare database, a price history chart will appear
4. View price trends, statistics, and set price alerts

### Manual Actions

- **View Recent Products**: Click the extension icon to see recently viewed products
- **Set Price Alerts**: Enter your email and target price on any product page
- **Clear Cache**: Use the popup to clear cached data
- **Enable/Disable**: Toggle the extension on/off from the popup

## Architecture

### File Structure

```
extensions/chrome/
├── manifest.json           # Extension configuration
├── background.js          # Service worker for background tasks
├── shared/
│   ├── api-client.js     # API communication layer
│   ├── storage.js        # Chrome storage wrapper
│   └── utils.js          # Shared utilities
├── content-scripts/
│   ├── amazon-overlay.js    # Amazon-specific injection
│   ├── bestbuy-overlay.js   # Best Buy-specific injection
│   ├── generic-overlay.js   # Generic retailer support
│   └── overlay-styles.css   # Chart overlay styles
├── popup/
│   ├── popup.html        # Extension popup UI
│   ├── popup.css         # Popup styles
│   └── popup.js          # Popup logic
└── icons/
    ├── icon16.png        # 16x16 icon
    ├── icon48.png        # 48x48 icon
    └── icon128.png       # 128x128 icon
```

### How It Works

1. **Detection**: Content scripts run on supported retailer pages and detect product pages
2. **Product Matching**: Extracts product identifiers (ASIN, SKU, etc.) and searches PriceCompare API
3. **Data Fetching**: Retrieves price history, trends, and predictions from the API
4. **Injection**: Creates and injects a styled overlay with price charts and statistics
5. **Caching**: Stores frequently accessed data locally for faster loading

## Development

### Adding a New Retailer

1. **Create a new content script** (or extend `generic-overlay.js`)
   ```javascript
   // content-scripts/newretailer-overlay.js
   function isProductPage() {
     // Detect product page
   }

   function extractProductId() {
     // Extract product identifier
   }
   ```

2. **Update manifest.json**
   ```json
   {
     "content_scripts": [{
       "matches": ["*://*.newretailer.com/*"],
       "js": ["shared/utils.js", "shared/api-client.js", "content-scripts/newretailer-overlay.js"]
     }]
   }
   ```

3. **Add host permissions**
   ```json
   {
     "host_permissions": [
       "*://*.newretailer.com/*"
     ]
   }
   ```

### Testing

1. Make changes to the extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the PriceCompare extension
4. Navigate to a test product page
5. Check the browser console for logs (prefix: `[PriceCompare Extension]`)

### Debugging

- **Content Scripts**: Open DevTools on the retailer page, check Console
- **Background Script**: Go to `chrome://extensions/`, click "service worker" under the extension
- **Popup**: Right-click the extension icon → "Inspect popup"

## API Requirements

The extension requires the following API endpoints:

### Product Search
```
GET /api/products/search?url={productUrl}
Response: { product: { id, title, ... } }
```

### Price History
```
GET /api/products/{id}/price-history?days={days}
Response: { history: [{ price, recordedAt, retailer }] }
```

### Price Trend
```
GET /api/products/{id}/price-trend
Response: { trend: { direction, percentage, ... } }
```

### Create Alert
```
POST /api/products/{id}/alerts
Body: { targetPrice, email, createdFromChart }
Response: { alert: { id, ... } }
```

### Price Predictions (Optional)
```
GET /api/products/{id}/price-predictions?days={days}
Response: { predictions: [{ date, predictedPrice, confidence }] }
```

## Security & Privacy

- The extension only communicates with the configured PriceCompare API
- No tracking or analytics to third parties
- User email is stored locally and only sent when creating alerts
- Cache is stored locally using Chrome's storage API
- No sensitive data is transmitted

## Troubleshooting

### Extension not showing on product pages

1. Check that the product exists in PriceCompare database
2. Verify the API is running at the configured URL
3. Check browser console for error messages
4. Ensure the extension is enabled in settings

### "Failed to load price data"

1. Verify API endpoint is accessible
2. Check CORS settings on the API server
3. Ensure the product URL matches a tracked product
4. Check network tab in DevTools

### Charts not displaying

1. Clear extension cache via the popup
2. Reload the product page
3. Check that price history data exists for the product
4. Verify content scripts are running (check console)

## Future Enhancements

- [ ] SVG/Canvas charts for better visualization
- [ ] Dark mode support
- [ ] Customizable chart time ranges
- [ ] Price prediction display
- [ ] Comparison mode for multiple products
- [ ] Export price data as CSV
- [ ] Keyboard shortcuts
- [ ] Notification system for price drops

## Testing

The extension has comprehensive test coverage including unit tests, integration tests, and E2E tests.

### Running Tests

```bash
# Install dependencies
cd extensions/chrome
npm install

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
```

### Test Coverage

- **Unit Tests**: Utilities, API client, storage wrapper
- **Integration Tests**: Content scripts, product detection
- **E2E Tests**: Extension loading, basic functionality
- **Mocks**: Complete Chrome API mocks

**Current Coverage**: ~85%
- Lines: 80%+
- Functions: 75%+
- Branches: 70%+
- Statements: 80%+

See `__tests__/README.md` for detailed testing documentation.

### CI/CD

Tests run automatically on:
- Pull requests
- Pushes to main/develop branches
- Manual workflow dispatch

## Contributing

To contribute to the extension:

1. Create a feature branch
2. Make your changes
3. **Write tests** for new functionality
4. Run `npm test` to ensure all tests pass
5. Check coverage with `npm run test:coverage`
6. Test manually across all supported retailers
7. Submit a pull request

## License

This extension is part of the PriceCompare project.

## Support

For issues or questions:
- Check the [main project documentation](../../README.md)
- Open an issue on GitHub
- Contact the development team

---

**Version**: 1.0.0
**Last Updated**: 2025-11-11
**Manifest Version**: 3
