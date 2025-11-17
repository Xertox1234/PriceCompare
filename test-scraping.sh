#!/bin/bash

# Test AI Scraping System
BASE_URL="http://localhost:5001"

echo "🔐 Step 1: Login as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pricecompare.com","password":"Admin123!"}' \
  -c cookies.txt)

echo "Login response: $LOGIN_RESPONSE"
echo ""

echo "🤖 Step 2: Initialize AI agents..."
INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/scraping/initialize" \
  -b cookies.txt \
  -H "Content-Type: application/json")

echo "Init response: $INIT_RESPONSE"
echo ""

echo "🚀 Step 3: Start AI agents..."
START_RESPONSE=$(curl -s -X POST "$BASE_URL/api/scraping/start-agents" \
  -b cookies.txt \
  -H "Content-Type: application/json")

echo "Start response: $START_RESPONSE"
echo ""

echo "🔍 Step 4: Discover trending products..."
DISCOVER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/scraping/discover-trends" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"sources":["amazon.com"],"categories":["electronics"],"limit":5}')

echo "Discover response: $DISCOVER_RESPONSE"
echo ""

echo "✅ Done! Check the server logs for AI agent activity."

# Cleanup
rm -f cookies.txt
