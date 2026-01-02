# Price History Feature - Quick Reference Index

**Quick Links:** [Roadmap](./PRICE_HISTORY_ROADMAP.md) | [Architecture](#architecture) | [Current Status](#current-status)

---

## Current Implementation (Completed)

✅ **Core Features**
- Price history database table with indexes
- Automated price snapshots (twice daily)
- Interactive price history charts
- Price trend analysis
- Best time to buy recommendations
- API endpoints for all data
- Comprehensive test coverage (22 tests)

**Files Completed:**
```
✅ migrations/0004_add_price_history.sql
✅ shared/schema.ts (priceHistory table)
✅ server/services/price-snapshot-service.ts
✅ server/jobs/price-snapshot-queue.ts
✅ server/storage.ts (price history methods)
✅ server/routes.ts (3 new endpoints)
✅ client/src/components/price-history/PriceHistoryChart.tsx
✅ client/src/components/price-history/PriceTrendIndicator.tsx
✅ client/src/components/price-history/BestTimeToBuy.tsx
✅ client/src/components/price-history/TimeRangeSelector.tsx
✅ client/src/components/product-detail-dialog.tsx
✅ + 4 test files
```

---

## Next Priority Features (Week 1)

### 1. Price Drop Alerts Integration
**Start Here:** Phase 1.1 in [Roadmap](./PRICE_HISTORY_ROADMAP.md#11-price-drop-alerts-integration--priority)

**Quick Start:**
```bash
# Files to create:
1. server/services/price-alert-service.ts
2. client/src/components/price-history/PriceAlertButton.tsx
3. Update: client/src/components/price-history/PriceHistoryChart.tsx

# Pattern reference:
See: /server/storage.ts lines 600-650
See: /shared/schema.ts lines 162-170
```

### 2. Chart Enhancements
**Start Here:** Phase 1.2 in [Roadmap](./PRICE_HISTORY_ROADMAP.md#12-chart-enhancements)

**Quick Start:**
```bash
# Install dependencies:
npm install recharts@latest --legacy-peer-deps  # Already done!

# Files to update:
1. client/src/components/price-history/PriceHistoryChart.tsx (add Brush)
2. client/src/components/price-history/ChartAnnotations.tsx (new)
```

### 3. Export & Share
**Start Here:** Phase 1.3 in [Roadmap](./PRICE_HISTORY_ROADMAP.md#13-export--share-functionality)

**Quick Start:**
```bash
# Install dependencies:
npm install html2canvas file-saver
npm install -D @types/file-saver

# Files to create:
1. client/src/components/price-history/ChartExport.tsx
2. client/src/hooks/useChartExport.ts
```

---

## Architecture

### Data Flow

```
┌─────────────────┐
│  Product Offers │ (Current prices)
└────────┬────────┘
         │ Snapshot (2x daily)
         ↓
┌─────────────────┐
│  Price History  │ (Historical data)
└────────┬────────┘
         │ API Fetch
         ↓
┌─────────────────┐
│  Frontend Chart │ (Visualization)
└─────────────────┘
```

### Key Endpoints

```typescript
// Price History
GET  /api/products/:id/price-history?days=30
GET  /api/products/:id/price-trend
GET  /api/products/:id/best-time-to-buy

// Coming Soon (Phase 1)
POST /api/products/:id/alerts/from-history
GET  /api/products/:id/alert-suggestions

// Coming Soon (Phase 2)
GET  /api/products/:id/price-predictions
GET  /api/products/:id/seasonal-insights
GET  /api/retailers/:id/reliability-score
```

### Component Hierarchy

```
ProductCard
  └─ ProductDetailDialog
      ├─ Tabs
      │   ├─ [Price History]
      │   │   ├─ TimeRangeSelector
      │   │   ├─ PriceTrendIndicator
      │   │   └─ PriceHistoryChart
      │   │       └─ [Retailer toggles]
      │   │
      │   └─ [Buy Analysis]
      │       ├─ BestTimeToBuy
      │       └─ Current Offers List
```

---

## Testing

### Run Tests

```bash
# All price history tests
npm test -- client/src/components/price-history/__tests__

# Specific component
npm test -- PriceHistoryChart.test.tsx

# Backend tests
npm test -- server/__tests__/price-snapshot-service.test.ts

# Coverage report
npm run test:coverage
```

### Test Results (Current)
```
✅ 22/22 tests passing
✅ 100% pass rate
✅ Coverage: Components, Services, Edge Cases
```

---

## Database Schema

### Price History Table

```sql
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  product_offer_id INTEGER REFERENCES product_offers(id),
  product_id INTEGER NOT NULL,     -- Denormalized
  retailer_id INTEGER NOT NULL,    -- Denormalized
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  availability TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER,
  recorded_at TIMESTAMP NOT NULL,  -- When snapshot taken
  created_at TIMESTAMP DEFAULT NOW()
);

-- Optimized indexes
CREATE INDEX idx_price_history_product_id ON price_history (product_id, recorded_at DESC);
CREATE INDEX idx_price_history_product_retailer_time ON price_history (product_id, retailer_id, recorded_at DESC);
```

### Storage Estimates

```
Current: ~0 MB (no historical data yet)
After 30 days: ~15 MB (500 products × 3 retailers × 60 snapshots)
After 1 year: ~109 MB (500 products × 3 retailers × 730 snapshots)
```

---

## Development Workflow

### Starting a New Feature

```bash
# 1. Check the roadmap
cat docs/PRICE_HISTORY_ROADMAP.md

# 2. Create feature branch
git checkout -b feature/price-history-alerts

# 3. Implement files (see roadmap for locations)
# ...

# 4. Write tests
# Pattern: For every component/service, create matching test file

# 5. Run tests
npm test

# 6. Commit with descriptive message
git commit -m "feat: Add price drop alerts from chart"

# 7. Push and create PR
git push -u origin feature/price-history-alerts
```

### Code Patterns to Follow

**Backend Service Pattern:**
```typescript
// server/services/new-service.ts
export class NewService {
  async performOperation(param: Type): Promise<Result> {
    try {
      // Implementation
      console.log(`[NewService] Operation started`);
      const result = await doWork(param);
      console.log(`[NewService] Operation completed`);
      return result;
    } catch (error) {
      console.error('[NewService] Error:', error);
      throw error;
    }
  }
}

export const newService = new NewService();
```

**Frontend Component Pattern:**
```typescript
// client/src/components/price-history/NewComponent.tsx
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface NewComponentProps {
  data: DataType | null;
  isLoading?: boolean;
}

export function NewComponent({ data, isLoading }: NewComponentProps) {
  if (isLoading) {
    return <Card><Skeleton className="h-24 w-full" /></Card>;
  }

  if (!data) {
    return <Card><div>No data available</div></Card>;
  }

  return (
    <Card className="p-4">
      {/* Component content */}
    </Card>
  );
}
```

**Test Pattern:**
```typescript
// __tests__/NewComponent.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { NewComponent } from '../NewComponent';

describe('NewComponent', () => {
  it('should render loading state', () => {
    render(<NewComponent data={null} isLoading={true} />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('should render empty state', () => {
    render(<NewComponent data={null} isLoading={false} />);
    expect(screen.getByText(/no data available/i)).toBeInTheDocument();
  });

  it('should render with data', () => {
    const mockData = { /* ... */ };
    render(<NewComponent data={mockData} isLoading={false} />);
    // Assertions...
  });
});
```

---

## Troubleshooting

### Common Issues

**1. Chart not rendering**
```typescript
// Issue: Recharts needs dimensions
// Solution: Ensure parent has height
<div className="h-[400px]">
  <ResponsiveContainer width="100%" height="100%">
    <LineChart>...</LineChart>
  </ResponsiveContainer>
</div>
```

**2. Date formatting issues**
```typescript
// Use date-fns for consistency
import { format } from 'date-fns';

format(new Date(dateString), 'MMM d, yyyy')
```

**3. Test failures in JSDOM**
```typescript
// Recharts rendering requires real DOM
// Test component logic, not chart rendering
// See: client/src/components/price-history/__tests__/PriceHistoryChart.test.tsx
```

**4. Price snapshot not running**
```bash
# Check Bull queue status
# Verify REDIS_URL is set
# Check logs: server/index.ts lines 202-213
```

---

## Performance Checklist

Before deploying new features:

- [ ] Database queries use proper indexes
- [ ] API responses cached where appropriate
- [ ] Frontend data memoized (useMemo, useCallback)
- [ ] Large datasets paginated or aggregated
- [ ] Images/assets optimized
- [ ] Bundle size impact < 50KB
- [ ] Page load time increase < 100ms
- [ ] Lighthouse score > 90

---

## Useful Commands

```bash
# Development
npm run dev                    # Start dev server
npm run check                  # TypeScript check
npm test                       # Run all tests
npm run test:watch             # Watch mode
npm run test:coverage          # Coverage report

# Database
npm run db:push                # Push schema changes
npm run migrate                # Run migrations
psql $DATABASE_URL             # Connect to DB

# Production Build
npm run build                  # Build for production
npm start                      # Start production server

# Price History Specific
npm test -- price-history      # Run only price history tests
grep -r "PriceHistory" client/ # Find all usages
```

---

## Quick Reference: Phase Priorities

```
🔴 PHASE 1 (Weeks 1-2): Foundation & Quick Wins
   → Start here for immediate value
   → Low risk, high impact
   → Files: ~8 new, ~3 modified

🟡 PHASE 2 (Weeks 3-5): Intelligence & Predictions
   → ML integration (table exists!)
   → Seasonal analysis
   → Files: ~6 new, ~4 modified

🟢 PHASE 3 (Weeks 6-8): User Engagement
   → Price watch dashboard
   → Community features
   → Files: ~12 new, ~5 modified

⚪ PHASE 4 (Weeks 9-12): Advanced & Polish
   → Performance optimizations
   → Browser extension
   → Files: ~8 new, ~6 modified
```

---

## Links & Resources

- **Main Roadmap:** [PRICE_HISTORY_ROADMAP.md](./PRICE_HISTORY_ROADMAP.md)
- **Recharts Docs:** https://recharts.org/
- **React Query:** https://tanstack.com/query/latest
- **Vitest:** https://vitest.dev/
- **Component Library:** Shadcn/ui (already integrated)

---

**Last Updated:** 2025-11-11
**Maintainer:** Development Team
**Status:** ✅ Ready for Phase 1 implementation
