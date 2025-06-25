# Insightify API Documentation

## Overview
The Insightify REST API provides endpoints for product search, price comparison, and retailer information. All endpoints return JSON data and follow RESTful conventions.

## Base URL
- Development: `http://localhost:5000/api`
- Production: `https://your-domain.com/api`

## Authentication
Currently, the API is open and does not require authentication. Future versions will implement API key authentication.

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
- `500 Internal Server Error`: Server error

## Rate Limiting
Currently no rate limiting is implemented. Future versions will include:
- 100 requests per minute for unauthenticated requests
- 1000 requests per minute for authenticated requests

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