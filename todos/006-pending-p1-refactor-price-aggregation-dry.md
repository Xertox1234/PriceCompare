---
status: pending
priority: p1
issue_id: "006"
tags: [code-review, simplification, dry, refactoring]
dependencies: []
---

# Refactor Price Aggregation Service - DRY Violation

## Problem Statement

The `price-aggregation-service.ts` file is 1,470 lines with near-identical code blocks repeated 6 times for daily/weekly/monthly aggregation. This violates DRY principle and creates a maintenance nightmare.

## Findings

- Discovered during comprehensive code review by Code Simplicity Reviewer agent
- Location: `server/services/price-aggregation-service.ts`
- Duplicate code blocks:
  - Lines 87-247: Weekly aggregation (~160 lines)
  - Lines 256-444: Monthly aggregation (~190 lines)
  - Lines 465-634: Daily aggregation (~170 lines)
  - Lines 1026-1124: Daily for single product (~100 lines)
  - Lines 1129-1227: Weekly for single product (~100 lines)
  - Lines 1232-1357: Monthly for single product (~125 lines)

Each function follows identical pattern:
1. Get date range
2. Query price data with aggregation
3. Get previous period data
4. Build Map for O(1) lookup
5. Calculate statistics
6. Batch insert

## Proposed Solutions

### Option 1: Generic aggregation function (RECOMMENDED)
- **Change:** Create `calculateAggregates(periodType, options)` with period-specific config
- **Pros:** Single implementation, easier to maintain, consistent behavior
- **Cons:** Requires careful refactoring
- **Effort:** Medium
- **Risk:** Medium (aggregation is critical for analytics)

## Recommended Action

Extract common logic into a generic function with configuration object for period-specific differences.

## Technical Details

- **Affected Files:** `server/services/price-aggregation-service.ts`
- **Related Components:** Price analytics, dashboard charts
- **Database Changes:** No

### Proposed Architecture:
```typescript
interface AggregationConfig {
  periodType: 'daily' | 'weekly' | 'monthly';
  targetTable: typeof priceAggregatesDaily | typeof priceAggregatesWeekly | typeof priceAggregatesMonthly;
  getDateRange: () => { start: Date; end: Date };
  getPreviousPeriodRange: (current: Date) => { start: Date; end: Date };
}

async function calculateAggregates(
  config: AggregationConfig,
  productId?: number
): Promise<AggregationResult> {
  // 1. Get date range using config.getDateRange()
  // 2. Query price data (same for all periods)
  // 3. Get previous period using config.getPreviousPeriodRange()
  // 4. Build comparison Map
  // 5. Calculate statistics (same for all periods)
  // 6. Batch insert to config.targetTable
}

// Usage:
export const aggregateDaily = (productId?: number) =>
  calculateAggregates(DAILY_CONFIG, productId);
export const aggregateWeekly = (productId?: number) =>
  calculateAggregates(WEEKLY_CONFIG, productId);
export const aggregateMonthly = (productId?: number) =>
  calculateAggregates(MONTHLY_CONFIG, productId);
```

### Date range helpers already exist (lines 1435-1465):
- `getWeekStart()`, `getWeekEnd()`
- `getMonthStart()`, `getMonthEnd()`
- `getDayStart()`, `getDayEnd()`

## Acceptance Criteria

- [ ] Single generic aggregation function created
- [ ] All 6 duplicate functions refactored to use generic function
- [ ] Period-specific config objects defined
- [ ] Aggregation results identical to before refactor
- [ ] File reduced from ~1,470 to ~800 lines
- [ ] Tests pass

## Work Log

### 2025-11-22 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during comprehensive code review
- Analyzed by Code Simplicity Reviewer agent
- Identified as severe DRY violation

**Learnings:**
- Copy-paste development creates maintenance debt
- Generic functions with configuration are more maintainable
- Date helper functions already exist but weren't leveraged

## Notes

Source: Code review performed on 2025-11-22
Review command: /compounding-engineering:review codebase
Estimated LOC reduction: ~600-700 lines
