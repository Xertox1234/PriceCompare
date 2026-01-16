# TODO 231: Unimplemented UI Elements - Comprehensive Tracking

**Priority**: P2 (Medium) - User experience gaps  
**Complexity**: Varies by feature (see estimates below)  
**Pattern References**:
- `docs/05_FRONTEND_PATTERNS.md` - React component patterns
- `docs/08_TESTING_PATTERNS.md` - E2E test patterns
- `docs/COMPONENT_GUIDE.md` - UI component architecture

## Problem Statement

E2E tests reveal **16 unimplemented UI elements** across 6 feature areas. These cause tests to conditionally skip with documented justifications. All features have backend support but lack frontend implementation.

**Impact**: Incomplete user experience, tests cannot validate full feature set

---

## 1. Price Analytics UI (7 items)

### 1.1 Time Range Selector
- **E2E Test**: [price-analytics.spec.ts#L227](e2e/price-analytics.spec.ts#L227)
- **Skip Reason**: "Time range selector not implemented"
- **Required Elements**:
  - Button group or dropdown for 7d/30d/90d selection
  - `data-testid="time-range-selector"` or `getByRole('button', { name: /7\s*days|30\s*days|90\s*days/i })`
- **Backend Ready**: ✅ Price history endpoint accepts date range params
- **Estimate**: 30 minutes

### 1.2 Price Labels on Chart
- **E2E Test**: [price-analytics.spec.ts#L195](e2e/price-analytics.spec.ts#L195)
- **Skip Reason**: "Price labels not implemented in any form"
- **Required Elements**:
  - Min/max price labels near chart
  - `data-testid="price-stats"` or labels showing `$X.XX` format
- **Backend Ready**: ✅ Min/max calculated in analytics endpoint
- **Estimate**: 20 minutes

### 1.3 Volatility Score Display
- **E2E Test**: [price-analytics.spec.ts#L282](e2e/price-analytics.spec.ts#L282)
- **Skip Reason**: "Volatility feature not implemented"
- **Required Elements**:
  - `data-testid="volatility-score"` or `data-testid="price-volatility"`
  - Score (0-100) with level indicator (low/moderate/high)
- **Backend Ready**: ✅ `PriceVolatilityScore` component exists but may not be rendered
- **Estimate**: 15 minutes (wire up existing component)

### 1.4 Price Change Percentage Indicator
- **E2E Test**: [price-analytics.spec.ts#L313](e2e/price-analytics.spec.ts#L313)
- **Skip Reason**: "Price change indicator not implemented"
- **Required Elements**:
  - Text showing `+X.X%` or `-X.X%` change
  - Color coding (green/red) for up/down
- **Backend Ready**: ✅ Price change calculated server-side
- **Estimate**: 20 minutes

### 1.5 Cross-Retailer Price Comparison
- **E2E Tests**: [price-analytics.spec.ts#L335](e2e/price-analytics.spec.ts#L335), [#L350](e2e/price-analytics.spec.ts#L350), [#L384](e2e/price-analytics.spec.ts#L384)
- **Skip Reason**: "Retailer comparison not implemented"
- **Required Elements**:
  - `data-testid="retailer-comparison"` or `data-testid="retailer-prices"`
  - List of retailers with current prices
- **Backend Ready**: ✅ Multi-retailer offers endpoint exists
- **Estimate**: 45 minutes

### 1.6 Best Deal Badge
- **E2E Test**: [price-analytics.spec.ts#L402](e2e/price-analytics.spec.ts#L402)
- **Skip Reason**: "Best deal badge not implemented"
- **Required Elements**:
  - Badge/chip on cheapest retailer card
  - Visual indicator (e.g., "Best Price" label)
- **Backend Ready**: ✅ Can derive from price comparison
- **Estimate**: 15 minutes

### 1.7 Price Trend Indicator
- **E2E Test**: [price-analytics.spec.ts#L519](e2e/price-analytics.spec.ts#L519)
- **Skip Reason**: "Trend indicator not implemented"
- **Required Elements**:
  - Arrow icon (↑/↓) or trend line
  - Text label (e.g., "Trending Down")
- **Backend Ready**: ✅ Trend data in analytics response
- **Estimate**: 20 minutes

**Subtotal - Price Analytics**: ~2.75 hours

---

## 2. Notification System UI (4 items)

### 2.1 Mark All as Read Button
- **E2E Test**: [notifications.spec.ts#L328](e2e/notifications.spec.ts#L328)
- **Skip Reason**: "Skip test if UI not implemented"
- **Required Elements**:
  - `getByRole('button', { name: /mark all as read/i })`
  - Accessible in menu or directly visible
- **Backend Ready**: ✅ Bulk update endpoint exists
- **Estimate**: 20 minutes

### 2.2 Notification Type Filtering
- **E2E Test**: [notifications.spec.ts#L393](e2e/notifications.spec.ts#L393)
- **Skip Reason**: "Skip if filtering UI not implemented"
- **Required Elements**:
  - Filter dropdown or tabs for notification types
  - Smart Alerts / General tabs exist but may need refinement
- **Backend Ready**: ✅ Type filter param supported
- **Estimate**: 30 minutes

### 2.3 Notification Preferences Page
- **E2E Tests**: [notifications.spec.ts#L492](e2e/notifications.spec.ts#L492), [#L524](e2e/notifications.spec.ts#L524), [#L597](e2e/notifications.spec.ts#L597)
- **Skip Reason**: "Preferences UI may not be on this page"
- **Required Elements**:
  - `/settings/notifications` route
  - Toggle switches for price drop, email, push notifications
  - Max daily notifications input
  - Save button with success toast
- **Backend Ready**: ✅ `notification_preferences` table exists
- **Estimate**: 1 hour

### 2.4 Frequency Settings Control
- **E2E Test**: [notifications.spec.ts#L597](e2e/notifications.spec.ts#L597)
- **Skip Reason**: "Skip if UI not implemented"
- **Required Elements**:
  - `getByLabel(/maximum.*per day|max.*daily/i)`
  - Numeric input for daily limit
- **Backend Ready**: ✅ Preference schema supports frequency
- **Estimate**: 15 minutes

**Subtotal - Notifications**: ~2 hours

---

## 3. Watchlist Features (2 items)

### 3.1 Bulk Add Products to Watchlist
- **E2E Test**: [watchlist.spec.ts#L316](e2e/watchlist.spec.ts#L316)
- **Skip Reason**: "Bulk add feature not implemented - product checkboxes not found in UI"
- **Required Elements**:
  - `data-testid="product-checkbox-{id}"` on shop listing page
  - `data-testid="bulk-add-to-watchlist"` action button
  - Modal for selecting destination watchlist
- **Backend Ready**: ✅ Batch add endpoint exists
- **Estimate**: 1.5 hours

### 3.2 Watchlist Sharing
- **E2E Test**: [watchlist.spec.ts#L433](e2e/watchlist.spec.ts#L433)
- **Skip Reason**: "TODO: Watchlist sharing feature not implemented"
- **Required Elements**:
  - Share button on watchlist tab
  - Share dialog with email input
  - Permission selector (view/edit)
  - `watch_list_shares` table integration
- **Backend Ready**: ✅ Schema exists (`watch_list_shares` table)
- **Estimate**: 2 hours

**Subtotal - Watchlist**: ~3.5 hours

---

## 4. Product Discovery (1 item)

### 4.1 Watchlist Button Authentication Guard
- **E2E Test**: [product-discovery.spec.ts#L297](e2e/product-discovery.spec.ts#L297)
- **Skip Reason**: "Watchlist button not found on product page"
- **Required Elements**:
  - `data-testid="add-to-watchlist"` button on product cards
  - Auth check before action (redirect to login or show modal)
- **Backend Ready**: ✅ Auth middleware exists
- **Estimate**: 30 minutes

**Subtotal - Product Discovery**: ~30 minutes

---

## 5. Product Detail Page (1 item)

### 5.1 Remove from Watchlist Button
- **E2E Test**: [product-detail.spec.ts#L266](e2e/product-detail.spec.ts#L266)
- **Skip Reason**: Test skips if add button not found
- **Required Elements**:
  - Toggle behavior: "Add to Watchlist" ↔ "Remove from Watchlist"
  - Visual state change when product is in watchlist
- **Backend Ready**: ✅ Delete endpoint exists
- **Estimate**: 30 minutes

**Subtotal - Product Detail**: ~30 minutes

---

## 6. Accessibility (1 item)

### 6.1 Toast Notification WCAG Compliance
- **E2E Test**: [accessibility.spec.ts#L138](e2e/accessibility.spec.ts#L138)
- **Skip Reason**: Test explicitly skipped for toast implementation
- **Required Elements**:
  - `role="alert"` or `aria-live="polite"` on toast container
  - Focus management for screen readers
  - Color contrast compliance (WCAG AA)
- **Backend Ready**: N/A (frontend-only)
- **Estimate**: 45 minutes

**Subtotal - Accessibility**: ~45 minutes

---

## Implementation Priority Order

| Priority | Feature | Estimate | Impact |
|----------|---------|----------|--------|
| 1 | Notification Preferences Page | 1 hr | High - core user setting |
| 2 | Price Analytics - Time Range | 30 min | High - essential for analysis |
| 3 | Watchlist Sharing | 2 hr | High - collaborative feature |
| 4 | Mark All as Read | 20 min | Medium - convenience |
| 5 | Bulk Add to Watchlist | 1.5 hr | Medium - power user feature |
| 6 | Cross-Retailer Comparison | 45 min | Medium - differentiating feature |
| 7 | Volatility Score Display | 15 min | Low - component exists |
| 8 | Price Labels | 20 min | Low - enhancement |
| 9 | Best Deal Badge | 15 min | Low - enhancement |
| 10 | Price Change Indicator | 20 min | Low - enhancement |
| 11 | Price Trend Indicator | 20 min | Low - enhancement |
| 12 | Notification Filtering | 30 min | Low - tabs exist |
| 13 | Frequency Settings | 15 min | Low - part of preferences |
| 14 | Watchlist Auth Guard | 30 min | Low - defensive UX |
| 15 | Remove from Watchlist | 30 min | Low - inverse of add |
| 16 | Toast WCAG Compliance | 45 min | Low - accessibility polish |

---

## Total Estimates

| Category | Time |
|----------|------|
| Price Analytics UI | 2.75 hours |
| Notification System UI | 2 hours |
| Watchlist Features | 3.5 hours |
| Product Discovery | 0.5 hours |
| Product Detail Page | 0.5 hours |
| Accessibility | 0.75 hours |
| **TOTAL** | **~10 hours** |

---

## Acceptance Criteria

### Per-Feature
- [ ] UI element visible and functional
- [ ] E2E test passes (remove `test.skip()`)
- [ ] TypeScript strict mode compliance
- [ ] Mobile responsive (test at 375px width)

### Global
- [ ] All 16 E2E tests pass without skip
- [ ] No new console errors in browser
- [ ] Lighthouse accessibility score maintained (90+)

---

## Implementation Notes

### Component Patterns to Follow
From `docs/05_FRONTEND_PATTERNS.md`:
- Use `@/components/ui/` primitives (Button, Badge, Switch, etc.)
- Optimistic updates with React Query `useMutation`
- Error boundaries for graceful degradation
- `data-testid` attributes for all interactive elements

### Testing Requirements
From `docs/08_TESTING_PATTERNS.md`:
- Remove `test.skip()` after implementation
- Add visual regression test if UI-heavy
- Test loading states and error states
- Verify mobile touch targets (44x44px minimum)

---

## Revision History
- 2026-01-15: Created from E2E test analysis (16 unimplemented UI elements)
