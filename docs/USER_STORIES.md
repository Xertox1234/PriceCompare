# PriceCompare User Stories

**Version:** 1.0
**Last Updated:** 2025-12-08
**Total Stories:** 60

## Overview

This document contains comprehensive user stories for the PriceCompare application, organized by persona and priority. Each story includes acceptance criteria that will be validated through E2E tests.

---

## Priority Levels

- **P0 (Critical Path):** Must pass before any deployment - 20 stories
- **P1 (Core Features):** Should pass for stable release - 25 stories
- **P2 (Nice-to-Have):** Can be addressed iteratively - 15 stories

---

## Table of Contents

1. [Guest Visitor Stories](#guest-visitor-stories) (Unauthenticated)
2. [Registered User Stories](#registered-user-stories) (Authenticated)
3. [Power User Stories](#power-user-stories) (Active Community Member)
4. [Admin User Stories](#admin-user-stories) (Platform Administrator)

---

# Guest Visitor Stories

> **Persona:** Unauthenticated user exploring the platform

## Authentication & Account Management

### US-001: User Registration (P0)

**Story:**
```
As a guest visitor
I want to create an account
So that I can track prices and receive alerts
```

**Acceptance Criteria:**
- [ ] Can access registration form from homepage navigation
- [ ] Email validation enforced (valid format required)
- [ ] Password strength requirements shown and enforced (min 8 chars, uppercase, lowercase, number)
- [ ] CSRF token protection works (prevents cross-site request forgery)
- [ ] First user becomes admin automatically (bootstrapping)
- [ ] Success shows confirmation message
- [ ] Can immediately log in after registration
- [ ] Account lockout protection prevents abuse

**Test File:** `e2e/auth.spec.ts`

---

### US-002: User Login (P0)

**Story:**
```
As a registered user
I want to log into my account
So that I can access my tracked products and alerts
```

**Acceptance Criteria:**
- [ ] Can access login form from homepage navigation
- [ ] Valid credentials grant access and redirect to homepage
- [ ] Invalid credentials show clear error message
- [ ] Account lockout after 5 failed attempts (15-minute cooldown)
- [ ] Session persists across page refreshes
- [ ] Logout works correctly and clears session
- [ ] "Remember me" functionality works (if implemented)
- [ ] CSRF protection on login endpoint

**Test File:** `e2e/auth.spec.ts`

---

### US-003: Password Reset (P0)

**Story:**
```
As a registered user
I want to reset my forgotten password
So that I can regain access to my account
```

**Acceptance Criteria:**
- [ ] Can request password reset from login page
- [ ] Email validation enforced on reset request
- [ ] Reset token sent to email (if email service configured)
- [ ] Token validates correctly and shows reset form
- [ ] Can set new password meeting strength requirements
- [ ] Old password no longer works after reset
- [ ] New password works immediately for login
- [ ] Token expires after use or after 1 hour
- [ ] Reset request logs IP and user agent (security audit trail)

**Test File:** `e2e/auth.spec.ts`

---

## Product Discovery

### US-004: Browse Homepage (P0)

**Story:**
```
As a guest visitor
I want to see featured products and categories on the homepage
So that I can quickly find products I'm interested in
```

**Acceptance Criteria:**
- [ ] Homepage loads within 2 seconds
- [ ] Hero section displays prominently
- [ ] Category grid shows all product categories
- [ ] Featured products displayed with images and prices
- [ ] Navigation bar visible and functional
- [ ] Search bar accessible from homepage
- [ ] No console errors or broken images
- [ ] Mobile responsive layout works correctly

**Test File:** `e2e/product-discovery.spec.ts`
**Page:** `/` (New Onsus template)

---

### US-005: Product Search (P0)

**Story:**
```
As any user
I want to search for products
So that I can find items I'm interested in
```

**Acceptance Criteria:**
- [ ] Search bar visible on all pages
- [ ] Typing shows search suggestions (autocomplete)
- [ ] Search results display with product name, image, price
- [ ] Results are paginated (default 20 per page)
- [ ] Can filter by category
- [ ] Can sort by price (low to high, high to low)
- [ ] No results shows helpful message with suggestions
- [ ] Search query persists in URL for sharing

**Test File:** `e2e/product-search.spec.ts`
**Page:** `/search`, `/shop`

---

### US-006: View Product Details (P0)

**Story:**
```
As any user
I want to view detailed product information
So that I can make informed purchasing decisions
```

**Acceptance Criteria:**
- [ ] Product page shows name, description, images
- [ ] All retailer offers displayed in a list
- [ ] Prices sorted by lowest first
- [ ] Current price highlighted vs historical average
- [ ] Product specifications visible (if available)
- [ ] Affiliate links work correctly and open in new tab
- [ ] Page loads within 2 seconds
- [ ] Related products shown (if available)
- [ ] Can add to watchlist if authenticated

**Test File:** `e2e/product-discovery.spec.ts`
**Page:** `/product/:id`

---

### US-007: View Price History (P0)

**Story:**
```
As any user
I want to see historical price data for a product
So that I can identify good deals and price trends
```

**Acceptance Criteria:**
- [ ] Price history chart loads on product page
- [ ] Chart shows date on X-axis and price on Y-axis
- [ ] Can hover to see exact prices at specific dates
- [ ] Shows min/max/average prices clearly
- [ ] Chart covers last 90 days minimum
- [ ] Loading state shown while fetching data
- [ ] Can toggle between different time periods (30d, 90d, 1y)
- [ ] Price drop indicators visible

**Test File:** `e2e/product-discovery.spec.ts`
**Page:** `/products/:id/price-history`

---

### US-008: Browse by Category (P1)

**Story:**
```
As any user
I want to browse products by category
So that I can discover products in areas of interest
```

**Acceptance Criteria:**
- [ ] Can select category from homepage grid
- [ ] Category page shows all products in that category
- [ ] Products displayed with name, image, price
- [ ] Can filter within category by brand/price range
- [ ] Pagination works correctly
- [ ] Breadcrumb navigation shows current category
- [ ] Category description displayed at top

**Test File:** `e2e/product-discovery.spec.ts`
**Page:** `/shop` with category filter

---

### US-009: View Retailer Information (P1)

**Story:**
```
As any user
I want to see information about retailers
So that I can make informed decisions about where to buy
```

**Acceptance Criteria:**
- [ ] Retailer name and logo displayed on offers
- [ ] Can click retailer to see all their products
- [ ] Retailer reliability score shown (if calculated)
- [ ] Shipping information displayed
- [ ] Return policy information available
- [ ] Affiliate disclaimer shown clearly

**Test File:** `e2e/product-discovery.spec.ts`

---

# Registered User Stories

> **Persona:** Authenticated user tracking prices

## Price Tracking & Alerts

### US-010: Create Price Alert (P0)

**Story:**
```
As a registered user
I want to set a price alert for a product
So that I'm notified when prices drop to my target
```

**Acceptance Criteria:**
- [ ] Can create alert from product page
- [ ] Can specify target price (numeric validation, > 0)
- [ ] Alert appears in "My Alerts" list
- [ ] Can toggle alert active/inactive
- [ ] Can delete alert with confirmation
- [ ] System validates target price is reasonable
- [ ] Can set optional note for alert
- [ ] CSRF protection on alert creation

**Test File:** `e2e/price-alerts.spec.ts`

---

### US-011: Receive Alert Notification (P0)

**Story:**
```
As a registered user
I want to receive notifications when my price alerts trigger
So that I don't miss good deals
```

**Acceptance Criteria:**
- [ ] Notification appears when price drops below target
- [ ] Notification shows product name, new price, old price
- [ ] Notification links directly to product page
- [ ] Can mark notification as read
- [ ] Unread count badge updates in navigation
- [ ] WebSocket delivers notification in real-time (no page refresh)
- [ ] Notification persists in notification center
- [ ] Can dismiss notification

**Test File:** `e2e/price-alerts.spec.ts`

---

### US-012: Manage Price Alerts (P0)

**Story:**
```
As a registered user
I want to view and manage all my price alerts
So that I can keep track of products I'm monitoring
```

**Acceptance Criteria:**
- [ ] Can view all alerts on dedicated page
- [ ] Alerts show product name, target price, current price
- [ ] Can toggle alert active/inactive from list
- [ ] Can delete multiple alerts (bulk action)
- [ ] Can edit alert target price
- [ ] Alerts sorted by most recently created
- [ ] Can filter alerts by active/inactive status
- [ ] Shows alert effectiveness (how many times triggered)

**Test File:** `e2e/price-alerts.spec.ts`
**Page:** `/price-watch`

---

### US-013: View Smart Alert Suggestions (P1)

**Story:**
```
As a registered user
I want to see AI-powered price alert suggestions
So that I can set optimal price targets
```

**Acceptance Criteria:**
- [ ] Product page shows suggested alert prices
- [ ] Suggestions based on historical data (30/60/90 day trends)
- [ ] Shows confidence level for each suggestion
- [ ] Can create alert from suggestion with one click
- [ ] Explains reasoning behind suggestion (seasonal patterns, volatility)
- [ ] Updates suggestions as new data arrives

**Test File:** `e2e/price-alerts.spec.ts`

---

### US-014: View Price Analytics (P1)

**Story:**
```
As a registered user
I want to see advanced price analytics
So that I can make data-driven purchasing decisions
```

**Acceptance Criteria:**
- [ ] Can view price volatility metrics
- [ ] Seasonal pattern recognition displayed
- [ ] Best time to buy recommendations shown
- [ ] Retailer reliability scores visible
- [ ] Price prediction chart displayed
- [ ] Confidence intervals shown for predictions
- [ ] Historical accuracy of predictions tracked

**Test File:** `e2e/price-alerts.spec.ts`
**Page:** `/products/:id/analytics`

---

## Watch Lists & Organization

### US-015: Create Watch List (P0)

**Story:**
```
As a registered user
I want to create a watch list to organize products
So that I can efficiently track multiple items
```

**Acceptance Criteria:**
- [ ] Can create new watch list with name
- [ ] Can add optional description and icon/color
- [ ] Watch list appears in "My Watch Lists"
- [ ] Can view products in watch list
- [ ] Watch list shows current prices for all products
- [ ] Price changes highlighted (up/down indicators)
- [ ] Can set watch list as default

**Test File:** `e2e/watchlist-management.spec.ts`
**Page:** `/watchlists`

---

### US-016: Add Products to Watch List (P0)

**Story:**
```
As a registered user
I want to add products to my watch lists
So that I can organize and monitor them
```

**Acceptance Criteria:**
- [ ] Can add product from product page
- [ ] Can select which watch list to add to
- [ ] Can add notes for the product
- [ ] Can set priority level (1-5)
- [ ] Can set target price for product
- [ ] Product appears immediately in watch list
- [ ] Can add same product to multiple watch lists
- [ ] Duplicate prevention within same watch list

**Test File:** `e2e/watchlist-management.spec.ts`

---

### US-017: Manage Watch List Products (P1)

**Story:**
```
As a registered user
I want to manage products within my watch lists
So that I can keep my tracking organized
```

**Acceptance Criteria:**
- [ ] Can remove products from watch list
- [ ] Can move products between watch lists
- [ ] Can edit product notes and priority
- [ ] Can bulk select and move/delete products
- [ ] Can reorder products within list (drag-and-drop or priority)
- [ ] Changes saved immediately
- [ ] Confirmation shown for bulk actions

**Test File:** `e2e/watchlist-management.spec.ts`

---

### US-018: Import/Export Watch Lists (P1)

**Story:**
```
As a registered user
I want to import and export my watch lists
So that I can backup my data or share with others
```

**Acceptance Criteria:**
- [ ] Can export watch lists as JSON
- [ ] Export includes all product details and notes
- [ ] Can import watch lists from JSON file
- [ ] Import validates file format
- [ ] Import shows preview before confirming
- [ ] Duplicate products handled intelligently
- [ ] Error handling for malformed import files

**Test File:** `e2e/watchlist-management.spec.ts`

---

### US-019: Create Wishlist (P1)

**Story:**
```
As a registered user
I want to create a wishlist for products I want to buy
So that I can keep track of desired purchases
```

**Acceptance Criteria:**
- [ ] Can create wishlist with name
- [ ] Can set wishlist as public or private
- [ ] Can add products to wishlist from product page
- [ ] Wishlist shows product name, image, price
- [ ] Can add notes and priority to wishlist items
- [ ] Can share public wishlist via URL
- [ ] Can view all wishlists on dedicated page

**Test File:** `e2e/watchlist-management.spec.ts`
**Page:** `/wishlist`

---

## Notifications

### US-020: View Notification Center (P0)

**Story:**
```
As a registered user
I want to see all my notifications in one place
So that I don't miss important updates
```

**Acceptance Criteria:**
- [ ] Can access notification center from navigation
- [ ] Shows all notifications with newest first
- [ ] Displays unread count badge
- [ ] Each notification shows type, title, content, timestamp
- [ ] Can mark individual notifications as read
- [ ] Can mark all notifications as read (bulk action)
- [ ] Can delete notifications
- [ ] Notifications are paginated (20 per page)

**Test File:** `e2e/notifications.spec.ts`
**Page:** `/notifications`

---

### US-021: Receive Real-Time Notifications (P0)

**Story:**
```
As a registered user
I want to receive real-time notifications via WebSocket
So that I'm immediately alerted to important events
```

**Acceptance Criteria:**
- [ ] Notifications appear without page refresh (WebSocket)
- [ ] Toast notification shows briefly when new notification arrives
- [ ] Unread badge updates in real-time
- [ ] Notification sound plays (if user preference enabled)
- [ ] Can click notification to navigate to related page
- [ ] WebSocket reconnects automatically if disconnected

**Test File:** `e2e/notifications.spec.ts`

---

### US-022: Configure Notification Preferences (P1)

**Story:**
```
As a registered user
I want to customize my notification settings
So that I only receive notifications I care about
```

**Acceptance Criteria:**
- [ ] Can access notification preferences page
- [ ] Can toggle notification types on/off (price drops, community mentions, etc.)
- [ ] Can set price drop threshold percentage
- [ ] Can configure quiet hours (do not disturb)
- [ ] Can set daily notification limit
- [ ] Can choose notification channels (in-app, email)
- [ ] Preferences saved immediately
- [ ] Can test notification settings

**Test File:** `e2e/notifications.spec.ts`

---

## Shopping & Comparison

### US-023: Add Products to Comparison (P1)

**Story:**
```
As any user
I want to compare multiple products side-by-side
So that I can choose the best option for my needs
```

**Acceptance Criteria:**
- [ ] Can add products to comparison from product page
- [ ] Can add up to 4 products to comparison
- [ ] Comparison icon shows number of products selected
- [ ] Can remove products from comparison
- [ ] Can navigate to comparison view
- [ ] Comparison persists in session storage

**Test File:** `e2e/product-comparison.spec.ts`

---

### US-024: View Product Comparison (P1)

**Story:**
```
As any user
I want to see products compared in a table
So that I can easily identify differences
```

**Acceptance Criteria:**
- [ ] Comparison table shows all selected products
- [ ] Displays key specifications side-by-side
- [ ] Shows price differences clearly (with percentage)
- [ ] Highlights best value (lowest price or best price/performance)
- [ ] Can remove products from comparison view
- [ ] Can add more products (up to 4 total)
- [ ] Mobile responsive layout (stacked or scrollable)

**Test File:** `e2e/product-comparison.spec.ts`
**Page:** `/compare`

---

### US-025: Add to Shopping Cart (P1)

**Story:**
```
As a registered user
I want to add products to a shopping cart
So that I can purchase multiple items together
```

**Acceptance Criteria:**
- [ ] Can add product to cart from product page
- [ ] Can select retailer/offer before adding to cart
- [ ] Cart icon shows item count
- [ ] Can view cart from navigation
- [ ] Cart persists across sessions (saved to database)
- [ ] Can add same product multiple times (quantity)

**Test File:** `e2e/shopping-cart.spec.ts`
**Page:** `/cart`

---

### US-026: Manage Shopping Cart (P1)

**Story:**
```
As a registered user
I want to manage items in my shopping cart
So that I can finalize my purchase
```

**Acceptance Criteria:**
- [ ] Can view all cart items with images and prices
- [ ] Can update quantity for each item
- [ ] Can remove items from cart
- [ ] Shows cart subtotal
- [ ] Shows estimated shipping costs (if available)
- [ ] Can proceed to checkout
- [ ] Can save cart for later
- [ ] Can clear entire cart

**Test File:** `e2e/shopping-cart.spec.ts`
**Page:** `/cart`

---

## Advanced Search

### US-027: Use Advanced Search Filters (P1)

**Story:**
```
As any user
I want to use advanced filters to refine search results
So that I can find exactly what I need
```

**Acceptance Criteria:**
- [ ] Can filter by price range (min/max sliders)
- [ ] Can filter by category (multi-select)
- [ ] Can filter by brand (multi-select)
- [ ] Can filter by retailer (multi-select)
- [ ] Can filter by availability (in stock only)
- [ ] Filters combine correctly (AND logic)
- [ ] Filter state persists in URL parameters
- [ ] Can clear all filters at once
- [ ] Shows result count as filters change

**Test File:** `e2e/advanced-search.spec.ts`
**Page:** `/search/advanced`

---

### US-028: Save Search Queries (P1)

**Story:**
```
As a registered user
I want to save my search queries
So that I can quickly repeat common searches
```

**Acceptance Criteria:**
- [ ] Can save current search with filters
- [ ] Can name saved search
- [ ] Saved searches appear in dropdown/sidebar
- [ ] Can execute saved search with one click
- [ ] Can edit saved search name
- [ ] Can delete saved searches
- [ ] Shows when search was last executed

**Test File:** `e2e/advanced-search.spec.ts`

---

# Power User Stories

> **Persona:** Active community member with multiple watch lists

## Community Features

### US-029: Spot a Deal (P1)

**Story:**
```
As a power user
I want to share deals I find with the community
So that I can help others and earn reputation
```

**Acceptance Criteria:**
- [ ] Can create deal spotting from product page
- [ ] Deal requires title and optional description
- [ ] Deal shows discount percentage automatically
- [ ] Deal appears in community feed
- [ ] Earn reputation points when deal is posted (+10 points)
- [ ] Other users can upvote deal
- [ ] Deal expires after 7 days or when price returns to normal
- [ ] Can delete own deal

**Test File:** `e2e/community.spec.ts`

---

### US-030: Upvote/Downvote Deals (P1)

**Story:**
```
As a registered user
I want to vote on deals shared by others
So that I can surface the best deals
```

**Acceptance Criteria:**
- [ ] Can upvote deals (+1)
- [ ] Can downvote deals (-1)
- [ ] Vote count updates in real-time
- [ ] Can change vote (upvote to downvote or vice versa)
- [ ] Can remove vote
- [ ] Cannot vote on own deals
- [ ] Vote affects deal poster's reputation

**Test File:** `e2e/community.spec.ts`

---

### US-031: View Reputation Leaderboard (P1)

**Story:**
```
As any user
I want to see top contributors
So that I can find trusted community members
```

**Acceptance Criteria:**
- [ ] Leaderboard shows top 100 users by reputation
- [ ] Shows username, reputation score, badges
- [ ] Shows recent contributions (deals, posts)
- [ ] Can filter by time period (week, month, all-time)
- [ ] My rank highlighted if logged in
- [ ] Pagination for users beyond top 100
- [ ] Can click user to view profile

**Test File:** `e2e/community.spec.ts`

---

### US-032: Earn Reputation Points (P1)

**Story:**
```
As a registered user
I want to earn reputation through positive actions
So that I can build trust in the community
```

**Acceptance Criteria:**
- [ ] +10 points for spotting a deal
- [ ] +5 points for helpful forum post (if voted up)
- [ ] +2 points for adding product review
- [ ] +1 point for daily login streak
- [ ] Points displayed on profile
- [ ] Reputation level displayed (Novice, Contributor, Expert, Master)
- [ ] Notification when reaching new reputation milestone

**Test File:** `e2e/community.spec.ts`

---

### US-033: Earn Achievement Badges (P1)

**Story:**
```
As a power user
I want to earn badges for achievements
So that I can showcase my contributions
```

**Acceptance Criteria:**
- [ ] Badges awarded automatically when criteria met
- [ ] Badges displayed on user profile
- [ ] Badges have tiers (bronze, silver, gold)
- [ ] Example badges: "Deal Hunter", "Price Watcher", "Community Helper"
- [ ] Notification when badge earned
- [ ] Can view all available badges and progress
- [ ] Badges shown next to username in community

**Test File:** `e2e/community.spec.ts`

---

### US-034: View Community Activity Feed (P1)

**Story:**
```
As any user
I want to see recent community activity
So that I can stay updated on deals and discussions
```

**Acceptance Criteria:**
- [ ] Feed shows recent deals, posts, reviews
- [ ] Activity sorted by most recent first
- [ ] Can filter by activity type
- [ ] Can interact with activities (like, comment)
- [ ] Real-time updates via WebSocket
- [ ] Pagination for older activities
- [ ] Shows user avatar and reputation level

**Test File:** `e2e/community.spec.ts`

---

## Advanced Tracking

### US-035: Set Up Price Drop Alerts (P1)

**Story:**
```
As a power user
I want alerts for any price drop, not just target price
So that I never miss a good deal
```

**Acceptance Criteria:**
- [ ] Can enable "notify on any drop" mode
- [ ] Can set minimum drop percentage (e.g., 5% or more)
- [ ] Can set minimum drop amount (e.g., $10 or more)
- [ ] Alerts respect notification preferences (quiet hours, limits)
- [ ] Can exclude small price fluctuations
- [ ] Drop alert distinct from target price alert

**Test File:** `e2e/price-alerts.spec.ts`

---

### US-036: Track Price Across Multiple Retailers (P1)

**Story:**
```
As a power user
I want to track the same product across different retailers
So that I can find the best overall deal including shipping
```

**Acceptance Criteria:**
- [ ] Product page shows all retailer offers
- [ ] Can set alerts for specific retailers
- [ ] Can compare total cost (price + shipping)
- [ ] Can exclude certain retailers
- [ ] Historical chart shows per-retailer price trends
- [ ] Alerts indicate which retailer has the deal

**Test File:** `e2e/price-alerts.spec.ts`

---

### US-037: View Trending Products (P1)

**Story:**
```
As a power user
I want to see trending products in the community
So that I can discover popular items
```

**Acceptance Criteria:**
- [ ] Trending page shows most-watched products (7-day window)
- [ ] Shows watch count and recent watch growth
- [ ] Shows recent price changes
- [ ] Can filter by category
- [ ] Updates daily
- [ ] Can add trending products to my watch list

**Test File:** `e2e/product-discovery.spec.ts`

---

# Admin User Stories

> **Persona:** Platform administrator managing the system

## Product Management

### US-038: Create Product (P1)

**Story:**
```
As an admin
I want to create new products in the catalog
So that users can track more items
```

**Acceptance Criteria:**
- [ ] Can access admin panel from navigation
- [ ] Product creation form has all required fields
- [ ] Can upload product images (multiple)
- [ ] Can set product category, brand, model
- [ ] Form validation works correctly (required fields)
- [ ] CSRF protection on product creation
- [ ] Success message shows with link to new product
- [ ] New product appears immediately in search

**Test File:** `e2e/admin.spec.ts`
**Page:** `/admin`

---

### US-039: Edit Product (P1)

**Story:**
```
As an admin
I want to edit existing products
So that I can keep information accurate
```

**Acceptance Criteria:**
- [ ] Can search for product to edit
- [ ] Edit form pre-populates with current data
- [ ] Can update all product fields
- [ ] Can add/remove product images
- [ ] Changes reflected immediately
- [ ] Edit history tracked (audit log)
- [ ] Validation prevents invalid updates

**Test File:** `e2e/admin.spec.ts`

---

### US-040: Delete Product (P1)

**Story:**
```
As an admin
I want to delete products from the catalog
So that I can remove discontinued or invalid items
```

**Acceptance Criteria:**
- [ ] Delete button requires confirmation
- [ ] Confirmation shows warning about cascade deletes
- [ ] Cascade deletes: offers, alerts, watchlist entries, price history
- [ ] Success message shows after deletion
- [ ] Product no longer appears in search
- [ ] Deletion logged to audit trail

**Test File:** `e2e/admin.spec.ts`

---

### US-041: Manage Retailers (P1)

**Story:**
```
As an admin
I want to manage retailer information
So that users have accurate retailer data
```

**Acceptance Criteria:**
- [ ] Can create new retailer with name, website, logo
- [ ] Can edit retailer information
- [ ] Can configure affiliate program settings
- [ ] Can set retailer status (active/inactive)
- [ ] Can delete retailer (cascade deletes offers)
- [ ] Retailer list shows product count per retailer
- [ ] Can upload retailer logo image

**Test File:** `e2e/admin.spec.ts`

---

## Analytics & Monitoring

### US-042: View Analytics Dashboard (P1)

**Story:**
```
As an admin
I want to see platform analytics
So that I can monitor health and growth
```

**Acceptance Criteria:**
- [ ] Dashboard shows total user count and growth trend
- [ ] Shows total product count and recent additions
- [ ] Shows alert effectiveness metrics (avg trigger rate)
- [ ] Shows most popular products (by watch count)
- [ ] Shows top categories by product count
- [ ] Charts load correctly with real data
- [ ] Data refreshes automatically (every 5 minutes)
- [ ] Can export analytics as CSV

**Test File:** `e2e/admin.spec.ts`
**Page:** `/admin`

---

### US-043: View User Analytics (P1)

**Story:**
```
As an admin
I want to see user behavior analytics
So that I can understand usage patterns
```

**Acceptance Criteria:**
- [ ] Shows daily/weekly/monthly active users
- [ ] Shows user registration trends
- [ ] Shows average alerts per user
- [ ] Shows average watchlist size per user
- [ ] Shows user retention metrics
- [ ] Shows most active users by activity
- [ ] Can drill down into specific users

**Test File:** `e2e/admin.spec.ts`

---

### US-044: View System Health (P1)

**Story:**
```
As an admin
I want to monitor system health
So that I can identify and fix issues quickly
```

**Acceptance Criteria:**
- [ ] Shows API response time metrics
- [ ] Shows database query performance
- [ ] Shows cache hit/miss rates
- [ ] Shows error rates by endpoint
- [ ] Shows background job status (price snapshots)
- [ ] Shows WebSocket connection count
- [ ] Real-time updates via WebSocket
- [ ] Can view detailed error logs

**Test File:** `e2e/admin.spec.ts`
**Page:** `/monitoring`

---

## User Management

### US-045: View User List (P1)

**Story:**
```
As an admin
I want to see all registered users
So that I can manage accounts
```

**Acceptance Criteria:**
- [ ] User list shows username, email, role, registration date
- [ ] List is paginated (50 per page)
- [ ] Can search users by username or email
- [ ] Can filter by role (admin, user)
- [ ] Can sort by various columns
- [ ] Shows user status (active, suspended)
- [ ] Can click user to view details

**Test File:** `e2e/admin.spec.ts`

---

### US-046: Edit User (P1)

**Story:**
```
As an admin
I want to edit user accounts
So that I can manage permissions and fix issues
```

**Acceptance Criteria:**
- [ ] Can change user role (user ↔ admin)
- [ ] Can suspend/unsuspend user account
- [ ] Can reset user password (if requested)
- [ ] Can view user activity history
- [ ] Can view user's alerts and watchlists
- [ ] Changes logged to audit trail
- [ ] User receives notification of account changes

**Test File:** `e2e/admin.spec.ts`

---

## Content Management

### US-047: Trigger Manual Price Snapshot (P1)

**Story:**
```
As an admin
I want to manually trigger price updates
So that I can ensure data is current
```

**Acceptance Criteria:**
- [ ] Can trigger snapshot for single product
- [ ] Can trigger snapshot for all products
- [ ] Shows progress indicator during snapshot
- [ ] Shows success/failure summary after completion
- [ ] Logs snapshot execution to system logs
- [ ] Prevents concurrent snapshots (distributed lock)

**Test File:** `e2e/admin.spec.ts`

---

### US-048: Manage AI Scraping (P1)

**Story:**
```
As an admin
I want to configure and monitor AI web scraping
So that I can discover new products automatically
```

**Acceptance Criteria:**
- [ ] Can start AI scraping workflow
- [ ] Can view scraping job status
- [ ] Can see discovered products preview
- [ ] Can approve/reject discovered products
- [ ] Can configure scraping sources (retailers)
- [ ] Shows scraping success/failure rates
- [ ] Can view scraping logs

**Test File:** `e2e/admin.spec.ts`

---

# Edge Cases & Error Handling (P2)

### US-049: Handle Network Errors Gracefully (P2)

**Story:**
```
As any user
I want the app to handle network errors gracefully
So that I understand what's happening when things fail
```

**Acceptance Criteria:**
- [ ] Shows friendly error message on network failure
- [ ] Provides retry button for failed requests
- [ ] Maintains form data on network failure
- [ ] Shows offline indicator when disconnected
- [ ] Queues actions for retry when connection restored
- [ ] Logs errors to monitoring system

**Test File:** `e2e/error-handling.spec.ts`

---

### US-050: Handle Invalid URLs Gracefully (P2)

**Story:**
```
As any user
I want to see a helpful 404 page for invalid URLs
So that I can navigate back to valid pages
```

**Acceptance Criteria:**
- [ ] 404 page shows for invalid URLs
- [ ] 404 page has search bar
- [ ] 404 page has links to popular pages
- [ ] 404 page matches site design
- [ ] Logs 404s for monitoring (potential broken links)

**Test File:** `e2e/error-handling.spec.ts`

---

# Performance Benchmarks (P2)

### US-051: Fast Homepage Load (P2)

**Story:**
```
As any user
I want the homepage to load quickly
So that I can start using the site immediately
```

**Acceptance Criteria:**
- [ ] Homepage loads in < 2 seconds on 3G connection
- [ ] First Contentful Paint (FCP) < 1 second
- [ ] Largest Contentful Paint (LCP) < 2.5 seconds
- [ ] Time to Interactive (TTI) < 3 seconds
- [ ] No layout shifts (CLS close to 0)

**Test File:** `e2e/performance.spec.ts`

---

### US-052: Fast Search Response (P2)

**Story:**
```
As any user
I want search results to appear quickly
So that I can find products efficiently
```

**Acceptance Criteria:**
- [ ] Search results appear in < 500ms
- [ ] Autocomplete suggestions appear in < 200ms
- [ ] Results cached for 3 minutes
- [ ] Pagination loads in < 300ms
- [ ] No perceived lag when typing

**Test File:** `e2e/performance.spec.ts`

---

### US-053: Fast Product Page Load (P2)

**Story:**
```
As any user
I want product pages to load quickly
So that I can view details without waiting
```

**Acceptance Criteria:**
- [ ] Product page loads in < 2 seconds
- [ ] Images lazy-load below the fold
- [ ] Price history chart loads asynchronously
- [ ] Related products load after main content
- [ ] No blocking JavaScript on initial render

**Test File:** `e2e/performance.spec.ts`

---

# Accessibility (P2)

### US-054: Keyboard Navigation (P2)

**Story:**
```
As a user relying on keyboard navigation
I want to navigate the entire site with keyboard
So that I can use the platform without a mouse
```

**Acceptance Criteria:**
- [ ] All interactive elements accessible via Tab
- [ ] Focus indicators visible on all elements
- [ ] Skip to main content link available
- [ ] Dropdown menus accessible with arrow keys
- [ ] Forms submittable with Enter key
- [ ] Escape key closes modals/dialogs

**Test File:** `e2e/accessibility.spec.ts`

---

### US-055: Screen Reader Support (P2)

**Story:**
```
As a user with visual impairments
I want screen reader support
So that I can use the platform effectively
```

**Acceptance Criteria:**
- [ ] All images have alt text
- [ ] ARIA labels on all interactive elements
- [ ] Form inputs have associated labels
- [ ] Landmarks used correctly (main, nav, aside)
- [ ] Status messages announced to screen readers
- [ ] Page titles descriptive and unique

**Test File:** `e2e/accessibility.spec.ts`

---

### US-056: High Contrast Mode (P2)

**Story:**
```
As a user with visual impairments
I want high contrast colors
So that I can read content clearly
```

**Acceptance Criteria:**
- [ ] Text meets WCAG AA contrast ratio (4.5:1)
- [ ] Interactive elements have sufficient contrast
- [ ] Focus indicators high contrast
- [ ] Icons have text alternatives
- [ ] Dark mode available with high contrast

**Test File:** `e2e/accessibility.spec.ts`

---

### US-057: Text Resize Support (P2)

**Story:**
```
As a user with visual impairments
I want to resize text up to 200%
So that I can read content comfortably
```

**Acceptance Criteria:**
- [ ] Text resizes to 200% without breaking layout
- [ ] No horizontal scrolling when text enlarged
- [ ] Buttons and form fields scale with text
- [ ] Charts and images maintain aspect ratios
- [ ] No content overlaps at large text sizes

**Test File:** `e2e/accessibility.spec.ts`

---

# Mobile Responsive (P2)

### US-058: Mobile Homepage (P2)

**Story:**
```
As a mobile user
I want the homepage optimized for mobile
So that I can browse easily on my phone
```

**Acceptance Criteria:**
- [ ] Homepage renders correctly on 375px width
- [ ] Navigation collapses to hamburger menu
- [ ] Hero section sized appropriately
- [ ] Category grid stacks on mobile
- [ ] Touch targets minimum 44x44px
- [ ] No horizontal scrolling required

**Test File:** `e2e/mobile.spec.ts`

---

### US-059: Mobile Product Page (P2)

**Story:**
```
As a mobile user
I want product pages optimized for mobile
So that I can view details on my phone
```

**Acceptance Criteria:**
- [ ] Product images swipeable on mobile
- [ ] Price chart displays correctly
- [ ] Offers list readable and tappable
- [ ] Add to watchlist button accessible
- [ ] Pinch to zoom works on images
- [ ] Loads in < 3 seconds on 3G

**Test File:** `e2e/mobile.spec.ts`

---

### US-060: Mobile Search (P2)

**Story:**
```
As a mobile user
I want search optimized for mobile
So that I can find products on my phone
```

**Acceptance Criteria:**
- [ ] Search bar prominent on mobile
- [ ] Virtual keyboard appears on tap
- [ ] Autocomplete suggestions tappable
- [ ] Results display in card layout
- [ ] Filters accessible via drawer/modal
- [ ] Infinite scroll or pagination works

**Test File:** `e2e/mobile.spec.ts`

---

## Summary

- **Total Stories:** 60
- **P0 (Critical):** 20 stories (33%)
- **P1 (Core Features):** 25 stories (42%)
- **P2 (Nice-to-Have):** 15 stories (25%)

### Coverage by Feature Area

- **Authentication:** 3 stories
- **Product Discovery:** 9 stories
- **Price Tracking:** 9 stories
- **Watch Lists:** 5 stories
- **Notifications:** 3 stories
- **Shopping:** 4 stories
- **Community:** 6 stories
- **Admin:** 11 stories
- **Edge Cases:** 2 stories
- **Performance:** 3 stories
- **Accessibility:** 4 stories
- **Mobile:** 3 stories

### Test File Distribution

- `e2e/auth.spec.ts` - 3 stories
- `e2e/product-discovery.spec.ts` - 6 stories
- `e2e/product-search.spec.ts` - 2 stories
- `e2e/price-alerts.spec.ts` - 7 stories
- `e2e/watchlist-management.spec.ts` - 5 stories
- `e2e/notifications.spec.ts` - 3 stories
- `e2e/shopping-cart.spec.ts` - 2 stories
- `e2e/product-comparison.spec.ts` - 2 stories
- `e2e/advanced-search.spec.ts` - 2 stories
- `e2e/community.spec.ts` - 6 stories
- `e2e/admin.spec.ts` - 11 stories
- `e2e/error-handling.spec.ts` - 2 stories
- `e2e/performance.spec.ts` - 3 stories
- `e2e/accessibility.spec.ts` - 4 stories
- `e2e/mobile.spec.ts` - 3 stories

---

**Next Steps:**
1. Set up E2E test database
2. Add data-testid attributes to components
3. Implement P0 tests first (20 stories)
4. Implement P1 tests (25 stories)
5. Implement P2 tests (15 stories)
6. Set up CI/CD integration

For test implementation details, see `/Users/williamtower/.claude/plans/streamed-roaming-pearl.md`
