# HTTP Basic Authentication for AI Agents

This document describes the HTTP Basic Auth implementation for agent-native API access.

## Overview

AI agents can now authenticate to core platform endpoints using HTTP Basic Authentication instead of session cookies and CSRF tokens.

**Authentication Method**: `Authorization: Basic base64(username:password)`

**Agent Coverage**: 14 endpoints (7% of total API surface)

## Endpoints

All agent-native endpoints are available under `/api/v1/*` with HTTP Basic Auth.

### Scraping Operations (Admin Only)

### POST /api/v1/scraping/discover-trends
Discover trending products from external sources.

**Request**:
```bash
curl -u "admin:password" \
  -X POST http://localhost:5000/api/v1/scraping/discover-trends \
  -H "Content-Type: application/json" \
  -d '{
    "sources": ["google_trends"],
    "limit": 20
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Trend discovery completed",
  "result": { ... }
}
```

### POST /api/v1/scraping/initialize
Initialize the AI scraping system.

**Request**:
```bash
curl -u "admin:password" \
  -X POST http://localhost:5000/api/v1/scraping/initialize
```

### POST /api/v1/scraping/start-agents
Start scraping agents.

**Request**:
```bash
curl -u "admin:password" \
  -X POST http://localhost:5000/api/v1/scraping/start-agents
```

### POST /api/v1/scraping/search-product
Search for a specific product.

**Request**:
```bash
curl -u "admin:password" \
  -X POST http://localhost:5000/api/v1/scraping/search-product \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "iPhone 15",
    "category": "electronics"
  }'
```

### POST /api/v1/scraping/google-search
Perform Google search for products across retailers.

**Request**:
```bash
curl -u "admin:password" \
  -X POST http://localhost:5000/api/v1/scraping/google-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "gaming laptop",
    "retailers": ["amazon.com", "walmart.com"],
    "maxResults": 10
  }'
```

### GET /api/v1/scraping/status
Get current scraping system status.

**Request**:
```bash
curl -u "admin:password" http://localhost:5000/api/v1/scraping/status
```

---

### Watchlist Operations (Authenticated Users)

#### GET /api/v1/watchlists
Get all watch lists for the authenticated user.

**Request**:
```bash
curl -u "username:password" http://localhost:5000/api/v1/watchlists
```

**Response**:
```json
{
  "success": true,
  "data": {
    "watchLists": [
      {
        "id": 1,
        "userId": 1,
        "name": "Holiday Shopping",
        "description": "Items for holiday gifts",
        "productCount": 5,
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### GET /api/v1/watchlists/:id
Get a specific watch list with all products and pricing details.

**Request**:
```bash
curl -u "username:password" http://localhost:5000/api/v1/watchlists/1
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Holiday Shopping",
    "products": [
      {
        "id": 1,
        "name": "Product Name",
        "currentPrice": "99.99",
        "priceDropPercent": 15.5
      }
    ]
  }
}
```

#### GET /api/v1/watchlists/:id/products
Get products in a specific watch list.

**Request**:
```bash
curl -u "username:password" http://localhost:5000/api/v1/watchlists/1/products
```

**Response**:
```json
{
  "success": true,
  "data": {
    "products": [...]
  }
}
```

---

### Price Alert Operations (Authenticated Users)

#### GET /api/v1/price-alerts
Get all price alerts for the authenticated user.

**Request**:
```bash
curl -u "username:password" http://localhost:5000/api/v1/price-alerts
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "productId": 10,
      "targetPrice": "79.99",
      "isActive": true,
      "productName": "Product Name",
      "currentPrice": "89.99"
    }
  ]
}
```

#### GET /api/v1/price-alerts/:id
Get a specific price alert by ID.

**Request**:
```bash
curl -u "username:password" http://localhost:5000/api/v1/price-alerts/1
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "targetPrice": "79.99",
    "isActive": true
  }
}
```

---

### Product Operations (Public/Authenticated)

#### GET /api/v1/products/search
Search products with filters.

**Request**:
```bash
# Search by query
curl -u "username:password" \
  "http://localhost:5000/api/v1/products/search?query=laptop&minPrice=500&maxPrice=1500"

# Search by URL (browser extension)
curl -u "username:password" \
  "http://localhost:5000/api/v1/products/search?url=https://amazon.com/product/123"
```

**Query Parameters**:
- `query` - Search query string
- `category` - Product category
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter
- `retailers` - Retailer ID filter (array)
- `minRating` - Minimum rating (0-5)
- `availability` - Availability filter (array)
- `sortBy` - Sort order: `price_low`, `price_high`, `rating`, `popularity`
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)
- `url` - Product URL for direct lookup

**Response**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### GET /api/v1/products/:id
Get product details by ID.

**Request**:
```bash
curl -u "username:password" http://localhost:5000/api/v1/products/10
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 10,
    "name": "Product Name",
    "description": "Product description",
    "category": "electronics",
    "imageUrl": "https://...",
    "offers": [...]
  }
}
```

#### GET /api/v1/products/:id/price-history
Get price history for a product.

**Request**:
```bash
# All retailers, last 30 days
curl -u "username:password" http://localhost:5000/api/v1/products/10/price-history

# Specific retailer, last 90 days
curl -u "username:password" \
  "http://localhost:5000/api/v1/products/10/price-history?days=90&retailerId=1"
```

**Query Parameters**:
- `days` - Number of days of history (default: 30)
- `retailerId` - Filter by specific retailer ID

**Response**:
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "date": "2025-01-01T00:00:00Z",
        "price": 99.99,
        "retailerId": 1,
        "retailerName": "Amazon",
        "availability": "in_stock"
      }
    ]
  }
}
```

---

### Notification Operations (Authenticated Users)

#### GET /api/v1/notifications
Get user's notifications with optional filters.

**Request**:
```bash
# All notifications
curl -u "username:password" http://localhost:5000/api/v1/notifications

# Unread notifications only
curl -u "username:password" \
  "http://localhost:5000/api/v1/notifications?isRead=false&limit=20"
```

**Query Parameters**:
- `isRead` - Filter by read status: `true`, `false`
- `type` - Filter by notification type
- `limit` - Results per page (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "userId": 1,
        "type": "price_drop",
        "title": "Price Drop Alert",
        "message": "Product X dropped to $79.99",
        "isRead": false,
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "count": 1
  }
}
```

---

## Security

### Transport Security
- **HTTPS Required**: In production, Basic Auth MUST be used over HTTPS only
- HTTP Basic Auth sends credentials with every request (Base64 encoded)
- HTTPS encrypts the entire request, including the Authorization header

### No CSRF Tokens Required
API v1 endpoints do not require CSRF tokens because:
- Basic Auth is stateless (no session cookies)
- Each request includes credentials
- CSRF attacks exploit session cookies, which aren't used here

### Authorization
- All scraping endpoints require **admin role**
- User authentication is verified on every request
- Suspended/inactive accounts are rejected

## Implementation Details

### Middleware Stack
```typescript
app.post('/api/v1/scraping/discover-trends',
  basicAuth,          // 1. Verify HTTP Basic Auth credentials
  withAdmin(async (req, res) => {  // 2. Verify admin role
    // Business logic
  })
);
```

### Basic Auth Middleware
Located in `server/middleware/basic-auth.ts`:
1. Checks for `Authorization: Basic` header
2. Decodes Base64 credentials
3. Looks up user by username
4. Verifies password using bcrypt
5. Attaches user to `req.user`
6. Falls through to session auth if no Basic Auth header

### Comparison with Session Auth

| Feature | Session Auth (`/api/*`) | Basic Auth (`/api/v1/*`) |
|---------|------------------------|--------------------------|
| **Authentication** | Session cookies + Passport.js | HTTP Basic Auth |
| **CSRF Protection** | Required | Not needed |
| **State** | Stateful (server session) | Stateless |
| **Use Case** | Browser-based users | AI agents & automation |
| **Credential Storage** | Cookie (httpOnly) | Auth header per request |
| **Rotation** | Logout/login | Change password |

## Python Example

```python
import requests

# Basic Auth is built into requests library
response = requests.post(
    'https://api.pricecompare.com/api/v1/scraping/discover-trends',
    auth=('admin', 'password'),  # Automatically encodes to Basic Auth
    json={'sources': ['google_trends'], 'limit': 20}
)

print(response.json())
```

## Node.js Example

```javascript
const response = await fetch('http://localhost:5000/api/v1/scraping/discover-trends', {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + Buffer.from('admin:password').toString('base64'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ sources: ['google_trends'], limit: 20 })
});

const data = await response.json();
console.log(data);
```

## Best Practices

### DO:
✅ Use HTTPS in production (never HTTP)
✅ Store credentials in environment variables
✅ Use strong, unique passwords for admin accounts
✅ Rotate passwords regularly (every 90 days)
✅ Monitor authentication logs for suspicious activity

### DON'T:
❌ Hardcode credentials in code or scripts
❌ Share admin passwords between users
❌ Use Basic Auth over HTTP in production
❌ Log credentials in error messages or logs
❌ Reuse passwords across environments

## Troubleshooting

### 401 Unauthorized
**Cause**: Invalid credentials or inactive account
**Solution**: Verify username/password, check if account is active

### 403 Forbidden
**Cause**: Non-admin user attempting admin operation
**Solution**: Use admin account or request admin access

### 500 Authentication Error
**Cause**: Database connection failure or internal error
**Solution**: Check server logs, verify database connectivity

## When to Upgrade to API Keys

Consider migrating to API keys when:
- You have 100+ API users requesting individual keys
- You need per-key rate limiting
- You require key-level usage analytics
- Compliance requires key rotation without password changes

Until then, HTTP Basic Auth is simpler, faster, and perfectly secure over HTTPS.

## References

- [RFC 7617 - HTTP Basic Authentication](https://tools.ietf.org/html/rfc7617)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- Implementation: `server/middleware/basic-auth.ts`
- Routes: `server/routes/api-v1-routes.ts`
