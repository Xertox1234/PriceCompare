# Price History Charts - Long-Term Enhancement Plan

**Document Version:** 1.0
**Created:** 2025-11-11
**Last Updated:** 2025-11-11
**Status:** Planning Phase

---

## Table of Contents

1. [Overview](#overview)
2. [Implementation Phases](#implementation-phases)
3. [Phase 1: Foundation & Quick Wins](#phase-1-foundation--quick-wins-weeks-1-2)
4. [Phase 2: Intelligence & Predictions](#phase-2-intelligence--predictions-weeks-3-5)
5. [Phase 3: User Engagement](#phase-3-user-engagement-weeks-6-8)
6. [Phase 4: Advanced Features](#phase-4-advanced-features-weeks-9-12)
7. [File Patterns & Architecture](#file-patterns--architecture)
8. [Testing Strategy](#testing-strategy)
9. [Dependencies & Prerequisites](#dependencies--prerequisites)

---

## Overview

This document outlines a comprehensive plan to enhance the price history graphs feature with 23 improvements organized into 4 phases over 12 weeks.

### Success Metrics
- **User Engagement:** 60%+ of users interact with price history
- **Alert Conversion:** 30%+ of chart viewers set price alerts
- **Share Rate:** 15%+ of users share/export charts
- **Retention:** 25% increase in return visits

---

## Implementation Phases

```
Phase 1 (Weeks 1-2):  Foundation & Quick Wins        [PRIORITY: HIGH]
Phase 2 (Weeks 3-5):  Intelligence & Predictions     [PRIORITY: HIGH]
Phase 3 (Weeks 6-8):  User Engagement                [PRIORITY: MEDIUM]
Phase 4 (Weeks 9-12): Advanced Features              [PRIORITY: LOW]
```

---

## Phase 1: Foundation & Quick Wins (Weeks 1-2)

**Goal:** Implement high-value, low-effort improvements that enhance existing features.

### 1.1 Price Drop Alerts Integration ⭐ PRIORITY

**Estimated Time:** 3 days
**Complexity:** Medium
**Value:** Very High

#### Implementation Files

```typescript
// Backend: Extend existing price alert system
📁 server/services/price-alert-service.ts (ENHANCE EXISTING)
   - Add method: createAlertFromHistory(productId, priceThreshold, reason)
   - Add historical price context to alerts

📁 server/routes.ts (ADD ENDPOINTS)
   - POST /api/products/:id/alerts/from-history
   - GET /api/products/:id/alert-suggestions

// Frontend: Alert creation from chart
📁 client/src/components/price-history/PriceAlertButton.tsx (NEW)
   - Quick alert creation from chart view
   - Pre-filled with historical context

📁 client/src/components/price-history/PriceHistoryChart.tsx (ENHANCE)
   - Add "Set Alert" button on chart
   - Show alert threshold lines on chart
   - Visual markers for active alerts
```

#### Pattern References

```typescript
// Follow existing alert pattern from:
📄 Reference: /server/storage.ts (lines 600-650) - Existing alert methods
📄 Reference: /shared/schema.ts (lines 162-170) - priceAlerts table

// Example implementation:
interface AlertFromHistory {
  type: 'below_average' | 'historical_low' | 'custom';
  targetPrice: number;
  context: {
    historicalAverage: number;
    lowestPrice: number;
    daysAnalyzed: number;
  };
}
```

#### Testing Requirements

```typescript
📁 server/__tests__/price-alert-integration.test.ts (NEW)
   - Test alert creation from chart
   - Test alert threshold calculations
   - Test historical context inclusion

📁 client/src/components/price-history/__tests__/PriceAlertButton.test.tsx (NEW)
   - Test button rendering
   - Test alert creation flow
   - Test chart marker display
```

---

### 1.2 Chart Enhancements

**Estimated Time:** 2 days
**Complexity:** Low
**Value:** Medium

#### Implementation Files

```typescript
📁 client/src/components/price-history/PriceHistoryChart.tsx (ENHANCE)
   - Add zoom/pan with Recharts Brush component
   - Implement click-to-compare between two points
   - Add retailer logos to legend
   - Optimize colors for dark mode

📁 client/src/components/price-history/ChartAnnotations.tsx (NEW)
   - Highlight major price drops (>15%)
   - Add event markers (Black Friday, Prime Day)
   - Custom annotations system
```

#### Pattern References

```typescript
// Recharts zoom/pan example:
📄 Reference: https://recharts.org/en-US/examples/SimpleLineChart
📄 Reference: /client/src/pages/admin.tsx (lines 400-500) - Existing chart usage

// Implementation pattern:
import { Brush } from 'recharts';

<LineChart>
  {/* ... existing chart ... */}
  <Brush
    dataKey="date"
    height={30}
    stroke="#3b82f6"
  />
</LineChart>
```

---

### 1.3 Export & Share Functionality

**Estimated Time:** 3 days
**Complexity:** Medium
**Value:** High

#### Implementation Files

```typescript
// Frontend: Export capabilities
📁 client/src/components/price-history/ChartExport.tsx (NEW)
   - Export chart as PNG using html2canvas
   - Export data as CSV
   - Generate shareable link
   - Copy chart to clipboard

📁 client/src/hooks/useChartExport.ts (NEW)
   - Hook for export functionality
   - Image generation logic
   - CSV data formatting

📁 client/src/components/price-history/ShareDialog.tsx (NEW)
   - Share modal with preview
   - Social media sharing
   - Email share option
```

#### Dependencies

```json
{
  "html2canvas": "^1.4.1",
  "file-saver": "^2.0.5"
}
```

#### Pattern References

```typescript
// Export implementation:
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

async function exportChartAsImage(elementId: string) {
  const element = document.getElementById(elementId);
  const canvas = await html2canvas(element);
  canvas.toBlob((blob) => {
    saveAs(blob, `price-history-${productId}.png`);
  });
}
```

---

### 1.4 Mobile Optimization

**Estimated Time:** 2 days
**Complexity:** Low
**Value:** Medium

#### Implementation Files

```typescript
📁 client/src/components/price-history/MobileTimeSelector.tsx (NEW)
   - Swipeable time range selector
   - Touch-optimized controls

📁 client/src/components/price-history/PriceHistoryChart.tsx (ENHANCE)
   - Responsive breakpoints
   - Simplified chart for mobile
   - Touch-friendly tooltips
```

#### Pattern References

```typescript
// Use existing responsive patterns:
📄 Reference: /client/src/components/product-card.tsx - Responsive design
📄 Reference: /client/src/components/filter-sidebar.tsx - Mobile drawer pattern

// Media query pattern:
import { useMediaQuery } from '@/hooks/use-media-query';

const isMobile = useMediaQuery('(max-width: 768px)');
```

---

## Phase 2: Intelligence & Predictions (Weeks 3-5)

**Goal:** Add smart insights and predictive capabilities.

### 2.1 ML Prediction Integration ⭐ PRIORITY

**Estimated Time:** 5 days
**Complexity:** High
**Value:** Very High

#### Implementation Files

```typescript
// Backend: Connect to existing predictions
📁 server/storage.ts (ENHANCE)
   - Add method: getPricePredictions(productId, days)
   - Merge predictions with historical data

📁 server/routes.ts (ADD ENDPOINT)
   - GET /api/products/:id/price-predictions

// Frontend: Display predictions
📁 client/src/components/price-history/PredictionBand.tsx (NEW)
   - Show prediction line on chart
   - Confidence interval shading
   - Accuracy tracking display

📁 client/src/components/price-history/PredictionInsights.tsx (NEW)
   - "Predicted price in 7 days: $X"
   - Confidence score visualization
   - Historical accuracy stats
```

#### Pattern References

```typescript
// Use existing pricePredictions table:
📄 Reference: /shared/schema.ts (lines 521-534) - pricePredictions schema

// Implementation:
interface PredictionData {
  date: Date;
  predictedPrice: number;
  confidenceScore: number;
  actualPrice?: number; // if date has passed
  accuracy?: number;    // if validated
}

async getPricePredictions(productId: number, days: number) {
  return await db
    .select()
    .from(pricePredictions)
    .where(and(
      eq(pricePredictions.productOfferId, productOfferId),
      gte(pricePredictions.predictionDate, new Date())
    ))
    .limit(days);
}
```

---

### 2.2 Seasonal Pattern Detection

**Estimated Time:** 4 days
**Complexity:** High
**Value:** High

#### Implementation Files

```typescript
// Backend: Pattern analysis
📁 server/services/seasonal-analysis-service.ts (NEW)
   - Detect recurring price patterns
   - Identify seasonal events
   - Calculate historical event discounts

📁 server/storage.ts (ENHANCE)
   - Add method: getSeasonalInsights(productId, category)
   - Historical event price analysis

// Frontend: Display patterns
📁 client/src/components/price-history/SeasonalInsights.tsx (NEW)
   - Show upcoming sales events
   - Historical discount percentages
   - "Best time to buy" recommendations
```

#### Algorithm Outline

```typescript
interface SeasonalPattern {
  eventName: string;
  typicalDates: DateRange;
  averageDiscount: number;
  reliability: number; // 0-1
  daysUntilNext: number;
}

class SeasonalAnalyzer {
  // Detect patterns by analyzing price drops around known dates
  detectPatterns(history: PriceHistory[]): SeasonalPattern[] {
    const events = [
      { name: 'Black Friday', month: 10, day: 25, window: 3 },
      { name: 'Prime Day', month: 6, day: 15, window: 2 },
      { name: 'Back to School', month: 7, day: 15, window: 14 },
      // ... more events
    ];

    // For each event, analyze price drops in that window over past years
    // Calculate average discount, consistency, etc.
  }
}
```

---

### 2.3 Price Volatility Score

**Estimated Time:** 2 days
**Complexity:** Medium
**Value:** Medium

#### Implementation Files

```typescript
// Backend: Volatility calculation
📁 server/storage.ts (ENHANCE)
   - Add to getPriceTrend(): volatilityScore calculation

📁 shared/types.ts (ENHANCE)
   - Add VolatilityAnalysis interface

// Frontend: Display volatility
📁 client/src/components/price-history/VolatilityIndicator.tsx (NEW)
   - Visual volatility meter
   - Classification (stable/moderate/volatile)
   - Risk-based recommendations
```

#### Calculation Method

```typescript
interface VolatilityAnalysis {
  score: number; // 0-10
  classification: 'stable' | 'moderate' | 'volatile';
  standardDeviation: number;
  coefficientOfVariation: number;
  recommendation: string;
}

function calculateVolatility(prices: number[]): VolatilityAnalysis {
  const mean = prices.reduce((a, b) => a + b) / prices.length;
  const variance = prices.reduce((sum, price) =>
    sum + Math.pow(price - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100; // Coefficient of Variation

  // Score from 0-10 based on CV
  const score = Math.min(Math.round(cv), 10);

  return {
    score,
    classification: score < 3 ? 'stable' : score < 7 ? 'moderate' : 'volatile',
    standardDeviation: stdDev,
    coefficientOfVariation: cv,
    recommendation: getVolatilityRecommendation(score)
  };
}
```

---

### 2.4 Retailer Reliability Scoring

**Estimated Time:** 3 days
**Complexity:** Medium
**Value:** High

#### Implementation Files

```typescript
// Backend: Retailer analysis
📁 server/services/retailer-analysis-service.ts (NEW)
   - Calculate reliability metrics per retailer
   - Track best deal frequency
   - Analyze price stability

📁 server/storage.ts (ADD)
   - getRetailerReliability(retailerId): Promise<RetailerScore>

// Frontend: Display scores
📁 client/src/components/price-history/RetailerScoreCard.tsx (NEW)
   - Reliability badges
   - Historical stats
   - "Best for" tags (price/stability/deals)
```

#### Scoring Algorithm

```typescript
interface RetailerScore {
  retailerId: number;
  retailerName: string;
  priceStability: number;      // 0-10 (lower CV = higher score)
  bestDealFrequency: number;   // % of time has best price
  averageSavings: number;      // vs. average market price
  stockReliability: number;    // % of time has in stock
  overallScore: number;        // weighted composite
}

async function calculateRetailerScore(
  retailerId: number,
  productId: number
): Promise<RetailerScore> {
  // Get all price history for this retailer+product
  const history = await getPriceHistory(productId);
  const retailerHistory = history.filter(h => h.retailerId === retailerId);

  // Calculate metrics...
  const stability = calculatePriceStability(retailerHistory);
  const bestDealFreq = calculateBestDealFrequency(history, retailerId);
  // ... etc

  return {
    retailerId,
    priceStability: stability,
    bestDealFrequency: bestDealFreq,
    // ...
    overallScore: (stability * 0.3 + bestDealFreq * 0.4 + ...) / weights
  };
}
```

---

## Phase 3: User Engagement (Weeks 6-8)

**Goal:** Increase user interaction and community features.

### 3.1 Price Watch Dashboard

**Estimated Time:** 5 days
**Complexity:** Medium
**Value:** High

#### Implementation Files

```typescript
// New page for price watching
📁 client/src/pages/price-watch.tsx (NEW)
   - Grid of all watched products
   - Mini charts for each
   - Sorting/filtering options
   - Bulk actions (remove, update alerts)

📁 client/src/components/price-watch/WatchedProductCard.tsx (NEW)
   - Compact product display
   - Inline mini-chart
   - Quick actions

📁 client/src/components/price-watch/WatchlistStats.tsx (NEW)
   - Total potential savings
   - Active alerts count
   - Best current deals
```

#### Pattern References

```typescript
// Follow dashboard pattern:
📄 Reference: /client/src/pages/admin.tsx - Dashboard layout
📄 Reference: /client/src/components/product-grid.tsx - Grid pattern

// Route addition:
📄 Update: /client/src/App.tsx - Add route
import PriceWatch from '@/pages/price-watch';

<Route path="/price-watch" component={PriceWatch} />
```

---

### 3.2 Community Price Tracking

**Estimated Time:** 4 days
**Complexity:** Medium
**Value:** Medium

#### Implementation Files

```typescript
// Backend: Community features
📁 server/storage.ts (ADD)
   - trackCommunityPurchase(userId, productId, price, date)
   - getCommunityPriceData(productId)

// Frontend: Social proof
📁 client/src/components/price-history/CommunityInsights.tsx (NEW)
   - "23 users bought at this price"
   - Community price distribution
   - User reviews at price points

📁 client/src/components/price-history/PriceDiscussion.tsx (NEW)
   - Forum integration
   - Price-specific threads
   - Deal sharing
```

#### Pattern References

```typescript
// Integrate with existing forum:
📄 Reference: /server/forum-storage.ts - Forum integration
📄 Reference: /shared/schema.ts (lines 119-137) - forumTopics

// Link chart to forum:
interface CommunityPriceData {
  pricePoint: number;
  purchaseCount: number;
  userReviews: ForumPost[];
  satisfaction: number; // 0-5
  dealQuality: 'excellent' | 'good' | 'fair';
}
```

---

### 3.3 Smart Notifications

**Estimated Time:** 4 days
**Complexity:** High
**Value:** High

#### Implementation Files

```typescript
// Backend: Notification engine
📁 server/services/smart-notification-service.ts (NEW)
   - Analyze triggers (price + stock + prediction)
   - Prioritize notifications
   - Batch similar notifications

📁 server/jobs/notification-processor.ts (NEW)
   - Bull job for checking conditions
   - Rate limiting per user
   - Delivery via multiple channels

// Frontend: Notification UI
📁 client/src/components/notifications/SmartAlertCard.tsx (NEW)
   - Urgency indicators
   - Reasoning display
   - Quick actions
```

#### Notification Types

```typescript
interface SmartNotification {
  id: string;
  type: 'price_drop' | 'stock_low' | 'prediction' | 'seasonal';
  urgency: 'low' | 'medium' | 'high' | 'critical';

  trigger: {
    condition: string;        // "Price dropped 20%"
    threshold: number;        // What triggered it
    currentValue: number;     // Current state
  };

  reasoning: string[];        // Why this is important
  action: {
    label: string;           // "Buy Now"
    url: string;
    type: 'buy' | 'view' | 'share';
  };

  expiresAt: Date;           // Urgency deadline
  metadata: {
    productId: number;
    savings: number;
    confidence: number;
  };
}

// Notification rules:
const rules = [
  {
    name: 'critical_drop',
    condition: (current, history) =>
      current.price < history.lowestPrice &&
      current.stock === 'limited_stock',
    urgency: 'critical'
  },
  // ... more rules
];
```

---

### 3.4 Browser Extension (Optional)

**Estimated Time:** 10 days
**Complexity:** Very High
**Value:** Very High

#### New Project Structure

```
📁 extensions/chrome/
   ├── manifest.json
   ├── background.js
   ├── content-scripts/
   │   ├── amazon-overlay.js
   │   ├── bestbuy-overlay.js
   │   └── generic-overlay.js
   ├── popup/
   │   ├── popup.html
   │   ├── popup.tsx
   │   └── components/
   └── shared/
       ├── api-client.ts
       └── storage.ts
```

#### Implementation Files

```typescript
// Extension manifest
📁 extensions/chrome/manifest.json (NEW)
{
  "manifest_version": 3,
  "name": "PriceCompare History",
  "version": "1.0",
  "permissions": ["storage", "tabs"],
  "content_scripts": [{
    "matches": ["*://*.amazon.com/*"],
    "js": ["content-scripts/amazon-overlay.js"]
  }]
}

// Content script
📁 extensions/chrome/content-scripts/amazon-overlay.js (NEW)
   - Detect product page
   - Inject price history chart
   - API communication with main app
```

#### Pattern References

```typescript
// Chrome Extension API:
📄 Reference: https://developer.chrome.com/docs/extensions/mv3/

// Content script injection:
const productId = extractProductId(window.location.href);
const historyData = await fetchPriceHistory(productId);
injectChart(historyData);
```

---

## Phase 4: Advanced Features (Weeks 9-12)

**Goal:** Polish and advanced capabilities.

### 4.1 Interactive Tooltips

**Estimated Time:** 3 days
**Complexity:** Medium
**Value:** Medium

#### Implementation Files

```typescript
📁 client/src/components/price-history/InteractiveTooltip.tsx (NEW)
   - Click-to-expand tooltips
   - Multi-retailer comparison view
   - Contextual actions (set alert, view reviews)
   - Historical event context
```

---

### 4.2 Comparison Mode

**Estimated Time:** 5 days
**Complexity:** High
**Value:** Medium

#### Implementation Files

```typescript
📁 client/src/components/price-history/ProductComparison.tsx (NEW)
   - Side-by-side chart comparison
   - Overlay mode for multiple products
   - Relative pricing view

📁 client/src/hooks/useProductComparison.ts (NEW)
   - Manage comparison state
   - Normalize price scales
   - Sync time ranges
```

---

### 4.3 Performance Optimizations

**Estimated Time:** 4 days
**Complexity:** Medium
**Value:** High

#### Implementation Files

```typescript
// Backend: Caching & optimization
📁 server/middleware/chart-cache.ts (NEW)
   - Cache popular charts at edge
   - CDN integration
   - Invalidation strategy

// Frontend: Data loading
📁 client/src/hooks/usePriceHistoryInfinite.ts (NEW)
   - Infinite scroll for old data
   - Progressive loading
   - Background sync

📁 client/src/utils/chart-data-transformer.ts (NEW)
   - Client-side aggregation
   - Data compression
   - Memoization
```

#### Optimization Strategies

```typescript
// 1. Server-side caching
import { redisClient } from '@/config/redis';

async function getCachedPriceHistory(productId: number) {
  const cacheKey = `price-history:${productId}:30d`;
  const cached = await redisClient.get(cacheKey);

  if (cached) return JSON.parse(cached);

  const data = await fetchPriceHistory(productId, 30);
  await redisClient.setex(cacheKey, 3600, JSON.stringify(data)); // 1hr cache
  return data;
}

// 2. Client-side data aggregation
function aggregateOldData(history: PriceHistory[]) {
  // For data older than 90 days, aggregate to weekly averages
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const recent = history.filter(h => new Date(h.recordedAt) >= cutoff);
  const old = history.filter(h => new Date(h.recordedAt) < cutoff);

  const aggregated = aggregateByWeek(old);

  return [...recent, ...aggregated];
}

// 3. Progressive enhancement
function useProgressivePriceHistory(productId: number) {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Load 30 days first (fast)
    fetchPriceHistory(productId, 30).then(setData);

    // Then load older data in background
    setTimeout(() => {
      fetchPriceHistory(productId, 365).then(fullData => {
        setData(aggregateOldData(fullData));
      });
    }, 1000);
  }, [productId]);

  return data;
}
```

---

## File Patterns & Architecture

### Directory Structure

```
/home/user/PriceCompare/
├── client/src/
│   ├── components/
│   │   ├── price-history/
│   │   │   ├── PriceHistoryChart.tsx          [EXISTING]
│   │   │   ├── PriceTrendIndicator.tsx        [EXISTING]
│   │   │   ├── BestTimeToBuy.tsx              [EXISTING]
│   │   │   ├── TimeRangeSelector.tsx          [EXISTING]
│   │   │   ├── PriceAlertButton.tsx           [NEW - Phase 1]
│   │   │   ├── ChartAnnotations.tsx           [NEW - Phase 1]
│   │   │   ├── ChartExport.tsx                [NEW - Phase 1]
│   │   │   ├── ShareDialog.tsx                [NEW - Phase 1]
│   │   │   ├── PredictionBand.tsx             [NEW - Phase 2]
│   │   │   ├── SeasonalInsights.tsx           [NEW - Phase 2]
│   │   │   ├── VolatilityIndicator.tsx        [NEW - Phase 2]
│   │   │   ├── RetailerScoreCard.tsx          [NEW - Phase 2]
│   │   │   ├── CommunityInsights.tsx          [NEW - Phase 3]
│   │   │   ├── InteractiveTooltip.tsx         [NEW - Phase 4]
│   │   │   ├── ProductComparison.tsx          [NEW - Phase 4]
│   │   │   └── __tests__/
│   │   ├── price-watch/                       [NEW - Phase 3]
│   │   │   ├── WatchedProductCard.tsx
│   │   │   ├── WatchlistStats.tsx
│   │   │   └── WatchDashboard.tsx
│   │   └── notifications/                     [NEW - Phase 3]
│   │       ├── SmartAlertCard.tsx
│   │       └── NotificationCenter.tsx
│   ├── pages/
│   │   └── price-watch.tsx                    [NEW - Phase 3]
│   ├── hooks/
│   │   ├── useChartExport.ts                  [NEW - Phase 1]
│   │   ├── usePriceHistoryInfinite.ts         [NEW - Phase 4]
│   │   └── useProductComparison.ts            [NEW - Phase 4]
│   └── utils/
│       └── chart-data-transformer.ts          [NEW - Phase 4]
│
├── server/
│   ├── services/
│   │   ├── price-snapshot-service.ts          [EXISTING]
│   │   ├── price-alert-service.ts             [NEW - Phase 1]
│   │   ├── seasonal-analysis-service.ts       [NEW - Phase 2]
│   │   ├── retailer-analysis-service.ts       [NEW - Phase 2]
│   │   └── smart-notification-service.ts      [NEW - Phase 3]
│   ├── jobs/
│   │   ├── price-snapshot-queue.ts            [EXISTING]
│   │   └── notification-processor.ts          [NEW - Phase 3]
│   ├── middleware/
│   │   └── chart-cache.ts                     [NEW - Phase 4]
│   └── __tests__/
│       ├── price-alert-integration.test.ts    [NEW - Phase 1]
│       ├── seasonal-analysis.test.ts          [NEW - Phase 2]
│       └── smart-notifications.test.ts        [NEW - Phase 3]
│
├── shared/
│   └── types.ts                               [ENHANCE - All Phases]
│
├── extensions/                                [NEW - Phase 3]
│   └── chrome/
│       ├── manifest.json
│       ├── background.js
│       └── content-scripts/
│
└── docs/
    └── PRICE_HISTORY_ROADMAP.md              [THIS FILE]
```

---

## Testing Strategy

### Test Coverage Requirements

```typescript
// Unit Tests (Required for all features)
- Component rendering
- Data transformation logic
- API endpoint responses
- Service method functionality

// Integration Tests (Phase 2+)
- Alert creation from chart
- Prediction accuracy tracking
- Notification triggering
- Cache invalidation

// E2E Tests (Phase 3+)
- Complete user flows
- Multi-step interactions
- Cross-component communication
```

### Testing Pattern

```typescript
// Every new component gets tests:
📁 client/src/components/price-history/__tests__/[ComponentName].test.tsx

describe('[ComponentName]', () => {
  it('should render loading state', () => { /* ... */ });
  it('should render empty state', () => { /* ... */ });
  it('should render with data', () => { /* ... */ });
  it('should handle user interactions', () => { /* ... */ });
  it('should handle errors gracefully', () => { /* ... */ });
});

// Every service gets tests:
📁 server/__tests__/[service-name].test.ts

describe('[ServiceName]', () => {
  beforeEach(() => {
    // Reset mocks
  });

  it('should perform primary operation', () => { /* ... */ });
  it('should handle edge cases', () => { /* ... */ });
  it('should throw on invalid input', () => { /* ... */ });
});
```

---

## Dependencies & Prerequisites

### New npm Packages Required

```json
{
  "dependencies": {
    // Phase 1
    "html2canvas": "^1.4.1",          // Chart export as image
    "file-saver": "^2.0.5",           // Download exports

    // Phase 2
    "simple-statistics": "^7.8.3",    // Statistical analysis
    "ml-regression": "^6.0.0",        // Price predictions

    // Phase 3
    "socket.io": "^4.7.5",            // Real-time notifications
    "socket.io-client": "^4.7.5",     // Client-side WebSocket

    // Phase 4
    "lru-cache": "^10.4.3"            // Client-side caching
  },

  "devDependencies": {
    "chrome-types": "^0.1.295"        // Chrome extension typing
  }
}
```

### Environment Variables

```bash
# Phase 2: ML Predictions
ENABLE_PRICE_PREDICTIONS=true
ML_MODEL_ENDPOINT=https://...

# Phase 3: Real-time notifications
ENABLE_WEBSOCKETS=true
WEBSOCKET_PORT=3001
NOTIFICATION_RATE_LIMIT=10  # per user per hour

# Phase 4: Performance
ENABLE_CHART_CACHE=true
CHART_CACHE_TTL=3600        # 1 hour
CDN_URL=https://...
```

### Database Schema Changes

```sql
-- Phase 1: Alert enhancements
ALTER TABLE price_alerts
  ADD COLUMN created_from_chart BOOLEAN DEFAULT false,
  ADD COLUMN historical_context JSONB;

-- Phase 2: Retailer scoring
CREATE TABLE retailer_scores (
  id SERIAL PRIMARY KEY,
  retailer_id INTEGER REFERENCES retailers(id),
  product_id INTEGER REFERENCES products(id),
  price_stability DECIMAL(3,2),
  best_deal_frequency DECIMAL(5,2),
  overall_score DECIMAL(3,2),
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Phase 3: Community tracking
CREATE TABLE community_purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  purchase_price DECIMAL(10,2),
  purchased_at TIMESTAMP,
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5)
);

CREATE TABLE smart_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  notification_type VARCHAR(50),
  urgency VARCHAR(20),
  data JSONB,
  sent_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  acted_on BOOLEAN DEFAULT false
);
```

---

## Implementation Checklist

### Phase 1 Tasks
- [ ] 1.1 Price Drop Alerts Integration
  - [ ] Backend: Extend alert service
  - [ ] Backend: Add API endpoints
  - [ ] Frontend: PriceAlertButton component
  - [ ] Frontend: Chart alert markers
  - [ ] Tests: Alert integration tests
  - [ ] Documentation: API docs update

- [ ] 1.2 Chart Enhancements
  - [ ] Add zoom/pan (Brush component)
  - [ ] Retailer logo legends
  - [ ] Dark mode optimization
  - [ ] Event annotations
  - [ ] Tests: Enhanced chart tests

- [ ] 1.3 Export & Share
  - [ ] Image export (html2canvas)
  - [ ] CSV export
  - [ ] Share dialog
  - [ ] Social media integration
  - [ ] Tests: Export functionality

- [ ] 1.4 Mobile Optimization
  - [ ] Responsive breakpoints
  - [ ] Touch-optimized tooltips
  - [ ] Swipeable time selector
  - [ ] Tests: Mobile rendering

### Phase 2 Tasks
- [ ] 2.1 ML Prediction Integration
  - [ ] Connect to pricePredictions table
  - [ ] PredictionBand component
  - [ ] Confidence intervals
  - [ ] Accuracy tracking
  - [ ] Tests: Prediction display

- [ ] 2.2 Seasonal Pattern Detection
  - [ ] SeasonalAnalyzer service
  - [ ] Event detection algorithm
  - [ ] SeasonalInsights component
  - [ ] Tests: Pattern detection

- [ ] 2.3 Price Volatility Score
  - [ ] Volatility calculation
  - [ ] VolatilityIndicator component
  - [ ] Risk-based recommendations
  - [ ] Tests: Score calculation

- [ ] 2.4 Retailer Reliability Scoring
  - [ ] RetailerAnalysis service
  - [ ] Scoring algorithm
  - [ ] RetailerScoreCard component
  - [ ] Database: retailer_scores table
  - [ ] Tests: Scoring logic

### Phase 3 Tasks
- [ ] 3.1 Price Watch Dashboard
  - [ ] New page: price-watch.tsx
  - [ ] WatchedProductCard component
  - [ ] WatchlistStats component
  - [ ] Bulk actions
  - [ ] Tests: Dashboard functionality

- [ ] 3.2 Community Price Tracking
  - [ ] Database: community_purchases table
  - [ ] Community data collection
  - [ ] CommunityInsights component
  - [ ] Forum integration
  - [ ] Tests: Community features

- [ ] 3.3 Smart Notifications
  - [ ] SmartNotificationService
  - [ ] Notification rules engine
  - [ ] WebSocket integration
  - [ ] SmartAlertCard component
  - [ ] Database: smart_notifications table
  - [ ] Tests: Notification triggering

- [ ] 3.4 Browser Extension (Optional)
  - [ ] Extension manifest
  - [ ] Content scripts
  - [ ] Popup UI
  - [ ] API integration
  - [ ] Tests: Extension functionality

### Phase 4 Tasks
- [ ] 4.1 Interactive Tooltips
  - [ ] InteractiveTooltip component
  - [ ] Click-to-expand
  - [ ] Contextual actions
  - [ ] Tests: Tooltip interactions

- [ ] 4.2 Comparison Mode
  - [ ] ProductComparison component
  - [ ] Overlay mode
  - [ ] Sync time ranges
  - [ ] Tests: Comparison logic

- [ ] 4.3 Performance Optimizations
  - [ ] Server-side caching
  - [ ] Redis integration
  - [ ] Progressive loading
  - [ ] CDN setup
  - [ ] Tests: Cache behavior

---

## Success Metrics & KPIs

### Phase 1 Targets
- **Alert Creation Rate:** 30% of chart viewers
- **Export Usage:** 15% export/share rate
- **Mobile Engagement:** 40% of mobile users interact with charts

### Phase 2 Targets
- **Prediction Accuracy:** >75% within 5% of actual price
- **Seasonal Detection:** Identify 90% of major sales events
- **User Trust:** 80% find insights helpful (survey)

### Phase 3 Targets
- **Dashboard Adoption:** 50% of users visit price watch
- **Community Participation:** 20% share purchase prices
- **Notification Click-through:** 40% act on smart alerts

### Phase 4 Targets
- **Performance:** <200ms chart load time
- **Cache Hit Rate:** >80% for popular products
- **Extension Install:** 1000+ active users

---

## Rollback Strategy

For each phase, maintain rollback capability:

```typescript
// Feature flags for gradual rollout
const FEATURE_FLAGS = {
  ENABLE_CHART_ALERTS: process.env.ENABLE_CHART_ALERTS === 'true',
  ENABLE_PREDICTIONS: process.env.ENABLE_PREDICTIONS === 'true',
  ENABLE_SMART_NOTIFICATIONS: process.env.ENABLE_SMART_NOTIFICATIONS === 'true',
  ENABLE_EXTENSION: process.env.ENABLE_EXTENSION === 'true',
};

// Database migrations are reversible
// Every migration includes a "down" method:
export async function up() { /* create table */ }
export async function down() { /* drop table */ }
```

---

## Notes & Considerations

1. **Backward Compatibility:** All new features must work with existing data
2. **Performance Budget:** Each phase should not increase page load by >100ms
3. **Mobile First:** All features must work on mobile
4. **Accessibility:** WCAG 2.1 AA compliance for all new components
5. **Privacy:** User purchase data is opt-in only
6. **Scalability:** Design for 100k products, 1M price points

---

## References

- [Recharts Documentation](https://recharts.org/)
- [Bull Queue Guide](https://github.com/OptimalBits/bull)
- [React Query Patterns](https://tanstack.com/query/latest)
- [Chrome Extension Guide](https://developer.chrome.com/docs/extensions/)
- [Statistical Analysis Library](https://simplestatistics.org/)

---

**End of Roadmap Document**

*This is a living document. Update as features are completed or requirements change.*
