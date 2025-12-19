# E2E UI Enablement Plan (Un-skip Missing-UI Tests)

**Created**: 2025-12-18
**Goal**: Build the missing UI (routes/components/controls) so currently-skipped Playwright E2E tests can be enabled and reliably pass.

## Progress Log

- **2025-12-19**: **Watchlists** enabled + passing (`e2e/watchlist.spec.ts`: 11 passed)
- **2025-12-19**: **Admin** enabled + passing (`e2e/admin.spec.ts`: 21 passed)
- **2025-12-19**: **Price Alerts** enabled + passing (`e2e/price-alerts.spec.ts`: 11 passed, 3 skipped)
- **2025-12-19**: **Notifications** enabled + passing (`e2e/notifications.spec.ts`: 14 passed)
- **2025-12-19**: **Price Analytics** enabled + passing (`e2e/price-analytics.spec.ts`: 10 passed)
- **2025-12-19**: **Advanced Search** enabled + passing (`e2e/advanced-search.spec.ts`: 12 passed)
- **2025-12-19**: **Full E2E suite** green (115 passed, 0 failed)

## Principles

- **Test-driven UI**: Each work item below is tied to one or more skipped E2E tests (file + test name).
- **Minimal UX scope**: Implement only what the tests require (routes, controls, basic states). No extra flows.
- **Reuse existing building blocks**: Prefer existing pages/components already in `client/` (several alert/analytics components exist but aren’t routed).
- **Stable selectors**: Add/standardize `data-testid` and accessible names to match how E2E locates UI.
- **Security parity**: All mutations must use the existing CSRF + `apiRequest()` patterns.

---

## Inventory: Skipped E2E Areas → Missing UI

### A) Price Alerts: Dedicated Alerts Management UI

**Status**: ✅ Completed (2025-12-19)

**Source tests**: `e2e/price-alerts.spec.ts`
- `describe('View Price Alerts')` — requires `/alerts` route (currently present in spec; will fail until implemented)
- `describe('Edit Price Alert')` — requires edit UI on `/alerts` (currently present in spec; will fail until implemented)
- `describe('Delete Price Alert')` — requires delete UI on `/alerts` (currently present in spec; will fail until implemented)
- `describe.skip('Alert Notifications')` — requires triggered/active status visibility
- `describe.skip('Alert Limits')` — optional (depends on having a list view or an API count)

**Notes**
- `test.skip('should require product selection')` is intentionally skipped in the spec because the alert modal binds to the current product context.

**What to build (minimum to un-skip)**
1) **Route**: `/alerts`
2) **Page layout**:
   - Heading containing “Alerts” (or similar)
   - List of the user’s alerts (calls `GET /api/price-alerts`)
   - Empty state text matching `/no.*alerts|create.*first.*alert|no.*price.*alerts/i`
3) **Alert row/card fields**:
   - Product name visible (e.g. “Gaming Laptop” from the seeded product)
   - Target price visible (e.g. `$999.99`)
   - Status text visible (one of: `active|watching|monitoring|triggered`)
4) **Edit flow**:
   - An “Edit” affordance that matches at least one selector:
     - `button:has-text("Edit")` or `[data-testid="edit-alert"]` or `a:has-text("Edit")`
   - Form field: `input[name="targetPrice"]`
   - Submit button matches `Save` or `Update`
   - Success message matches `/alert.*updated|successfully.*updated/i`
   - Calls `PATCH /api/price-alerts/:id`
5) **Delete flow**:
   - Delete control matches at least one selector:
     - `button:has-text("Delete")` or `[data-testid="delete-alert"]` or `button[aria-label*="Delete"]`
   - Optional confirm dialog (tests accept either), but if you add it, include text matching:
     - `/are you sure|confirm.*deletion|delete.*alert/i`
   - Success message matches `/alert.*deleted|successfully.*deleted/i`
   - Calls `DELETE /api/price-alerts/:id`

**Acceptance criteria**
- Pass all `/alerts`-dependent tests in `e2e/price-alerts.spec.ts`, then consider un-skipping `Alert Notifications` / `Alert Limits` if in-scope.

**Validation**
```bash
npm run test:e2e -- e2e/price-alerts.spec.ts
```

---

### B) Price History & Analytics: Missing Widgets/Controls on Price History Page

**Status**: ✅ Completed (2025-12-19)

**Source tests**: `e2e/price-analytics.spec.ts`
- Conditional `test.skip()` triggers indicate missing UI elements.

**What to build/standardize (minimum to un-skip)**
1) **Chart presence**
   - Ensure price history view renders a chart element discoverable by either:
     - `[data-testid="price-chart"]` **or** a Recharts wrapper (`[class*="recharts-wrapper"]`)
2) **Historical Facts (labels)**
   - A section containing text matching `historical facts`.
   - Rows for “Lowest Price” and “Highest Price” each containing a `$...` price string.
3) **Time range selector**
   - Either:
     - Buttons with names matching `/7\s*days|30\s*days|90\s*days/i`, **or**
     - A select input labeled like `/time.*range|period|range/i`.
4) **Volatility widget**
   - Provide one of the test IDs:
     - `[data-testid="volatility-score"]` or `[data-testid="price-volatility"]`
   - Display a numeric score (0–100) and a level (low/moderate/high…).
5) **Price change indicator**
   - Display a percentage string matching `/[+-]?[0-9]+\.?[0-9]*%/i`.
6) **Retailer comparison**
   - Provide one of the test IDs:
     - `[data-testid="retailer-comparison"]` or `[data-testid="retailer-prices"]`
   - Render per-retailer entries (`retailerName`, `price`) and a “Best Deal” badge on the cheapest.
7) **Trend indicator**
   - Provide `[data-testid="price-trend"]` or `[data-testid="trend-indicator"]` (or the text fallback used in the test).

**Acceptance criteria**
- `e2e/price-analytics.spec.ts` runs with 0 skips (unless a test is explicitly deemed out-of-scope).

**Validation**
```bash
npm run test:e2e -- e2e/price-analytics.spec.ts
```

**Notes**
- Visual suite `e2e/price-analytics.visual.spec.ts` is separate; once the above is stable, generate baselines and run `npm run test:e2e:visual`.

---

### C) Notifications: Preferences Page + “Mark all as read” + Filtering UI

**Status**: ✅ Completed (2025-12-19)

**Source tests**: `e2e/notifications.spec.ts`
- Conditional `test.skip()` indicates missing controls/routes.

**What to build (minimum to un-skip)**
1) **Notifications page tab system** (`/notifications`)
   - Heading “Notifications”
   - Tabs: “Smart Alerts” and “General” (role=tab)
   - Lists with accessible names:
     - `role=list` name contains `general notifications` and `smart` equivalent
2) **Mark all as read**
   - Button: role=button name matches `/mark all as read/i`.
3) **Notification preferences UI**
   - Route: `/settings/notifications`
   - Include labeled controls matching E2E lookups:
     - Toggle labeled `/enable price drop notifications/i`
     - Toggle labeled `/email notification/i`
     - Numeric input labeled `/maximum.*per day|max.*daily/i`
   - Save button named “Save”
   - Success toast/text matching `/preference.*updated|saved/i`
4) **Discoverability**
   - From `/notifications`, include a visible link or button with name containing `preference` or `setting` (tests accept either), OR ensure `/settings/notifications` works directly.

**Acceptance criteria**
- `e2e/notifications.spec.ts` runs with 0 skips (except the explicitly “future WebSocket” placeholder helper, which is not a test).

**Validation**
```bash
npm run test:e2e -- e2e/notifications.spec.ts
```

---

### D) Watchlists: Bulk Add + Public Sharing

**Status**: ✅ Completed (2025-12-19)

**Source tests**: `e2e/watchlist.spec.ts`
- Formerly skipped tests are now enabled.

**What to build (minimum to un-skip)**
1) **Bulk add products to watchlist from listings**
   - On `/shop` (or the canonical listing page), add:
     - Per-product checkbox selectors that follow the established pattern:
       - `[data-testid^="product-checkbox-"]`
     - A bulk action button named “Add to Watchlist” (or similar)
     - A destination watchlist selector (modal or menu)
     - A confirm button
   - Verify E2E flow described in the skipped test comment.
2) **Public watchlist sharing**
   - In watchlist settings:
     - Toggle “Make Public”
     - Show a shareable link
   - Provide a public route that renders the watchlist contents unauthenticated.

**Acceptance criteria**
- ✅ `e2e/watchlist.spec.ts` passes (11/11)

**Validation**
```bash
npm run test:e2e -- e2e/watchlist.spec.ts
```

---

### E) Admin: Charts + UI CRUD for Retailers/Products + Monitoring + User Modal

**Status**: ✅ Completed (2025-12-19)

**Source tests**: `e2e/admin.spec.ts`
- Formerly skipped tests are now enabled.

**What to build (minimum to un-skip)**
1) **User growth chart** on `/admin` (can be a simple chart component bound to existing analytics endpoints).
2) **Retailer create form** on `/admin/retailers`
   - “Add Retailer” button
   - Form fields: name, website, logoUrl, isActive
   - Uses `POST /api/admin/retailers`
3) **Product edit UI** (either in-place or dedicated admin product page)
   - “Edit Product” button
   - Fields for description + category
   - Uses `PUT /api/admin/products/:id`
4) **Product delete UI**
   - Delete button + confirm dialog
   - Uses `DELETE /api/admin/products/:id`
5) **Monitoring dashboard UI**
   - A page/section that calls existing performance endpoints and renders:
     - `/api/admin/performance/stats`
     - `/api/admin/performance/slowest`
6) **User details modal** on `/admin/users`
   - Click a row opens a modal
   - Displays user info + actions

**Acceptance criteria**
- ✅ `e2e/admin.spec.ts` passes (21/21)

**Validation**
```bash
npm run test:e2e -- e2e/admin.spec.ts
```

---

### F) Product Discovery: Remove from Watchlist on Product Detail (Optional)

**Source test**: `e2e/product-discovery.spec.ts`
- `test.skip('should remove product from watchlist')` — explicitly noted as not implemented via product detail page.

**Decision point**
- Either implement “Remove/Unwatch” on product detail, **or** keep this test skipped permanently and treat removal as a watchlists-only feature.

---

## Audit: Remaining Skips / Conditional Skips (2025-12-19)

- `e2e/price-alerts.spec.ts`: `describe.skip('Alert Notifications')`, `describe.skip('Alert Limits')`, and one intentional `test.skip('should require product selection')`.
- `e2e/price-analytics.spec.ts`: ✅ passing (10/10); keep `e2e/price-analytics.visual.spec.ts` separate.
- `e2e/advanced-search.spec.ts`: ✅ passing (12/12).
- `e2e/product-discovery.spec.ts`: `test.skip('should remove product from watchlist')` (decision point in section F).
- `e2e/price-analytics.visual.spec.ts`: currently contains `test.skip()` placeholders until baselines are ready.

---

## Suggested Implementation Order (Fastest to Reduce Skips)

1) Optional: product detail “remove from watchlist” (section F)
2) Visual baselines (`e2e/price-analytics.visual.spec.ts`)
3) Optional: implement alert notifications/limits UX (`e2e/price-alerts.spec.ts` skipped describes)

## How to Validate

```bash
npm run test:e2e
npm run test:e2e:full
npm run test:e2e:visual
npm run test:e2e:debug-specs
```

When implementing each epic, temporarily un-skip only the relevant block to keep feedback fast, then re-run full default E2E at the end.
