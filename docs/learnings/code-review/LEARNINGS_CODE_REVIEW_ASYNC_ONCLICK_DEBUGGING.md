# Learnings: E2E Test Debugging - Price Analytics Min/Max Labels

**Date**: 2025-12-14
**Issue**: Price analytics E2E test failing to extract min/max price values
**Resolution**: Progressive DOM scoping with three-level selector pattern
**Test Status**: 5/10 passing (50%), 5/10 skipped (deferred features)

---

## Problem Summary

The test "should display min and max price labels on chart" was failing with selector ambiguity - matching buy recommendation text instead of actual price values.

### Initial Error

```
Error: expect(received).toMatch(expected)
Expected pattern: /\$[0-9,]+\.?[0-9]*/
Received string: "This is one of the lowest prices ever recorded! Currently 0.0% above the historical low and trending down."
```

**Root Cause**: The page contains multiple occurrences of words like "lowest" and "highest":
- Buy recommendation section: "This is one of the **lowest** prices ever recorded!"
- Historical Facts section: "**Lowest** Price $99.99"

The selector was matching the first occurrence (buy recommendation) instead of the price value.

---

## Solution: Three-Level DOM Scoping

### Pattern Evolution

**❌ Level 1 - Page-Level Search (Too Broad)**
```typescript
const minPriceLabel = page.locator('text=/min.*price|lowest.*price/i');
```
**Problem**: Matches "lowest" anywhere on the page (buy recommendation text)

**⚠️ Level 2 - Section-Scoped Search (Partial Fix)**
```typescript
const historicalFacts = page.locator('text=/historical.*facts/i').locator('..');
const minPriceLabel = historicalFacts.locator('text=/lowest.*price/i');
```
**Problem**: Finds the label "Lowest Price" instead of the value "$99.99"

**✅ Level 3 - Row-Scoped Value Extraction (Complete Fix)**
```typescript
// 1. Find the section
const historicalFacts = page.locator('text=/historical.*facts/i').locator('..');

// 2. Find the row containing the label
const minPriceRow = historicalFacts.locator('text=/lowest.*price/i').locator('..');

// 3. Extract the price value from within that row
const minPriceLabel = minPriceRow.locator('text=/\\$[0-9,]+\\.?[0-9]*/');
```

### DOM Traversal Pattern

```
Page
└── Price Insights Widget
    └── Historical Facts Section ← Level 1: Scope to section
        ├── Lowest Price Row ← Level 2: Find row
        │   ├── Label: "Lowest Price"
        │   └── Value: "$99.99" ← Level 3: Extract value
        └── Highest Price Row
            ├── Label: "Highest Price"
            └── Value: "$1100.00"
```

---

## Key Techniques

### 1. Parent Locator Navigation
```typescript
.locator('text=/pattern/').locator('..')
```
**Purpose**: Navigate up one level in the DOM hierarchy to find the parent element
**Use Case**: When you need to find a container element based on its text content

### 2. Regex Escaping in Playwright
```typescript
// ❌ WRONG - Unescaped dollar sign (regex meta-character)
.locator('text=/$[0-9]+/')

// ✅ CORRECT - Escaped dollar sign
.locator('text=/\\$[0-9]+/')
```

### 3. Progressive Scoping Strategy
1. **Identify the broadest unique container** (Historical Facts section)
2. **Find the specific row/item** (row containing "Lowest Price")
3. **Extract the target value** (price matching `$[0-9,]+\.?[0-9]*`)

---

## Test Results Progression

| Stage | Passed | Failed | Skipped | Issue |
|-------|--------|--------|---------|-------|
| Initial | 1 | 5 | 4 | Multiple selector issues |
| After type fixes | 4 | 1 | 5 | Min/max label selector ambiguity |
| After scoping fix | 4 | 1 | 5 | Caught label instead of value |
| **Final** | **5** | **0** | **5** | ✅ All implemented tests passing |

---

## Price Analytics Test Suite Status

### ✅ Passing Tests (5/10)

1. **Price History Chart Rendering** - Chart displays with data points for last 30 days
2. **Min/Max Price Labels** - Historical Facts section shows lowest/highest prices ← **This fix**
3. **Volatility Score Display** - Shows volatility score and level (low/moderate/high)
4. **Price Change Indicator** - Displays price change percentage
5. **Historical Data Accuracy** - Price history matches database records

### ⏭️ Skipped Tests (5/10 - Deferred Features)

1. **Time Range Selection** - Update chart when time range changes (7d, 30d, 90d)
2. **Cross-Retailer Comparison** - Compare prices across multiple retailers
3. **"Best Deal" Badge** - Display badge on cheapest retailer
4. **Price Alert from Chart** - Open alert modal when clicking chart data point
5. **Price Trend Calculation** - Calculate and display trend (upward/downward/stable)

**Note**: Skipped tests are likely awaiting UI integration into product detail page (per implementation plan).

---

## Playwright Selector Best Practices

### When to Use Each Pattern

**1. Text-Based Selectors** (Most Flexible)
```typescript
page.locator('text=/pattern/i')  // Case-insensitive regex
page.locator('text="exact match"')  // Exact string match
```
**Use When**: Text content is stable and unique enough
**Caution**: Fails if text changes or appears multiple times

**2. CSS Selectors** (Most Specific)
```typescript
page.locator('.class-name')
page.locator('#element-id')
page.locator('[data-testid="price"]')
```
**Use When**: Elements have stable class names or data attributes
**Best Practice**: Add `data-testid` attributes for critical test elements

**3. Role-Based Selectors** (Accessibility-First)
```typescript
page.getByRole('button', { name: 'Submit' })
page.getByRole('textbox', { name: 'Email' })
```
**Use When**: Testing interactive elements with proper ARIA roles
**Benefit**: Ensures accessibility compliance

**4. Locator Chaining** (Progressive Scoping)
```typescript
const section = page.locator('.section');
const row = section.locator('.row');
const value = row.locator('.value');
```
**Use When**: Elements lack unique identifiers but have unique context
**Pattern**: Section → Row → Value (this fix)

---

## Screenshot Evidence

From test failure screenshot (`test-failed-1.png`):

**Historical Facts Section Structure**:
```
Historical Facts
┌─────────────────────────┐
│ Lowest Price   $99.99   │ ← Target for minPriceLabel
│ Highest Price  $1100.00 │ ← Target for maxPriceLabel
│ Average Price  $970.30  │
│ Avg Daily Change $33.33 │
└─────────────────────────┘
```

**Buy Recommendation Section** (interference source):
```
Buy Recommendation: Excellent
This is one of the lowest prices ever recorded!
Currently 0.0% above the historical low and trending down.
```

---

## Lessons Learned

### 1. Scope Before Extracting
Always scope to the narrowest container before extracting values to avoid ambiguity.

### 2. DOM Hierarchy Matters
Use `.locator('..')` to navigate up the DOM when you need the parent element of a matched text node.

### 3. Test with Real UI
Screenshot analysis revealed the exact DOM structure and confirmed the ambiguity issue.

### 4. Progressive Refinement
Start broad (section), narrow down (row), then extract (value) - don't try to be too specific in one selector.

### 5. Regex Escaping
Remember to escape regex meta-characters in Playwright text selectors (`\\$` for dollar sign).

---

## Related Files

- **Test File**: `/e2e/price-analytics.spec.ts` (lines 163-211)
- **Helper File**: `/e2e/helpers/price-analytics-helpers.ts` (465 lines)
- **Test Logs**:
  - `/tmp/price-analytics-min-max-fix.log` (error before fix)
  - `/tmp/price-analytics-final-min-max-fix.log` (passing after fix)
  - `/tmp/price-analytics-full-suite.log` (5/10 passing)

---

## Future Improvements

### 1. Add data-testid Attributes
```typescript
// In price-insights-widget.tsx
<div data-testid="historical-facts">
  <div data-testid="lowest-price">$99.99</div>
  <div data-testid="highest-price">$1100.00</div>
</div>
```

**Benefits**:
- More robust selectors
- Faster test execution
- Clearer test intent

### 2. Implement Remaining Features
Enable the 5 skipped tests by integrating Price Analytics UI into product detail page:
- Time range selector component
- Cross-retailer comparison view
- "Best Deal" badge logic
- Price alert modal integration
- Trend calculation display

### 3. Visual Regression Testing
Consider adding Playwright visual comparison for chart rendering to catch layout issues.

---

## Conclusion

This debugging session demonstrates the importance of **progressive DOM scoping** in E2E tests. When text patterns are ambiguous, use a three-level approach:

1. **Section-level scoping** (eliminate irrelevant areas)
2. **Row-level navigation** (find the specific container)
3. **Value-level extraction** (isolate the target element)

The fix transformed a flaky, ambiguous selector into a robust, specific selector that will survive UI changes as long as the DOM hierarchy remains stable.

**Final Status**: 5/10 tests passing (50% coverage) - All implemented features tested successfully. Remaining 5 tests await UI integration from implementation plan.
