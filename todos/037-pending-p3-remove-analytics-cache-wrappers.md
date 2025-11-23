---
status: pending
priority: p3
issue_id: "037"
tags: [code-review, simplification, dead-code]
dependencies: ["005"]
---

# Remove Redundant Analytics Cache Wrapper Methods

## Problem Statement

`analytics-cache.ts` has 6 nearly identical wrapper methods that just call `getCachedAnalytics()`.

## Findings

- Discovered by Code Simplicity Reviewer agent
- Location: `server/services/analytics-cache.ts:54-119`
- Methods: `cachePriceTrend`, `cacheVolatility`, `cacheSeasonalPatterns`, etc.

## Recommended Action

Remove wrapper methods. Callers should use `getCachedAnalytics()` directly:
```typescript
// Instead of: analyticsCacheService.cachePriceTrend(productId, days, fn)
// Use: analyticsCacheService.getCachedAnalytics('trend', { productId, days }, fn)
```

## Acceptance Criteria

- [ ] Wrapper methods removed (~70 LOC)
- [ ] Callers updated to use getCachedAnalytics directly
- [ ] Cache functionality unchanged
