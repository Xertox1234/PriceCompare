# PriceCompare API Documentation

## Overview
The PriceCompare REST API provides endpoints for product search, price comparison, and retailer information. All endpoints return JSON data and follow RESTful conventions.

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

### Product Analytics Endpoints

#### GET /products/:id/volatility
Get price volatility analysis for a product to understand price stability.

**Description:**
Analyzes historical price data to calculate how stable or volatile prices have been. Helps users understand if they should wait for a price drop or buy now. Uses statistical measures (standard deviation, coefficient of variation) to generate a 0-100 volatility score.

**Path Parameters:**
- `id` (number): Product ID

**Query Parameters:**
- `days` (number, optional): Number of days of history to analyze (default: 30)

**Use Cases:**
- "Are prices stable enough to buy now?"
- "Should I wait for a potential price drop?"
- "How much do prices typically fluctuate?"

**Example Requests:**
```
# With custom days parameter
GET /products/123/volatility?days=90

# Using default (30 days)
GET /products/123/volatility
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "score": 45,
    "level": "moderate",
    "standardDeviation": 15.50,
    "averagePrice": 299.99,
    "priceRange": {
      "min": 275.00,
      "max": 325.00
    },
    "recommendation": "Prices show moderate fluctuation. Monitor prices for a few days before buying. Consider waiting for a dip if you're not in a hurry, as prices may drop by 5-10%."
  }
}
```

**Volatility Levels:**
- `low` (score 0-25): Stable prices, safe to buy anytime
- `moderate` (score 26-50): Some fluctuation, monitor for a few days
- `high` (score 51-75): Significant fluctuation, wait for drops
- `very-high` (score 76-100): Extreme volatility, wait for deals

**Response Codes:**
- `200 OK`: Success (returns volatility data or null if insufficient data)
- `400 Bad Request`: Invalid product ID or days parameter
- `404 Not Found`: Product not found
- `500 Internal Server Error`: Server error

**Edge Cases:**
- Returns `{"success": true, "data": null}` if less than 2 price history records exist

**Performance Considerations:**
- **Computation**: Calculates standard deviation and coefficient of variation (CPU-intensive for large datasets)
- **Recommended caching**: 6 hours (prices change frequently but not constantly)
- **Data requirements**: Minimum 2 price records, optimal with 30+ records
- **Response time**: Typically <100ms for datasets with <1000 records

**Caching Strategy:**
```typescript
// Client-side caching example with React Query
const { data: volatility } = useQuery({
  queryKey: ['volatility', productId, days],
  queryFn: () => fetch(`/api/products/${productId}/volatility?days=${days}`),
  staleTime: 6 * 60 * 60 * 1000, // 6 hours
  cacheTime: 24 * 60 * 60 * 1000, // 24 hours
});
```

---

#### GET /products/:id/seasonal-patterns
Detect seasonal price patterns to find the best time to buy.

**Description:**
Analyzes historical price data to identify seasonal trends and patterns. Determines which months, seasons, or days of the week historically have the lowest/highest prices. Provides actionable recommendations like "Wait for Black Friday" or "Prices lowest in January."

**Path Parameters:**
- `id` (number): Product ID

**Query Parameters:**
- `days` (number, optional): Number of days of history to analyze (default: 365 for full year)

**Use Cases:**
- "When are prices typically lowest?"
- "Should I wait for Black Friday?"
- "Is there a seasonal pattern I should know about?"

**Example Requests:**
```
# With custom days parameter (full year analysis)
GET /products/123/seasonal-patterns?days=365

# Using default (365 days)
GET /products/123/seasonal-patterns
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "hasSeasonalPattern": true,
    "monthlyPatterns": [
      {
        "month": 10,
        "monthName": "November",
        "averagePrice": 249.99,
        "minPrice": 199.99,
        "maxPrice": 299.99,
        "dataPoints": 45
      }
    ],
    "seasonalPatterns": [
      {
        "season": "fall",
        "averagePrice": 269.99,
        "minPrice": 199.99,
        "maxPrice": 349.99,
        "dataPoints": 120
      }
    ],
    "dayOfWeekPatterns": [
      {
        "dayOfWeek": 5,
        "dayName": "Friday",
        "averagePrice": 279.99,
        "dataPoints": 52
      }
    ],
    "bestMonthToBuy": {
      "month": 10,
      "monthName": "November",
      "averagePrice": 249.99,
      "minPrice": 199.99,
      "maxPrice": 299.99,
      "dataPoints": 45
    },
    "worstMonthToBuy": {
      "month": 6,
      "monthName": "July",
      "averagePrice": 349.99,
      "minPrice": 299.99,
      "maxPrice": 399.99,
      "dataPoints": 38
    },
    "bestSeasonToBuy": {
      "season": "fall",
      "averagePrice": 269.99,
      "minPrice": 199.99,
      "maxPrice": 349.99,
      "dataPoints": 120
    },
    "recommendation": {
      "timeframe": "November",
      "reason": "Historically, prices are lowest in November. Now is a great time to buy! Generally, fall offers the best prices.",
      "expectedSavings": 28.5
    },
    "confidence": "high"
  }
}
```

**Confidence Levels:**
- `high`: 6+ months of data, 5+ data points per month (reliable patterns)
- `medium`: 4+ months of data, 3+ data points per month (moderate reliability)
- `low`: Less data available (patterns less reliable)

**Response Codes:**
- `200 OK`: Success (returns seasonal data or null if insufficient data)
- `400 Bad Request`: Invalid product ID or days parameter
- `404 Not Found`: Product not found
- `500 Internal Server Error`: Server error

**Edge Cases:**
- Returns `{"success": true, "data": null}` if less than 10 price history records exist
- `hasSeasonalPattern` is `false` if price deviations are <10% of overall average (no statistically significant pattern)
- `recommendation` is `null` if savings potential is <5% (not worth waiting - price difference too small)

**Performance Considerations:**
- **Computation**: Groups data by month/season/day, calculates averages, identifies patterns (moderately expensive)
- **Recommended caching**: 24 hours (seasonal patterns change slowly over time)
- **Data requirements**: Minimum 10 price records, optimal with 1+ year of data across 6+ months
- **Response time**: Typically <150ms for datasets with <1000 records
- **Best use**: Products with established pricing history (avoid for newly added products)

**Caching Strategy:**
```typescript
// Client-side caching example with React Query
const { data: patterns } = useQuery({
  queryKey: ['seasonal-patterns', productId, days],
  queryFn: () => fetch(`/api/products/${productId}/seasonal-patterns?days=${days || 365}`),
  staleTime: 24 * 60 * 60 * 1000, // 24 hours (patterns are stable)
  cacheTime: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

---

#### GET /products/:id/retailer-reliability
Get retailer reliability scores to choose trustworthy sellers.

**Description:**
Evaluates retailers based on 4 key metrics: price stability, stock availability, competitive pricing, and consistency. Provides an overall reliability score (0-100) with detailed strengths/weaknesses and a personalized recommendation.

**Path Parameters:**
- `id` (number): Product ID

**Query Parameters:**
- `days` (number, optional): Number of days of history to analyze (default: all available)

**Use Cases:**
- "Which retailer should I trust for this product?"
- "Is this retailer's price likely to change tomorrow?"
- "Does this seller keep items in stock?"

**Example Requests:**
```
# Analyze last 90 days
GET /products/123/retailer-reliability?days=90

# Using default (all available history)
GET /products/123/retailer-reliability
```

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "retailerId": 1,
      "retailerName": "Amazon",
      "overallScore": 85,
      "rating": "excellent",
      "metrics": {
        "priceStability": 78,
        "availability": 95,
        "competitiveness": 88,
        "consistency": 82
      },
      "strengths": [
        "Excellent stock availability",
        "Competitive prices",
        "Consistent pricing"
      ],
      "weaknesses": [],
      "recommendation": "Highly reliable retailer with excellent stock availability, competitive prices, consistent pricing. Excellent choice for purchasing this product."
    },
    {
      "retailerId": 2,
      "retailerName": "BestBuy",
      "overallScore": 68,
      "rating": "good",
      "metrics": {
        "priceStability": 65,
        "availability": 88,
        "competitiveness": 55,
        "consistency": 70
      },
      "strengths": [
        "Good stock availability"
      ],
      "weaknesses": [
        "Higher prices than competitors"
      ],
      "recommendation": "Reliable retailer with good stock availability. Consider monitoring higher prices than competitors. Good choice for purchasing."
    }
  ]
}
```

**Scoring Methodology:**
- **Price Stability** (25% weight): Lower volatility = higher score (CV of 0% = 100, 20%+ = 0)
- **Availability** (30% weight): Percentage of time in stock (100% = score 100)
- **Competitiveness** (25% weight): Price vs market average (10% below = 100, 10%+ above = 20)
- **Consistency** (20% weight): Fewer price changes = higher score (0% changes = 100, 50%+ = 0)

**Rating Levels:**
- `excellent` (80-100): Highly reliable, great choice
- `good` (65-79): Generally reliable with minor issues
- `fair` (50-64): Moderate reliability, compare with others
- `poor` (<50): Frequent issues, consider alternatives

**Performance Considerations:**
- **Computation**: Batch processes all retailers for competitiveness comparison (moderately expensive)
- **Recommended caching**: 12 hours (balances availability updates with performance)
- **Data requirements**: Minimum 2 records per retailer, optimal with 20+ records across multiple retailers
- **Response time**: <200ms for <5 retailers with <1000 total records

**Caching Strategy:**
```typescript
const { data: reliability } = useQuery({
  queryKey: ['retailer-reliability', productId, days],
  queryFn: () => fetch(`/api/products/${productId}/retailer-reliability?days=${days}`).then(r => r.json()),
  staleTime: 12 * 60 * 60 * 1000, // 12 hours (availability changes slowly)
  cacheTime: 24 * 60 * 60 * 1000, // 24 hours (keep in cache for comparison)
});
```

**Response Codes:**
- `200 OK`: Success (returns reliability scores or null if insufficient data)
- `400 Bad Request`: Invalid product ID or days parameter
- `404 Not Found`: Product not found
- `500 Internal Server Error`: Server error

**Edge Cases:**
- Returns `{"success": true, "data": null}` if less than 5 total price history records exist
- Retailers with <2 price history records get score 0 with "Insufficient data" weakness
- Competitiveness score defaults to 50 (neutral) if only 1 retailer exists

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