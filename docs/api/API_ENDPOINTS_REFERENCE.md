# API Endpoints Reference
**Date**: June 26, 2025  
**Version**: 2.0  
**Complete API specification for price comparison platform**

## Base URL
- **Development**: `http://localhost:5000`
- **Production**: `https://[your-domain].replit.app`

## Authentication

All admin endpoints require authentication. Include session cookie or use login endpoint.

### Authentication Endpoints

#### POST `/api/auth/login`
Login user and create session.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

#### POST `/api/auth/register`
Register new user account.

**Request Body:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123"
}
```

#### GET `/api/auth/user`
Get current authenticated user.

**Response:**
```json
{
  "id": 1,
  "username": "testuser",
  "email": "user@example.com",
  "role": "admin"
}
```

#### POST `/api/auth/logout`
Logout current user and destroy session.

## Product & Retailer Management

### Core Product Endpoints

#### GET `/api/products/search`
Search products with filtering options.

**Query Parameters:**
- `query` (string): Search term
- `category` (string): Product category filter
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `retailer` (string): Retailer name filter
- `sortBy` (string): Sort option (price, rating, popularity)
- `sortOrder` (string): asc or desc

**Response:**
```json
[
  {
    "id": 1,
    "name": "iPhone 15 Pro",
    "category": "Smartphones",
    "brand": "Apple",
    "offers": [
      {
        "id": 1,
        "retailer": {
          "id": 1,
          "name": "Amazon",
          "logo": "amazon-logo.png"
        },
        "price": "999.99",
        "availability": "in_stock",
        "productUrl": "https://amazon.com/...",
        "affiliateUrl": "https://amazon.com/...?tag=affiliate-20"
      }
    ]
  }
]
```

#### GET `/api/retailers`
Get all active retailers.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Amazon",
    "logo": "amazon-logo.png",
    "website": "https://amazon.com",
    "isActive": true,
    "affiliateStatus": "active"
  }
]
```

## Admin Endpoints

### Retailer Management

#### GET `/api/admin/retailers/affiliate`
Get retailers with affiliate configuration and statistics.

**Authentication**: Admin required

**Response:**
```json
[
  {
    "id": 1,
    "name": "Amazon",
    "affiliateProgram": "amazon_associates",
    "affiliateId": "pricecompare-20",
    "commissionRate": "4.00",
    "affiliateStatus": "active",
    "affiliateConfig": {
      "tag": "pricecompare-20",
      "region": "com",
      "linkCode": "as2"
    },
    "stats": {
      "total_offers": 45,
      "affiliate_offers": 42,
      "total_clicks": 1250,
      "healthy_links": 40,
      "broken_links": 2
    }
  }
]
```

#### PUT `/api/admin/retailers/:id/affiliate`
Update retailer affiliate configuration.

**Authentication**: Admin required

**Request Body:**
```json
{
  "affiliateProgram": "amazon_associates",
  "affiliateId": "your-tag-20",
  "commissionRate": 4.00,
  "affiliateStatus": "active",
  "affiliateConfig": {
    "tag": "your-tag-20",
    "region": "com",
    "linkCode": "as2"
  }
}
```

#### POST `/api/admin/retailers/:id/test-affiliate-link`
Test affiliate link generation for a retailer.

**Authentication**: Admin required

**Request Body:**
```json
{
  "testUrl": "https://amazon.com/dp/B08N5WRWNW"
}
```

**Response:**
```json
{
  "success": true,
  "originalUrl": "https://amazon.com/dp/B08N5WRWNW",
  "affiliateUrl": "https://amazon.com/dp/B08N5WRWNW?tag=pricecompare-20&linkCode=as2",
  "isHealthy": true,
  "generationTime": "2025-06-26T17:30:00Z"
}
```

#### POST `/api/admin/retailers/:id/generate-affiliate-links`
Generate affiliate links for all products from a retailer.

**Authentication**: Admin required

**Request Body:**
```json
{
  "limit": 50,
  "forceRegenerate": false
}
```

**Response:**
```json
{
  "processed": 45,
  "successful": 42,
  "failed": 3,
  "results": [
    {
      "offerId": 1,
      "success": true,
      "affiliateUrl": "https://amazon.com/...?tag=affiliate-20"
    }
  ]
}
```

### Analytics Endpoints

#### GET `/api/admin/affiliate-stats`
Get affiliate link performance statistics.

**Authentication**: Admin required

**Query Parameters:**
- `retailerId` (number, optional): Filter by specific retailer

**Response:**
```json
{
  "total_offers": 150,
  "affiliate_offers": 142,
  "total_clicks": 5420,
  "healthy_links": 138,
  "broken_links": 4
}
```

#### GET `/api/admin/analytics/overview`
Get dashboard overview metrics.

**Authentication**: Admin required

**Response:**
```json
{
  "totalUsers": 1250,
  "totalTopics": 89,
  "totalPosts": 445,
  "totalCategories": 8
}
```

## AI Scraping System

### Agent Management

#### POST `/api/scraping/initialize`
Initialize AI scraping system.

**Response:**
```json
{
  "success": true,
  "message": "AI scraping system initialized successfully"
}
```

#### POST `/api/scraping/start-agents`
Start AI coordination agents.

**Response:**
```json
{
  "success": true,
  "message": "AI agents started successfully",
  "status": {
    "sessionId": "coordinator_123456",
    "isRunning": true,
    "activeTasks": 0
  }
}
```

#### GET `/api/scraping/status`
Get current system status and metrics.

**Response:**
```json
{
  "success": true,
  "systemStatus": {
    "jobs": {
      "total": 45,
      "pending": 12,
      "running": 3,
      "completed": 28,
      "failed": 2
    },
    "products": {
      "discovered": 15,
      "processed": 12
    },
    "agents": {
      "coordinator": {
        "isRunning": true,
        "activeTasks": 2
      }
    }
  }
}
```

### Product Discovery

#### POST `/api/scraping/discover-trends`
Trigger AI trend discovery.

**Request Body:**
```json
{
  "sources": ["google_trends", "seasonal"],
  "categories": ["electronics", "home"],
  "limit": 20
}
```

#### GET `/api/scraping/trending-products`
Get discovered trending products.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Nintendo Switch OLED",
    "category": "Electronics",
    "trendScore": 77,
    "source": "google_trends",
    "status": "discovered"
  }
]
```

#### POST `/api/scraping/search-product`
Search for product across retailers.

**Request Body:**
```json
{
  "query": "iPhone 15 Pro",
  "retailers": ["amazon", "walmart", "target"]
}
```

### Monitoring Endpoints

#### POST `/api/scraping/start-monitoring`
Start automated price monitoring.

**Request Body:**
```json
{
  "threshold": 5.0,
  "interval": 3600
}
```

#### GET `/api/scraping/monitoring-stats`
Get price monitoring statistics.

**Response:**
```json
{
  "monitored_products": 156,
  "price_changes_detected": 23,
  "alerts_sent": 18,
  "last_check": "2025-06-26T17:00:00Z"
}
```

## Public Endpoints

### Link Tracking

#### POST `/api/affiliate/track-click/:offerId`
Track affiliate link click (public endpoint).

**Parameters:**
- `offerId` (number): Product offer ID

**Response:**
```json
{
  "success": true
}
```

## Forum & Community

### Enhanced Forum Features

#### GET `/api/forum/topics/enhanced`
Get forum topics with advanced features.

**Query Parameters:**
- `categoryId` (number): Filter by category
- `productId` (number): Filter by product

**Response:**
```json
[
  {
    "id": 1,
    "title": "Best smartphone deals this month",
    "content": "Let's discuss...",
    "author": {
      "username": "techexpert",
      "trustLevel": 3
    },
    "tags": ["smartphones", "deals"],
    "likeCount": 15,
    "postCount": 23
  }
]
```

#### POST `/api/forum/posts/:id/like`
Like or unlike a forum post.

**Authentication**: Required

**Response:**
```json
{
  "liked": true,
  "likeCount": 16
}
```

#### GET `/api/notifications`
Get user notifications.

**Authentication**: Required

**Query Parameters:**
- `unreadOnly` (boolean): Show only unread notifications

**Response:**
```json
[
  {
    "id": 1,
    "type": "mention",
    "message": "You were mentioned in a post",
    "isRead": false,
    "createdAt": "2025-06-26T15:30:00Z"
  }
]
```

## Error Responses

### Standard Error Format
```json
{
  "error": "Error message description",
  "details": "Additional error details (optional)"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (admin access required)
- `404` - Not Found
- `500` - Internal Server Error

### Example Error Responses

**401 Unauthorized:**
```json
{
  "error": "Not authenticated"
}
```

**403 Forbidden:**
```json
{
  "error": "Admin access required"
}
```

**400 Bad Request:**
```json
{
  "error": "Validation failed",
  "details": ["Email is required", "Password must be at least 8 characters"]
}
```

## Rate Limiting

- **Public endpoints**: 100 requests per minute per IP
- **Authenticated endpoints**: 1000 requests per minute per user
- **Admin endpoints**: 500 requests per minute per admin user

Rate limit headers included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## Request/Response Examples

### Complete Product Search Flow

1. **Search for products:**
```bash
curl "http://localhost:5000/api/products/search?query=iphone&category=smartphones"
```

2. **Track affiliate click:**
```bash
curl -X POST "http://localhost:5000/api/affiliate/track-click/123"
```

3. **Admin: Check affiliate stats:**
```bash
curl -H "Cookie: session=..." "http://localhost:5000/api/admin/affiliate-stats"
```

This API provides comprehensive access to all platform features including product search, affiliate management, AI scraping, and community features.