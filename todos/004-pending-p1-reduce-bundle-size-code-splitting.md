---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, performance, frontend, critical]
dependencies: []
source: code-review-2025-11-30
---

# Reduce Main Bundle Size via Code Splitting

## Problem Statement

**CRITICAL PERFORMANCE ISSUE:** Main bundle is 928.86 kB (243.82 kB gzipped), exceeding recommended limits by 54%.

**User Impact:**
- **8-12 second load time** on 3G connection
- **First Contentful Paint delayed** by 3-5 seconds
- **Time to Interactive:** 10-15 seconds on slow connections
- **Lighthouse Performance Score:** Estimated 50-70 (target: 90+)
- **High bounce rate risk** on slow connections

**Current Bundle Breakdown:**
```
Main bundle:    928.86 kB (243.82 kB gzipped) ⚠️ TOO LARGE
Chart vendor:   367.75 kB (107.64 kB gzipped) ⚠️ TOO LARGE
UI vendor:      125.90 kB ( 39.67 kB gzipped) ✅ OK
```

**Build Warning:**
```
WARNING: Chunks larger than 600 kB detected!
```

## Findings

**Discovery:** Performance Oracle identified bundle size crisis

**Root Causes:**
1. **No route-based code splitting** - all pages in single bundle
2. **Chart library loaded eagerly** - 367 KB loaded on every page
3. **No manual chunk configuration** - Vite auto-chunking insufficient

**Affected User Experience:**
- Product search page: Loads charts unnecessarily
- Login page: Loads admin panel code unnecessarily
- Mobile users: Pay bandwidth cost for unused code

## Proposed Solutions

### Solution 1: Route-Based Code Splitting (HIGHEST IMPACT)

**Target:** 928 KB → 280 KB initial bundle (-70%)

**Implementation:**

```typescript
// client/src/App.tsx
import { lazy, Suspense } from 'react';
import { Route, Router } from 'wouter';

// ✅ Load eagerly (needed immediately)
import HomePage from '@/pages/home';
import LoginPage from '@/pages/login';
import LoadingSpinner from '@/components/loading-spinner';

// ✅ Lazy load (loaded on demand)
const AdminPage = lazy(() => import('@/pages/admin'));
const ProductDetailPage = lazy(() => import('@/pages/product-detail'));
const ProductsNewPage = lazy(() => import('@/pages/products-new'));
const WatchListPage = lazy(() => import('@/pages/watch-list-manager'));
const AnalyticsPage = lazy(() => import('@/pages/analytics'));
const AdvancedSearchPage = lazy(() => import('@/pages/advanced-search'));
const CommunityPage = lazy(() => import('@/pages/community'));
const ForumPage = lazy(() => import('@/pages/forum'));

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        {/* Eager routes */}
        <Route path="/" component={HomePage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={LoginPage} />

        {/* Lazy routes */}
        <Route path="/admin" component={AdminPage} />
        <Route path="/products/:id" component={ProductDetailPage} />
        <Route path="/products/new" component={ProductsNewPage} />
        <Route path="/watchlists" component={WatchListPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/search/advanced" component={AdvancedSearchPage} />
        <Route path="/community" component={CommunityPage} />
        <Route path="/forum/:id?" component={ForumPage} />
      </Suspense>
    </Router>
  );
}
```

**Expected Result:**
```
Initial bundle:  280 kB (-70%) ✅
Admin chunk:     120 kB (loaded only for /admin)
Analytics chunk: 150 kB (loaded only for /analytics)
Product chunk:   200 kB (loaded only for /products)
Community chunk: 180 kB (loaded only for /community)
```

### Solution 2: Lazy Load Chart Components

**Target:** Chart bundle 367 KB → 80 KB (lazy) or 50 KB (switch library)

**Option A - Lazy Load Charts:**
```typescript
// client/src/components/price-history-chart.tsx
import { lazy, Suspense } from 'react';

const LazyPriceChart = lazy(() => import('./price-chart-impl'));

export function PriceHistoryChart(props: PriceHistoryChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <LazyPriceChart {...props} />
    </Suspense>
  );
}
```

**Option B - Switch to Lightweight Library:**
```bash
npm uninstall recharts  # 60 KB
npm install lightweight-charts  # 15 KB
```

**Recommendation:** Start with Option A (lazy loading), evaluate Option B if still too large.

### Solution 3: Manual Chunk Splitting

**Add to `vite.config.ts`:**

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React (shared across all pages)
          'vendor-react': ['react', 'react-dom', 'wouter'],

          // Large UI dependencies (lazy load with pages)
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
          ],

          // Data fetching (needed on most pages)
          'vendor-query': ['@tanstack/react-query'],

          // Charts (lazy load only on analytics/product pages)
          'vendor-charts': ['recharts'],

          // Forms (lazy load with form-heavy pages)
          'vendor-forms': ['react-hook-form', 'zod'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // Enforce 600 KB limit
  },
});
```

## Recommended Action

**Implement all 3 solutions in order:**

### Week 1: Route-Based Code Splitting
1. Create `LoadingSpinner` component
2. Convert all page imports to `lazy()` except home + login
3. Wrap router in `<Suspense>`
4. Test each route loads correctly
5. **Expected impact:** -648 KB initial bundle

### Week 1: Manual Chunk Splitting
6. Update `vite.config.ts` with manual chunks
7. Run production build
8. Verify chunk sizes
9. **Expected impact:** Better caching (vendor chunks rarely change)

### Week 2: Lazy Load Charts
10. Create `ChartSkeleton` component
11. Wrap chart components in `lazy()` + `Suspense`
12. Test chart pages
13. **Expected impact:** -287 KB on non-chart pages

### Week 2: Testing & Validation
14. Run Lighthouse audit (target: 90+ performance score)
15. Test on throttled 3G connection
16. Measure First Contentful Paint (<2s target)
17. Measure Time to Interactive (<5s target)

## Technical Details

- **Bundle Tool:** Vite (uses Rollup internally)
- **Code Splitting Method:** Dynamic imports via `lazy()`
- **Browser Support:** All modern browsers (ES2015+)
- **Network Impact:** Initial load faster, subsequent navigation slightly slower (acceptable tradeoff)

### Before/After Comparison:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Bundle | 928 KB | 280 KB | -70% |
| FCP (3G) | 5-8s | 1-2s | -75% |
| TTI (3G) | 12-15s | 4-6s | -66% |
| Lighthouse Score | 50-70 | 85-95 | +25-45 pts |

## Acceptance Criteria

- [ ] All non-critical routes lazy loaded
- [ ] Initial bundle < 300 KB (gzipped < 80 KB)
- [ ] Lighthouse performance score > 85
- [ ] First Contentful Paint < 2s on 3G
- [ ] Time to Interactive < 5s on 3G
- [ ] No blank screens (proper loading states)
- [ ] All routes load correctly (manual testing)
- [ ] Build warning removed (no chunks > 600 KB)

## Work Log

### 2025-11-30 - Code Review Discovery
**By:** Performance Oracle Agent
**Actions:**
- Measured bundle sizes from Vite build output
- Identified 928 KB main bundle (54% over limit)
- Calculated user impact on slow connections

**Learnings:**
- Bundle size directly impacts user experience
- Code splitting is essential for large apps
- Lazy loading can reduce initial load by 70%+

## Resources

- React lazy/Suspense: https://react.dev/reference/react/lazy
- Vite Code Splitting: https://vitejs.dev/guide/features.html#code-splitting
- Lighthouse Scoring: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring

## Notes

**Estimated Effort:** 6-10 hours
- Route code splitting: 2-3 hours
- Manual chunks config: 1 hour
- Chart lazy loading: 2-3 hours
- Testing + validation: 2-3 hours

**Risk Level:** Low
- Code splitting is well-supported by React/Vite
- Easy to test (just navigate to each route)
- Rollback: Remove `lazy()` calls

**Urgency:** HIGH
- Directly impacts user acquisition (bounce rate)
- Critical for mobile users (majority of traffic)
- Should be fixed before marketing push

**Success Metric:** Lighthouse performance score > 90
