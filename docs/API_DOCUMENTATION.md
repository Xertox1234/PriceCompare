# Insightify API Documentation

## Overview
The Insightify REST API provides endpoints for product search, price comparison, and retailer information. All endpoints return JSON data and follow RESTful conventions.

## Base URL
- Development: `http://localhost:5000/api`
- Production: `https://your-domain.com/api`

## Authentication
Currently, the API is open and does not require authentication. Future versions will implement API key authentication.

## Rate Limiting

All API endpoints are protected by a tiered rate limiting system that prevents abuse while allowing legitimate usage. Rate limits are enforced per IP address for anonymous users and per user ID for authenticated users.

### Overview

- **Window**: 15 minutes (sliding window)
- **Enforcement**: Distributed Redis-based rate limiting (works across multiple servers)
- **Headers**: Rate limit information included in every API response
- **Exceeded**: Returns `429 Too Many Requests` when limit is exceeded

### Rate Limit Tiers

Different user types receive different rate limits based on their tier:

| Tier | User Type | Requests per 15 min | Multiplier | Notes |
|------|-----------|---------------------|------------|-------|
| **anonymous** | Unauthenticated users | 50 | 0.5x | Not logged in, tracked by IP |
| **free** | Free registered users | 50 | 0.5x | Registered but no subscription |
| **user** | Standard authenticated users | 100 | 1x | Base tier for logged-in users |
| **premium** | Premium/Paid subscribers | 500 | 5x | Paid subscription tier |
| **moderator** | Moderator users | 1,000 | 10x | Community moderators |
| **admin** | Admin users | 10,000 | 100x | System administrators |

**Note**: The tier is determined automatically based on authentication status and user role. Anonymous requests are tracked by IP address.

### Response Headers

Every API response includes the following rate limit headers:

#### X-RateLimit-Limit
Total number of requests allowed in the current window for your tier.

```
X-RateLimit-Limit: 100
```

#### X-RateLimit-Remaining
Number of requests remaining in the current window.

```
X-RateLimit-Remaining: 87
```

#### X-RateLimit-Reset
Unix timestamp (seconds since epoch) when the rate limit window resets.

```
X-RateLimit-Reset: 1700000000
```

#### X-RateLimit-Tier
Your current rate limit tier name.

```
X-RateLimit-Tier: user
```

### Rate Limit Exceeded Response

When you exceed your rate limit, the API returns a `429 Too Many Requests` response:

**Status Code**: `429 Too Many Requests`

**Headers**:
```
Retry-After: 342
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000342
X-RateLimit-Tier: user
```

**Response Body**:
```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "retryAfter": 342,
  "limit": 100,
  "tier": "user"
}
```

The `Retry-After` header and `retryAfter` field indicate how many seconds you should wait before making another request.

### Best Practices

#### 1. Monitor Rate Limit Headers
Always check the `X-RateLimit-Remaining` header to track your usage:

```typescript
const response = await fetch('/api/products');
const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');

if (remaining < 10) {
  console.warn('Approaching rate limit, consider throttling requests');
}
```

#### 2. Handle 429 Responses Gracefully
Implement retry logic with exponential backoff:

```typescript
async function apiRequest(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      console.log(`Rate limited, retrying after ${retryAfter} seconds`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

#### 3. Implement Exponential Backoff
When approaching limits, reduce request frequency exponentially:

```typescript
async function fetchWithBackoff(url: string) {
  const response = await fetch(url);
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '100');
  const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '100');

  // If we're below 20% remaining, slow down requests
  if (remaining < limit * 0.2) {
    const backoffMs = Math.min(5000, (1 - remaining / limit) * 10000);
    await new Promise(resolve => setTimeout(resolve, backoffMs));
  }

  return response;
}
```

#### 4. Cache Responses
Cache API responses locally to reduce request volume:

```typescript
const cache = new Map();

async function getCachedProduct(id: number) {
  const cacheKey = `product:${id}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
    return cached.data;
  }

  const response = await fetch(`/api/products/${id}`);
  const data = await response.json();

  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

#### 5. Consider Upgrading
If you consistently hit rate limits:

- **Sign up for an account**: Get 2x the anonymous limit (50 → 100 requests/15min)
- **Upgrade to Premium**: Get 5x the base limit (500 requests/15min)
- **Contact support**: For enterprise needs requiring custom limits

### Code Examples

#### Reading Rate Limit Information

```typescript
async function checkRateLimitStatus() {
  const response = await fetch('/api/products');

  const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0');
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
  const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');
  const tier = response.headers.get('X-RateLimit-Tier') || 'unknown';

  const resetDate = new Date(reset * 1000);
  const secondsUntilReset = Math.max(0, Math.floor((reset * 1000 - Date.now()) / 1000));

  console.log(`Rate Limit Status:
    Tier: ${tier}
    Limit: ${limit} requests per 15 minutes
    Remaining: ${remaining}
    Resets: ${resetDate.toLocaleString()} (in ${secondsUntilReset}s)
  `);

  return { limit, remaining, reset, tier, secondsUntilReset };
}
```

#### Complete Retry Logic with Rate Limit Handling

```typescript
interface FetchOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: FetchOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000
  } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success - return response
      if (response.ok) {
        return response;
      }

      // Rate limit exceeded
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        const delay = Math.min(retryAfter * 1000, maxDelay);

        console.log(`Rate limited. Waiting ${delay / 1000}s before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Other errors
      if (response.status >= 500) {
        // Server error - use exponential backoff
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        console.log(`Server error (${response.status}). Retrying in ${delay / 1000}s`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Client error (4xx) - don't retry
      return response;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        console.log(`Request failed: ${lastError.message}. Retrying in ${delay / 1000}s`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

// Usage
try {
  const response = await fetchWithRetry('/api/products/search?query=laptop', {
    headers: { 'Content-Type': 'application/json' }
  }, {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 60000
  });

  const data = await response.json();
  console.log('Products:', data);
} catch (error) {
  console.error('Failed to fetch products after retries:', error);
}
```

## Endpoints

### Retailers

#### GET /retailers
Returns a list of all active retailers in the system.

**Response Format:**
```json
[
  {
    "id": 1,
    "name": "Amazon",
    "logo": "https://logo.clearbit.com/amazon.com",
    "website": "https://amazon.com",
    "isActive": true
  }
]
```

**Response Codes:**
- `200 OK`: Success
- `500 Internal Server Error`: Server error

### Products

#### GET /products
Returns a list of featured products sorted by popularity.

**Response Format:**
```json
[
  {
    "id": 1,
    "name": "iPhone 15 Pro 128GB",
    "description": "Latest iPhone with titanium design",
    "category": "Smartphones",
    "image": "https://example.com/image.jpg",
    "brand": "Apple",
    "model": "iPhone 15 Pro",
    "createdAt": "2024-12-25T12:00:00Z",
    "offers": [
      {
        "id": 1,
        "productId": 1,
        "retailerId": 1,
        "price": "999.99",
        "originalPrice": "1199.99",
        "availability": "in_stock",
        "rating": "4.5",
        "reviewCount": 2431,
        "shippingInfo": "Free shipping",
        "dealType": "best_price",
        "productUrl": "https://amazon.com/iphone",
        "lastUpdated": "2024-12-25T12:00:00Z",
        "retailer": {
          "id": 1,
          "name": "Amazon",
          "logo": "https://logo.clearbit.com/amazon.com",
          "website": "https://amazon.com",
          "isActive": true
        }
      }
    ],
    "bestPrice": 999.99,
    "savings": 200.00,
    "savingsPercentage": 17
  }
]
```

#### GET /products/search
Search for products with optional filters.

**Query Parameters:**
- `query` (string): Search term for product name, description, brand, or category
- `category` (string): Filter by product category
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `retailers` (number[]): Array of retailer IDs to filter by
- `minRating` (number): Minimum rating filter (1-5)
- `availability` (string[]): Array of availability statuses (`in_stock`, `limited_stock`, `out_of_stock`)
- `sortBy` (string): Sort order (`price_low`, `price_high`, `rating`, `popularity`)

**Example Request:**
```
GET /products/search?query=iphone&minPrice=500&maxPrice=1500&sortBy=price_low
```

**Response Format:**
Same as `/products` endpoint, filtered and sorted according to parameters.

**Response Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Server error

#### GET /products/:id
Get detailed information for a specific product.

**Path Parameters:**
- `id` (number): Product ID

**Response Format:**
Same as individual product object from `/products` endpoint.

**Response Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid product ID
- `404 Not Found`: Product not found
- `500 Internal Server Error`: Server error

## Data Types

### Product
```typescript
{
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  image: string | null;
  brand: string | null;
  model: string | null;
  createdAt: Date;
}
```

### Retailer
```typescript
{
  id: number;
  name: string;
  logo: string | null;
  website: string | null;
  isActive: boolean;
}
```

### ProductOffer
```typescript
{
  id: number;
  productId: number;
  retailerId: number;
  price: string;
  originalPrice: string | null;
  availability: string | null;
  rating: string | null;
  reviewCount: number | null;
  shippingInfo: string | null;
  dealType: string | null;
  productUrl: string | null;
  lastUpdated: Date;
}
```

### ProductWithOffers
```typescript
{
  ...Product;
  offers: (ProductOffer & { retailer: Retailer })[];
  bestPrice?: number;
  savings?: number;
  savingsPercentage?: number;
}
```

## Error Responses

All error responses follow this format:
```json
{
  "message": "Error description"
}
```

### Common Error Codes
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded (see Rate Limiting section)
- `500 Internal Server Error`: Server error

## Caching
API responses are cached on the client side for 5 minutes. The server includes appropriate cache headers for static content.

## Versioning
The current API version is v1. Future versions will be available at `/api/v2`, etc.

## Examples

### Search for MacBooks under $2000
```bash
curl "http://localhost:5000/api/products/search?query=macbook&maxPrice=2000&sortBy=price_low"
```

### Get all products from Amazon and Best Buy
```bash
curl "http://localhost:5000/api/products/search?retailers=1&retailers=2"
```

### Search for highly rated smartphones
```bash
curl "http://localhost:5000/api/products/search?category=Smartphones&minRating=4&sortBy=rating"
```

Last Updated: December 25, 2024