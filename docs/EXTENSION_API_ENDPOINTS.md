# Browser Extension API Endpoints

This document describes the API endpoints specifically designed for the PriceCompare browser extension integration.

## Overview

The backend has been extended to support the browser extension with several new endpoints that provide:
- Product search by URL
- Price history data
- Price trend analysis
- Price predictions
- Product offers comparison
- Analytics tracking

## Authentication

Most endpoints are public and don't require authentication, as the extension needs to work for all users. Price alerts require authentication.

## Base URL

Development: `http://localhost:3000/api`
Production: Configure via extension settings

---

## Endpoints

### 1. Product Search by URL

**Endpoint:** `GET /api/products/search?url={productUrl}`

**Description:** Search for a product in the database by its URL. Used when the extension detects a product page.

**Query Parameters:**
- `url` (string, required): The product page URL (will be URL-encoded)

**Request Example:**
```bash
GET /api/products/search?url=https%3A%2F%2Famazon.com%2Fiphone
```

**Response Format:**
```json
{
  "product": {
    "id": 1,
    "name": "iPhone 15 Pro 128GB",
    "description": "Latest iPhone with titanium design",
    "category": "Smartphones",
    "brand": "Apple",
    "model": "iPhone 15 Pro",
    "image": "https://...",
    "offers": [
      {
        "id": 1,
        "retailerId": 1,
        "retailerName": "Amazon",
        "price": 999.99,
        "originalPrice": 1199.99,
        "availability": "in_stock",
        "rating": 4.5,
        "reviewCount": 2431,
        "productUrl": "https://...",
        "affiliateUrl": null
      }
    ],
    "bestPrice": 999.99
  }
}
```

**Error Response (Not Found):**
```json
{
  "product": null
}
```

---

### 2. Get Price History

**Endpoint:** `GET /api/products/:id/price-history?days={days}&retailerId={retailerId}`

**Description:** Get historical price data for a product. Used to render the price chart in the extension overlay.

**Path Parameters:**
- `id` (number, required): Product ID

**Query Parameters:**
- `days` (number, optional): Number of days of history to return (default: 30)
- `retailerId` (number, optional): Filter by specific retailer

**Request Example:**
```bash
GET /api/products/1/price-history?days=30
```

**Response Format:**
```json
{
  "history": [
    {
      "date": "2025-01-01T00:00:00.000Z",
      "price": 999.99,
      "retailerId": 1,
      "retailerName": "Amazon",
      "availability": "in_stock"
    },
    {
      "date": "2025-01-02T00:00:00.000Z",
      "price": 989.99,
      "retailerId": 1,
      "retailerName": "Amazon",
      "availability": "in_stock"
    }
  ]
}
```

---

### 3. Get Price Trend

**Endpoint:** `GET /api/products/:id/price-trend`

**Description:** Get price trend analysis including direction (rising/falling/stable) and predictions.

**Path Parameters:**
- `id` (number, required): Product ID

**Request Example:**
```bash
GET /api/products/1/price-trend
```

**Response Format:**
```json
{
  "trend": {
    "direction": "falling",
    "change": -5.2,
    "changePercent": -5.2,
    "currentPrice": 999.99,
    "averagePrice": 1050.00,
    "lowestPrice": 989.99,
    "highestPrice": 1199.99
  },
  "prediction": "good_time"
}
```

**Prediction Values:**
- `good_time`: Good time to buy (price is stable or low)
- `might_drop`: Price might drop further (wait)
- `wait`: Price is rising (wait for it to stabilize)

---

### 4. Get Product Offers

**Endpoint:** `GET /api/products/:id/offers`

**Description:** Get current offers from all retailers for a product.

**Path Parameters:**
- `id` (number, required): Product ID

**Request Example:**
```bash
GET /api/products/1/offers
```

**Response Format:**
```json
{
  "offers": [
    {
      "id": 1,
      "retailerId": 1,
      "retailerName": "Amazon",
      "retailerLogo": "https://logo.clearbit.com/amazon.com",
      "price": 999.99,
      "originalPrice": 1199.99,
      "rating": 4.5,
      "reviewCount": 2431,
      "availability": "in_stock",
      "shippingInfo": "Free shipping",
      "dealType": "best_price",
      "url": "https://amazon.com/iphone",
      "affiliateUrl": null
    },
    {
      "id": 2,
      "retailerId": 2,
      "retailerName": "Best Buy",
      "retailerLogo": "https://logo.clearbit.com/bestbuy.com",
      "price": 1049.99,
      "originalPrice": 1199.99,
      "rating": 4.3,
      "reviewCount": 1892,
      "availability": "in_stock",
      "shippingInfo": "Store pickup available",
      "dealType": null,
      "url": "https://bestbuy.com/iphone",
      "affiliateUrl": null
    }
  ]
}
```

---

### 5. Get Price Predictions

**Endpoint:** `GET /api/products/:id/price-predictions?days={days}`

**Description:** Get AI-powered price predictions for future dates.

**Path Parameters:**
- `id` (number, required): Product ID

**Query Parameters:**
- `days` (number, optional): Number of days to predict (default: 7, max: 30)

**Request Example:**
```bash
GET /api/products/1/price-predictions?days=7
```

**Response Format:**
```json
{
  "predictions": [
    {
      "date": "2025-01-15",
      "predictedPrice": 995.50,
      "confidence": 0.85
    },
    {
      "date": "2025-01-16",
      "predictedPrice": 992.30,
      "confidence": 0.78
    }
  ],
  "confidence": "medium",
  "basePrice": 999.99,
  "averageDailyChange": -1.2
}
```

**Confidence Levels:**
- `high`: 30+ days of historical data, stable trends
- `medium`: 7-29 days of historical data
- `low`: Less than 7 days of historical data

**Error Response (Insufficient Data):**
```json
{
  "predictions": [],
  "confidence": "low",
  "message": "Not enough historical data for predictions"
}
```

---

### 6. Track Product View (Analytics)

**Endpoint:** `POST /api/analytics/product-view`

**Description:** Track when a user views a product via the extension. Fire-and-forget endpoint for analytics.

**Request Body:**
```json
{
  "productId": 1,
  "source": "extension",
  "retailer": "amazon"
}
```

**Request Example:**
```bash
POST /api/analytics/product-view
Content-Type: application/json

{
  "productId": 1,
  "source": "extension",
  "retailer": "amazon"
}
```

**Response Format:**
```json
{
  "success": true
}
```

**Note:** This endpoint logs the view to console in development. In production, it should be connected to an analytics service.

---

### 7. Create Price Alert

**Endpoint:** `POST /api/price-alerts`

**Description:** Create a price alert for a product. Requires authentication.

**Authentication:** Required (session cookie)

**Request Body:**
```json
{
  "productId": 1,
  "targetPrice": 899.99,
  "notifyForum": false
}
```

**Request Example:**
```bash
POST /api/price-alerts
Content-Type: application/json
Cookie: connect.sid=...

{
  "productId": 1,
  "targetPrice": 899.99,
  "notifyForum": false
}
```

**Response Format:**
```json
{
  "success": true,
  "alert": {
    "id": 1,
    "userId": 1,
    "productId": 1,
    "targetPrice": "899.99",
    "isActive": true,
    "createdAt": "2025-01-10T00:00:00.000Z"
  }
}
```

---

## Extension Implementation Notes

### API Client Usage

The extension uses a centralized API client (`shared/api-client.js`) that:
- Caches responses for 5 minutes
- Handles errors gracefully
- Supports configurable base URL
- Normalizes URLs before searching

### Response Caching

The extension caches responses locally to reduce API calls:
- Product searches: 5 minutes
- Price history: 5 minutes
- Price trends: 5 minutes
- Offers: 5 minutes

### Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (authentication required)
- `404`: Not found
- `500`: Internal server error

The extension should handle these gracefully and show appropriate messages to users.

---

## Testing

### Example cURL Commands

**Search by URL:**
```bash
curl "http://localhost:3000/api/products/search?url=https%3A%2F%2Famazon.com%2Fiphone"
```

**Get Price History:**
```bash
curl "http://localhost:3000/api/products/1/price-history?days=30"
```

**Get Price Trend:**
```bash
curl "http://localhost:3000/api/products/1/price-trend"
```

**Get Offers:**
```bash
curl "http://localhost:3000/api/products/1/offers"
```

**Get Predictions:**
```bash
curl "http://localhost:3000/api/products/1/price-predictions?days=7"
```

**Track View:**
```bash
curl -X POST "http://localhost:3000/api/analytics/product-view" \
  -H "Content-Type: application/json" \
  -d '{"productId": 1, "source": "extension"}'
```

---

## Performance Considerations

1. **Database Indexes**: Ensure indexes exist on:
   - `product_offers.product_url` for URL-based searches
   - `price_history.product_id` and `price_history.recorded_at` for history queries
   - `product_offers.product_id` for offers lookup

2. **Caching**: Consider adding Redis caching layer for frequently accessed data

3. **Rate Limiting**: Extension should respect rate limits (currently 100 req/15min for general endpoints)

---

## Security

1. **Input Validation**: All numeric IDs are validated using `parseIntSafe` to prevent injection attacks
2. **URL Sanitization**: Product URLs are sanitized before database lookups
3. **CORS**: Ensure proper CORS headers are set for extension origin
4. **Authentication**: Price alerts require valid session authentication

---

## Future Enhancements

1. **WebSocket Support**: Real-time price drop notifications
2. **Batch Requests**: Support for multiple product lookups in single request
3. **Advanced Predictions**: ML-based price prediction models
4. **User Preferences**: Personalized recommendations based on viewing history
5. **Product Registration**: Allow extension to register new products not in database
