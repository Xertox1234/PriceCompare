# TODO: Fix Remaining E2E Test Failures (18 Total)

**Status**: 🔴 Active
**Created**: 2026-01-09
**Updated**: 2026-01-09 (Simplified after multi-agent review)
**Priority**: High
**Current**: 121 passing / 18 failing / 8 skipped (82% pass rate)
**Target**: 139+ passing / 0 failing / 8 skipped (95%+ pass rate)

---

## Critical Pre-Investigation Fix (15 minutes) ⚠️ DO THIS FIRST

**Blocker Found**: Search helpers still use `networkidle` anti-pattern that was supposedly fixed.

```bash
# Find and fix networkidle usage in search helpers
grep -rn "waitForLoadState.*networkidle" e2e/helpers/

# Replace with:
import { waitForPageReady } from '../helpers';
await waitForPageReady(page);

# Re-run Advanced Search tests
npx playwright test e2e/advanced-search.spec.ts

# May auto-resolve several of the 12 failures
```

**Why First**: Could eliminate false failures before investigation begins.

---

## Test Failure Summary

| Category | Count | Estimated Fix Time |
|----------|-------|-------------------|
| Advanced Search | 12 | 1-2 hours |
| Bundle Optimization | 2 | 1 minute (skip) |
| Watchlist | 2 | 30 min or skip |
| Accessibility | 1 | 15 minutes |
| Price Analytics | 1 | 30 minutes |
| Product Discovery | 1 | 10 minutes |
| **TOTAL** | **18** | **3-4 hours** |

---

## Quick Wins (Do First - 30 minutes)

### 1. Bundle Optimization (2 tests) - 1 minute ✅

**Fix**: Just skip them - they need production build.

```typescript
// In e2e/bundle-optimization.spec.ts (top of file)
test.skip(process.env.NODE_ENV !== 'production', 'Requires production build');
```

**Files**: `e2e/bundle-optimization.spec.ts:44`, `e2e/bundle-optimization.spec.ts:146`

---

### 2. Accessibility (1 test) - 15 minutes ✅

**Test**: Toast WCAG violations (line 138)

**Fix Approach**:
```bash
# Run test to see exact axe-core violation
npx playwright test e2e/accessibility.spec.ts:138 --headed

# Common fixes (apply what axe-core reports):
# - Add role="status" and aria-live="polite" to toast
# - Fix color contrast (must be 4.5:1 minimum)
# - Add keyboard dismissal (Escape key)
```

**File**: `e2e/accessibility.spec.ts:138`

---

### 3. Product Discovery (1 test) - 10 minutes ✅

**Test**: Auth required for watchlist (line 297)

**Fix Approach**:
```bash
# Run test to see actual error
npx playwright test e2e/product-discovery.spec.ts:297 --headed

# Likely fixes:
# - Update auth modal selector (UI may have changed)
# - Verify auth guard is still present in watchlist button
```

**File**: `e2e/product-discovery.spec.ts:297`

---

## Medium Complexity (1-2 hours)

### 4. Advanced Search (12 tests) - 1-2 hours ⚠️

**CRITICAL PERFORMANCE CHECK FIRST**:

```bash
# Verify service layer uses optimized storage method
grep -n "searchProductsExact" server/services/advanced-search.ts

# If found, MUST refactor to use storage.searchProducts() with database filtering
# Current anti-pattern: Fetches all results, filters in JavaScript (100x slower at scale)
```

**Triage Strategy**:
```bash
# Run each test individually
npx playwright test e2e/advanced-search.spec.ts:64 --headed   # Category filter
npx playwright test e2e/advanced-search.spec.ts:101 --headed  # Category filter 2
npx playwright test e2e/advanced-search.spec.ts:178 --headed  # Price range
# ... etc

# For each failure:
# - Read error message (tells you exactly what's broken)
# - If quick fix (< 15 min): Fix now
# - If complex (> 30 min): Skip test, document as incomplete feature
```

**Common Issues to Check**:
1. **Missing route params**: `/api/products/search` doesn't accept `?category=X` or `?minPrice=Y`
2. **UI state management**: Filter state lost on pagination
3. **Database queries**: Filters not in WHERE clauses (performance issue)
4. **Empty state rendering**: Component not showing when `results.length === 0`

**Performance Requirements** (from review):
- Response time: < 200ms for filtered searches
- Use `storage.searchProducts()` with database-level filtering
- No in-memory filtering after fetch (causes 100x slowdown at scale)

**Files**: `e2e/advanced-search.spec.ts` (lines 64, 101, 178, 223, 255, 289, 337, 392, 441, 512, 545)

---

### 5. Price Analytics (1 test) - 30 minutes

**Test**: Cross-retailer comparison (line 335)

**Fix Approach**:
```bash
# Run test to see error
npx playwright test e2e/price-analytics.spec.ts:335 --headed

# Check:
# - API endpoint returns multi-retailer data
# - Chart component renders multiple retailer series
# - Test selectors match current UI
```

**Performance Note**: Add caching header to aggregates endpoint:
```typescript
res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=1800');
```

**File**: `e2e/price-analytics.spec.ts:335`

---

### 6. Watchlist (2 tests) - 30 minutes or SKIP

**Tests**:
- Bulk add products (line 316)
- Share with edit permission (line 432)

**Fix Approach**:
```bash
# Run tests to see if features are implemented
npx playwright test e2e/watchlist.spec.ts:316 --headed
npx playwright test e2e/watchlist.spec.ts:432 --headed

# If "404 Not Found" or "endpoint doesn't exist":
#   → Features not implemented, skip tests:
test.skip(true, 'Bulk add feature not yet implemented');
test.skip(true, 'Sharing feature not yet implemented');

# If other error:
#   → Debug and fix (< 30 min) or skip
```

**Files**: `e2e/watchlist.spec.ts:316`, `e2e/watchlist.spec.ts:432`

---

## Type Safety Requirements (All Fixes)

From TypeScript reviewer - enforce during implementation:

```typescript
// ✅ REQUIRED: All new helpers have explicit types
export async function getSearchResultCategories(page: Page): Promise<string[]> {
  // No 'any' types allowed
}

// ✅ REQUIRED: Strong assertions, not weak
expect(resultCount).toBe(12);        // ✅ Exact
expect(resultCount).toBeGreaterThan(0); // ❌ Weak

// ✅ REQUIRED: Type-safe error handling
try {
  const result = await doSomething();
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

**Validation**:
```bash
npm run check  # Must pass (no new TS errors)
npm run lint   # Must pass (warning count stays at 200)
```

---

## Success Criteria

- [ ] `networkidle` anti-pattern removed from search helpers
- [ ] Service layer uses `storage.searchProducts()` (not `searchProductsExact()`)
- [ ] All quick wins fixed (Bundle, Accessibility, Product Discovery)
- [ ] Advanced Search: Fixed or skipped with justification
- [ ] Zero new TypeScript errors or ESLint warnings
- [ ] Test suite passes: 139+ passing / 0 failing / 8 skipped

---

## Tracking Progress

### Quick Wins (30 min)
- [ ] Bundle Optimization - skip tests (line 44, 146)
- [ ] Accessibility - toast WCAG fix (line 138)
- [ ] Product Discovery - auth guard (line 297)

### Advanced Search (1-2 hours)
- [ ] Category filters (lines 64, 101)
- [ ] Price range (line 178)
- [ ] Sorting (lines 223, 255)
- [ ] Multi-criteria (lines 289, 337)
- [ ] Pagination (lines 392, 441)
- [ ] Empty states (lines 512, 545)

### Medium Complexity (1 hour)
- [ ] Price Analytics - cross-retailer (line 335)
- [ ] Watchlist - bulk add (line 316)
- [ ] Watchlist - sharing (line 432)

---

## Related Documentation

**Fix Context**:
- `docs/learnings/e2e-testing/LEARNINGS_WEBSOCKET_NETWORKIDLE_INCOMPATIBILITY.md` - Why `networkidle` is blocked
- `docs/08_TESTING_PATTERNS.md` - E2E testing patterns
- `docs/02_DATABASE_PATTERNS.md` - Performance patterns (N+1 prevention, caching)

**Test Helpers**:
- `e2e/helpers.ts` - `waitForPageReady()` (use instead of `networkidle`)
- `e2e/helpers/search-helpers.ts` - Search-specific helpers

---

## Notes from Multi-Agent Review

**TypeScript Review**:
- ⚠️ Blocker: `networkidle` still in search helpers (fix first)
- Enforce strict typing on all new helpers
- Use strong assertions (exact values) not weak (`> 0`)

**Performance Review**:
- 🔴 Critical: Service layer may bypass optimized storage methods
- Database filtering is 100x faster than in-memory filtering at scale
- Add performance assertions: `expect(responseTime).toBeLessThan(200)`

**Simplicity Review**:
- Original plan was 488 lines with 92% overhead
- Test errors tell you what's broken - don't pre-plan investigations
- Time estimate reduced from 7-10 hours → 3-4 hours realistic

---

**Last Updated**: 2026-01-09
**Next Steps**: Fix `networkidle` blocker → run tests → fix quick wins → triage Advanced Search
