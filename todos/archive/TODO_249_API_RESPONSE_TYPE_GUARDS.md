# TODO 249: Add Type Guards for API Response Validation in Chart Components

**Priority**: P1
**File(s)**: `shared/api-types.ts`, `client/src/utils/chart-data-transformer.ts`, `client/src/hooks/use-price-history.ts`
**Estimated Time**: 1-2 hours
**Status**: ✅ Completed
**Completed Date**: 2026-01-20

## Problem Statement

Chart components use unsafe type assertions when parsing API responses without runtime validation. This can lead to runtime errors if the API response shape differs from expectations.

## Root Cause

Price history and chart data parsing uses patterns like:
- `parseFloat(entry.price as string)` without verifying `entry.price` exists
- Direct property access on potentially undefined API response objects
- Missing runtime validation for JSON response structures

## Solution Implemented

### 1. Created Type Guards in `shared/api-types.ts`

Added comprehensive type guards and validation functions:

- `isPriceHistoryEntry(data)` - Validates individual price history entries
- `isPriceHistoryArray(data)` - Validates arrays of price history entries (with sampling for performance)
- `isPriceHistoryApiResponse(response)` - Validates complete API response structure
- `isChartPriceDataPoint(data)` - Validates chart-specific data points
- `safeParsePriceToNumber(price, fallback)` - Safe price parsing with fallback
- `validatePriceHistoryEntries(data)` - Filter invalid entries from arrays
- `validatePriceHistoryEntriesWithDiagnostics(data)` - Validation with diagnostic info for logging

### 2. Updated Chart Data Transformer

In `client/src/utils/chart-data-transformer.ts`:

- Added `validatePriceDataPoints()` function for filtering invalid data
- Replaced `parseFloat(p.price)` with `safeParsePriceToNumber()` for robust parsing
- Added logging for invalid data using the client-side logger
- Protected `calculatePriceStats()` against invalid price values

### 3. Updated Price History Hook

In `client/src/hooks/use-price-history.ts`:

- Added runtime validation of API responses using `isPriceHistoryApiResponse()`
- Implemented graceful recovery for malformed responses
- Added logging for validation failures

## Technical Details

```typescript
// Before (unsafe):
const price = parseFloat(entry.price as string);

// After (safe):
const price = safeParsePriceToNumber(entry.price, 0);

// API response validation:
const response: unknown = await apiRequest(...);
if (!isPriceHistoryApiResponse(response)) {
  log.warn('API response failed validation, attempting to recover');
  // Graceful recovery logic...
}
```

## Checklist

- [x] Implementation complete
- [x] Tests pass (133 tests passing)
- [x] No TypeScript errors
- [x] No ESLint errors in changed files
- [x] Chart renders correctly with valid data
- [x] Chart handles invalid data gracefully

## Success Criteria

- [x] No type assertions without runtime validation in chart components
- [x] Invalid API responses are logged and handled gracefully
- [x] Existing functionality preserved (all tests pass)
- [x] No runtime errors from malformed data

## Files Changed

1. `shared/api-types.ts` - Added type guards and validation functions
2. `client/src/utils/chart-data-transformer.ts` - Use safe parsing with validation
3. `client/src/hooks/use-price-history.ts` - Runtime API response validation

## Code Review Feedback Addressed

The code-review-specialist identified blocking issues which were fixed:

### 1. Incomplete Type Validation (FIXED)
- `isPriceHistoryEntry()` now validates all required fields as per database schema
- Added validation for `productOfferId`, `productId`, `retailerId` as required (NOT NULL)
- Added positive number validation (id > 0)

### 2. Price Parseability Validation (FIXED)
- Both type guards now validate that price strings are parseable as valid numbers
- Rejects NaN, negative prices, and non-numeric strings

### 3. Unsafe Type Assertion (FIXED)
- Made `PriceDataPoint` a type alias for `ChartPriceDataPoint`
- Removed unsafe `as PriceDataPoint` cast
- Type guard now properly narrows the type

### 4. `isChartPriceDataPoint()` Strengthened
- Now validates all required fields including `productId` and `retailerName`
- Ensures retailerName is non-empty string
- Consistent validation rules with `isPriceHistoryEntry()`
