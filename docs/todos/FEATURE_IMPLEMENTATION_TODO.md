# Feature Implementation TODO List

**Last Updated:** 2026-01-06
**Source:** Phase 2.4 E2E Tests + Codebase Audit
**Total Items:** 7 features

---

## Priority Legend

- 🔴 **High Priority** - Core user experience features
- 🟡 **Medium Priority** - Important for completeness
- 🟢 **Low Priority** - Nice-to-have enhancements

---

## 🔴 HIGH PRIORITY FEATURES

### 1. Watchlist Integration on Product Detail Page

**Status:** ❌ Not Implemented
**Priority:** 🔴 High
**Effort:** 3-4 hours
**Test Coverage:** 2 skipped E2E tests ready

**Problem:**
- "Add to Watchlist" button exists but modal interaction doesn't complete
- Clicking watchlist option in modal doesn't trigger add action
- No success toast displayed after selection
- Remove functionality also incomplete

**Implementation Checklist:**
- [ ] Fix modal overlay click blocking (currently prevents button clicks)
- [ ] Implement watchlist selection handler in product detail page
- [ ] Add product to selected watchlist via API call
- [ ] Display success toast notification
- [ ] Update button state to "In Watchlist" / "Remove from Watchlist"
- [ ] Implement remove from watchlist action
- [ ] Display remove confirmation modal
- [ ] Update UI after successful removal

**Files to Modify:**
- `client/src/pages/product-detail-new.tsx` (modal interaction logic)
- API integration with `/api/watchlists/:id/products`

**Test Coverage:**
- `e2e/product-detail.spec.ts:198` - Add to watchlist test (currently skipped)
- `e2e/product-detail.spec.ts:260` - Remove from watchlist test (currently skipped)

**Success Criteria:**
- [ ] Can add product to watchlist from product detail page
- [ ] Success toast displays after adding
- [ ] Can remove product from watchlist
- [ ] UI updates reflect current watchlist status
- [ ] 2 E2E tests pass (remove `.skip()`)

---

## 🟡 MEDIUM PRIORITY FEATURES

### 2. Product Image Gallery

**Status:** ⚠️ Partial (images exist but hidden)
**Priority:** 🟡 Medium
**Effort:** 2-3 hours
**Test Coverage:** 1 skipped E2E test ready

**Problem:**
- Product images exist in DOM but are hidden (CSS visibility issue)
- Likely lazy loading or CSS display:none preventing visibility
- Thumbnail navigation not visible/working

**Implementation Checklist:**
- [ ] Debug why images have `visibility: hidden` or `display: none`
- [ ] Fix lazy loading implementation (if that's the cause)
- [ ] Ensure main product image displays on page load
- [ ] Verify thumbnail gallery displays correctly
- [ ] Implement thumbnail click to change main image
- [ ] Add keyboard navigation (arrow keys)
- [ ] Test image loading performance

**Files to Investigate:**
- `client/src/pages/product-detail-new.tsx` (image display logic)
- CSS classes affecting image visibility
- Lazy loading implementation

**Test Coverage:**
- `e2e/product-detail.spec.ts:146` - Image gallery test (currently skipped)

**Success Criteria:**
- [ ] Main product image visible on page load
- [ ] Thumbnail gallery displays
- [ ] Clicking thumbnails changes main image
- [ ] Images load without visible delay
- [ ] 1 E2E test passes (remove `.skip()`)

---

### 3. Price Alert CTA on Product Detail

**Status:** ❌ Not Implemented
**Priority:** 🟡 Medium
**Effort:** 1-2 hours
**Test Coverage:** 1 skipped E2E test ready

**Problem:**
- No "Set Price Alert" button found on product detail page
- Price alert modal component exists (tested in Phase 1.2)
- Just needs integration/CTA on product detail

**Implementation Checklist:**
- [ ] Add "Set Price Alert" button/CTA to product detail page
- [ ] Position button near price information
- [ ] Implement click handler to open price alert modal
- [ ] Pre-fill modal with current product price
- [ ] Ensure modal uses existing `PriceAlertModal` component
- [ ] Handle authentication requirement (redirect to login if needed)
- [ ] Display success message after alert creation

**Files to Modify:**
- `client/src/pages/product-detail-new.tsx` (add CTA button)
- Integrate existing `PriceAlertModal` component

**Test Coverage:**
- `e2e/product-detail.spec.ts:432` - Price alert modal test (currently skipped)

**Success Criteria:**
- [ ] "Set Price Alert" button visible on product detail
- [ ] Clicking button opens price alert modal
- [ ] Modal pre-fills with product price
- [ ] User can create price alert
- [ ] 1 E2E test passes (remove `.skip()`)

---

## 🟢 LOW PRIORITY FEATURES

### 6. Price Alert Notifications & Limits

**Status:** ❌ Not Implemented
**Priority:** 🟢 Low
**Effort:** 4-6 hours
**Test Coverage:** Optional (mentioned in session notes)

**Problem:**
- Price alerts can be created but no notification system
- No limits on number of alerts per user
- No alert management/history view

**Implementation Checklist:**
- [ ] Design notification system for price drops
- [ ] Implement email notifications when price drops below threshold
- [ ] Add browser/push notifications option
- [ ] Create alert management page (`/price-alerts`)
- [ ] Display active alerts with current vs. target price
- [ ] Implement alert limits (e.g., 10 alerts per user)
- [ ] Add "delete alert" functionality
- [ ] Show alert history/triggered alerts
- [ ] Add notification preferences page

**Files to Create/Modify:**
- `server/services/price-alert-notification-service.ts` (new)
- `server/jobs/price-check-worker.ts` (background job)
- `client/src/pages/price-alerts-management.tsx` (new)
- Email templates for notifications

**Success Criteria:**
- [ ] Users receive notifications when price drops
- [ ] Alert limits enforced
- [ ] Users can manage their alerts
- [ ] Notification preferences configurable

---

### 4. Price Analytics Integration on Product Detail

**Status:** ❌ Not Visible on Product Detail
**Priority:** 🟢 Low
**Effort:** 1-2 hours
**Test Coverage:** 2 skipped E2E tests ready

**Problem:**
- Price analytics components exist and are tested (Phase 2.3)
- Components: `RetailerComparisonTable`, `PriceHistoryChart`, `BestDealBadge`
- Not integrated/visible on product detail page (`/product/:id`)

**Implementation Checklist:**
- [ ] Add retailer comparison section to product detail page
- [ ] Display `RetailerComparisonTable` component
- [ ] Show "Best Deal" badge on lowest price retailer
- [ ] Add collapsible price history section
- [ ] Display `PriceHistoryChart` component
- [ ] Add time range selector (7d, 30d, 90d, 1y)
- [ ] Ensure price data loads correctly
- [ ] Handle products with no price history gracefully

**Files to Modify:**
- `client/src/pages/product-detail-new.tsx` (add analytics sections)
- Reuse components from `client/src/components/price-analytics/`

**Test Coverage:**
- `e2e/product-detail.spec.ts:317` - Retailer comparison test (currently skipped)
- `e2e/product-detail.spec.ts:353` - Price history chart test (currently skipped)

**Success Criteria:**
- [ ] Retailer comparison table displays on product detail
- [ ] Best deal badge highlights cheapest retailer
- [ ] Price history chart displays
- [ ] User can select time ranges
- [ ] 2 E2E tests pass (remove `.skip()`)

**Note:** Components are already built and tested. This is pure integration work.

---

### 5. Related Products Display

**Status:** ❌ Not Implemented
**Priority:** 🟢 Low
**Effort:** 2-3 hours
**Test Coverage:** 1 skipped E2E test ready

**Problem:**
- No "Related Products" or "You May Also Like" section on product detail
- Need to fetch products from same category
- Display as product cards

**Implementation Checklist:**
- [ ] Add related products section to product detail page
- [ ] Fetch products from same category (exclude current product)
- [ ] Limit to 4-8 related products
- [ ] Reuse `ProductCard` component for display
- [ ] Add section header ("Related Products" / "You May Also Like")
- [ ] Handle case where no related products exist
- [ ] Add loading state during fetch
- [ ] Link to product detail pages

**Files to Modify:**
- `client/src/pages/product-detail-new.tsx` (add related products section)
- Create API endpoint or use existing `/api/products/search` with category filter

**Test Coverage:**
- `e2e/product-detail.spec.ts:396` - Related products test (currently skipped)

**Success Criteria:**
- [ ] Related products section displays
- [ ] Shows 4-8 products from same category
- [ ] Product cards are clickable
- [ ] Loading state displays during fetch
- [ ] 1 E2E test passes (remove `.skip()`)

---

## 🔵 OPTIONAL ENHANCEMENT FEATURES

### 7. Product Reviews & Ratings System

**Status:** ❌ Not Implemented
**Priority:** 🔵 Optional
**Effort:** 8-12 hours
**Test Coverage:** Future E2E tests needed

**Problem:**
- No user review/rating system exists
- Product detail shows mock rating data only
- Community engagement feature missing

**Implementation Checklist:**
- [ ] Create reviews database schema (users, products, ratings, text, timestamps)
- [ ] Build review submission form on product detail
- [ ] Implement rating system (1-5 stars)
- [ ] Add review moderation/reporting
- [ ] Display reviews with sorting (newest, highest rated, lowest rated)
- [ ] Implement review helpfulness voting (helpful/not helpful)
- [ ] Add pagination for reviews
- [ ] Calculate and display aggregate ratings
- [ ] Add review photos/images upload (optional)
- [ ] Implement verified purchase badges

**Files to Create:**
- `migrations/00XX_create_reviews_schema.sql`
- `shared/schema.ts` - Add reviews table
- `server/routes/review-routes.ts`
- `server/storage.ts` - Add review methods
- `client/src/components/reviews/` - Review components

**Success Criteria:**
- [ ] Users can submit reviews
- [ ] Reviews display on product detail page
- [ ] Rating system works (1-5 stars)
- [ ] Sorting and filtering functional
- [ ] Helpfulness voting works

---

### 8. Price History Export (CSV/PDF)

**Status:** ❌ Not Implemented
**Priority:** 🔵 Optional
**Effort:** 2-3 hours
**Test Coverage:** Can add to Phase 2.3

**Problem:**
- Users can view price history charts but can't export data
- No way to save historical price data offline

**Implementation Checklist:**
- [ ] Add "Export" button to price history chart
- [ ] Implement CSV export functionality
- [ ] Format data: Date, Price, Retailer, Change %
- [ ] Implement PDF export with chart screenshot
- [ ] Add export options dialog (format, date range)
- [ ] Handle large datasets (pagination/streaming)
- [ ] Add download progress indicator

**Files to Modify:**
- `client/src/components/price-history/PriceHistoryChart.tsx`
- `server/routes/product-routes.ts` (add export endpoint)
- CSV generation library (e.g., `csv-stringify`)
- PDF generation library (e.g., `pdfkit` or `puppeteer`)

**Success Criteria:**
- [ ] Users can export price history as CSV
- [ ] CSV contains all price data with proper formatting
- [ ] PDF export includes chart visualization
- [ ] Export works for different date ranges

---

### 9. Seasonal Pattern Detection

**Status:** ❌ Not Implemented
**Priority:** 🔵 Optional (Future ML Feature)
**Effort:** 12-20 hours
**Test Coverage:** Future E2E tests needed

**Problem:**
- Price history shows data but doesn't detect seasonal patterns
- No predictive insights for users (e.g., "Prices typically drop in November")

**Implementation Checklist:**
- [ ] Research seasonal pattern detection algorithms
- [ ] Collect sufficient historical data (minimum 1 year)
- [ ] Implement pattern detection service
- [ ] Identify seasonal trends (monthly, quarterly, yearly)
- [ ] Display insights on product detail ("Historically lowest in Q4")
- [ ] Add confidence scores for predictions
- [ ] Visualize patterns on chart (highlighted periods)
- [ ] Create background job for pattern analysis
- [ ] Cache pattern results for performance

**Files to Create:**
- `server/services/seasonal-pattern-service.ts`
- `server/jobs/pattern-analysis-worker.ts`
- `client/src/components/price-history/seasonal-insights.tsx`

**Success Criteria:**
- [ ] System detects seasonal price patterns
- [ ] Insights display on product detail
- [ ] Patterns visualized on chart
- [ ] Predictions have confidence scores

---

### 10. Price Prediction (ML Feature)

**Status:** ❌ Not Implemented
**Priority:** 🔵 Optional (Advanced ML Feature)
**Effort:** 20-40 hours
**Test Coverage:** Future E2E tests needed

**Problem:**
- Users can see historical prices but no future predictions
- No "smart" buy recommendations

**Implementation Checklist:**
- [ ] Research price prediction models (LSTM, ARIMA, Prophet)
- [ ] Collect training data (historical prices, seasonality, events)
- [ ] Train prediction model
- [ ] Implement prediction API endpoint
- [ ] Display predicted price range on product detail
- [ ] Show confidence intervals
- [ ] Add "Best time to buy" recommendation
- [ ] Implement model retraining pipeline
- [ ] Add A/B testing for prediction accuracy
- [ ] Monitor prediction vs. actual performance

**Files to Create:**
- `server/ml/price-prediction-model.py` (Python service)
- `server/services/price-prediction-service.ts` (API wrapper)
- `server/routes/prediction-routes.ts`
- `client/src/components/price-history/price-prediction.tsx`

**Technical Notes:**
- Likely requires Python microservice for ML
- Consider using TensorFlow.js for client-side predictions
- Needs significant historical data for training

**Success Criteria:**
- [ ] Model predicts future prices with >70% accuracy
- [ ] Predictions display with confidence intervals
- [ ] "Best time to buy" recommendation shown
- [ ] Model retrains monthly with new data

---

### 11. Chart Keyboard Navigation & Accessibility

**Status:** ⚠️ Partial (mouse-only navigation)
**Priority:** 🔵 Optional (Accessibility)
**Effort:** 3-4 hours
**Test Coverage:** Can add to Phase 2.3

**Problem:**
- Price history charts only navigable with mouse
- Not accessible for keyboard-only users
- Screen reader support limited

**Implementation Checklist:**
- [ ] Add keyboard navigation to Recharts
- [ ] Implement arrow keys for data point navigation
- [ ] Add Tab key support for chart elements
- [ ] Implement Enter/Space for selecting data points
- [ ] Add ARIA labels for all chart elements
- [ ] Test with screen readers (NVDA, JAWS, VoiceOver)
- [ ] Add keyboard shortcuts documentation
- [ ] Implement focus indicators
- [ ] Add skip links for chart data table alternative

**Files to Modify:**
- `client/src/components/price-history/PriceHistoryChart.tsx`
- Add keyboard event handlers
- Enhance ARIA attributes

**Success Criteria:**
- [ ] Chart navigable with keyboard only
- [ ] Screen readers announce chart data correctly
- [ ] Focus indicators visible
- [ ] WCAG 2.1 AA compliance achieved

---

## 📊 IMPLEMENTATION SUMMARY

### Quick Stats
- **Total Features:** 11 (6 core + 5 optional)
- **High Priority:** 1 (Watchlist Integration)
- **Medium Priority:** 2 (Image Gallery, Price Alert CTA)
- **Low Priority:** 3 (Price Analytics Integration, Related Products, Alert Notifications)
- **Optional Enhancements:** 5 (Reviews, Export, Seasonal Patterns, ML Prediction, Accessibility)

### Estimated Total Effort

**Core Features (6 items):**
- **High Priority:** 3-4 hours
- **Medium Priority:** 3-5 hours
- **Low Priority:** 5-12 hours
- **Subtotal:** 11-21 hours (1.5 - 3 days)

**Optional Enhancements (5 items):**
- **Quick Wins:** 5-7 hours (Export, Accessibility)
- **Advanced Features:** 40-72 hours (Reviews, Seasonal Detection, ML Prediction)
- **Subtotal:** 45-79 hours (6-10 days)

**Grand Total:** 56-100 hours (7-13 days for all features)

### Test Impact
- **Tests Currently Passing:** 3/10 (30%)
- **Tests After Implementation:** 10/10 (100%)
- **Total E2E Suite Impact:** 52 → 59 passing (+7)
- **Overall Pass Rate:** 88% → 100%

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Core User Experience (1 day)
1. **Watchlist Integration** (3-4 hours) - High user value
2. **Image Gallery Fix** (2-3 hours) - Core product viewing
3. **Price Alert CTA** (1-2 hours) - Completes user flow

**Outcome:** 6 E2E tests passing → 70% product detail coverage

### Phase 2: Enhanced Features (0.5 day)
4. **Price Analytics Integration** (1-2 hours) - Components exist, just integrate
5. **Related Products** (2-3 hours) - Discovery and engagement

**Outcome:** 9 E2E tests passing → 90% product detail coverage

---

## 📝 TECHNICAL NOTES

### Common Patterns

**Modal Overlay Fix (Watchlist):**
```typescript
// Wait for modal animations before clicking
await page.waitForTimeout(500);
await element.click({ force: true });
```

**Component Reuse (Price Analytics):**
```typescript
import { RetailerComparisonTable } from '@/components/price-analytics/retailer-comparison-table';
import { PriceHistoryChart } from '@/components/price-history/PriceHistoryChart';

// Components are already tested in Phase 2.3
<RetailerComparisonTable offers={product.offers} />
<PriceHistoryChart productId={product.id} />
```

**Authentication Check:**
```typescript
// Check if user is authenticated before showing watchlist/alert features
const { data: user } = useAuth();
if (!user) {
  // Show login prompt or disable button
}
```

### Files Reference

**Product Detail Page:**
- `client/src/pages/product-detail-new.tsx` - Main implementation file

**Existing Components to Reuse:**
- `client/src/components/price-analytics/` - All price analytics widgets
- `client/src/components/price-history/` - Charts and trend indicators
- `client/src/components/price-analytics/price-alert-modal.tsx` - Alert modal

**API Endpoints:**
- `/api/watchlists/:id/products` - Add/remove products
- `/api/price-alerts` - Create price alerts
- `/api/products/search?category=X` - Related products

---

## 🧪 TESTING STRATEGY

### Development Testing
1. **Manual Testing:** Verify each feature works in browser
2. **E2E Tests:** Remove `.skip()` and verify tests pass
3. **Visual Regression:** Update baselines if UI changes

### Definition of Done for Each Feature
- [ ] Feature works in manual testing
- [ ] E2E test(s) pass
- [ ] No ESLint errors/warnings
- [ ] TypeScript strict mode passes
- [ ] Code follows existing patterns
- [ ] Success/error states handled
- [ ] Loading states implemented
- [ ] Authentication handled correctly

---

## 🔗 REFERENCES

- **Phase 2.4 Summary:** `e2e/PHASE_2_4_PRODUCT_DETAIL_TESTS_SUMMARY.md`
- **Test File:** `e2e/product-detail.spec.ts`
- **Pattern Documentation:** `docs/08_TESTING_PATTERNS.md`
- **Component Guide:** `docs/COMPONENT_GUIDE.md`

---

## ✅ PROGRESS TRACKING

Update this section as features are completed:

- [ ] 1. Watchlist Integration on Product Detail
- [ ] 2. Product Image Gallery Fix
- [ ] 3. Price Alert CTA on Product Detail
- [ ] 4. Price Analytics Integration on Product Detail
- [ ] 5. Related Products Display

**Last Updated:** 2026-01-06
**Next Review:** After completing Phase 1 features
