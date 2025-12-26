#!/bin/bash
#
# Test HTTP Basic Auth for AI Agents
#
# Usage: ./test-basic-auth.sh [username] [password]
# Default: admin / admin

set -e

USERNAME="${1:-admin}"
PASSWORD="${2:-admin}"
BASE_URL="${3:-http://localhost:5000}"

echo "🔐 Testing HTTP Basic Auth for PriceCompare API v1"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Username: $USERNAME"
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Check scraping status (read-only endpoint)
echo "📊 Test 1: GET /api/v1/scraping/status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -u "$USERNAME:$PASSWORD" \
  -X GET "$BASE_URL/api/v1/scraping/status" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq '.' || echo "Failed"
echo ""

# Test 2: Initialize scraping system
echo "🚀 Test 2: POST /api/v1/scraping/initialize"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -u "$USERNAME:$PASSWORD" \
  -X POST "$BASE_URL/api/v1/scraping/initialize" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq '.' || echo "Failed"
echo ""

# Test 3: Discover trends
echo "🔍 Test 3: POST /api/v1/scraping/discover-trends"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -u "$USERNAME:$PASSWORD" \
  -X POST "$BASE_URL/api/v1/scraping/discover-trends" \
  -H "Content-Type: application/json" \
  -d '{
    "sources": ["google_trends"],
    "limit": 5
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq '.' || echo "Failed"
echo ""

# Test 4: Search for product
echo "🛍️  Test 4: POST /api/v1/scraping/search-product"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -u "$USERNAME:$PASSWORD" \
  -X POST "$BASE_URL/api/v1/scraping/search-product" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "iPhone 15",
    "category": "electronics"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq '.' || echo "Failed"
echo ""

# Test 5: Test invalid credentials (should fail)
echo "❌ Test 5: Invalid credentials (should return 401)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -u "invalid:credentials" \
  -X GET "$BASE_URL/api/v1/scraping/status" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq '.' || echo "Expected failure (401)"
echo ""

echo "✅ Basic Auth tests complete!"
echo ""
echo "📖 Documentation: docs/HTTP_BASIC_AUTH.md"
echo "🔧 Middleware: server/middleware/basic-auth.ts"
echo "🛣️  Routes: server/routes/api-v1-routes.ts"
