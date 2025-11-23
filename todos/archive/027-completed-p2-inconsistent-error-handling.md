---
status: pending
priority: p2
issue_id: "027"
tags: [patterns, error-handling, security, code-review]
dependencies: []
---

# Standardize Error Handling with createErrorResponse

## Problem Statement

13 route files do NOT use `createErrorResponse()` for error handling, instead using manual `res.status(500).json()` patterns. This leads to:
- Inconsistent error response formats
- Potential information leakage in production
- Duplicate error handling code

**Impact:** Internal error details could be exposed, inconsistent API experience.

## Findings

Discovered during pattern-recognition audit on 2025-11-23.

**Affected Files:**
1. `server/routes/affiliate-routes.ts`
2. `server/routes/admin-aggregation-routes.ts`
3. `server/routes/aggregation-metrics-routes.ts`
4. `server/routes/discourse-routes.ts`
5. `server/routes/enhanced-forum-routes.ts`
6. `server/routes/forum-routes.ts`
7. `server/routes/price-analytics-routes.ts`
8. `server/routes/price-history-routes.ts`
9. `server/routes/scraping-routes.ts`
10. `server/routes/watchlist-routes.ts`
11. `server/routes/agent-limits-routes.ts`
12. `server/routes/advanced-search-routes.ts`
13. `server/routes/monitoring-routes.ts`

**Current Pattern (Wrong):**
```typescript
catch (error: unknown) {
  logger.error('Operation failed:', { error });
  res.status(500).json({
    error: 'Operation failed',
    message: error instanceof Error ? error.message : String(error),
  });
}
```

**Correct Pattern:**
```typescript
catch (error: unknown) {
  const errorResponse = createErrorResponse(error, 'OperationName');
  res.status(errorResponse.status).json({ error: errorResponse.error });
}
```

## Proposed Solutions

### Option 1: Update All Route Files (Recommended)

**Effort:** Medium (1 day)

For each affected file:
1. Import `createErrorResponse` from `../utils/error-sanitizer`
2. Replace manual error handling with `createErrorResponse()`
3. Remove redundant logger.error calls (createErrorResponse logs automatically)

## Acceptance Criteria

- [ ] All route files use createErrorResponse
- [ ] No manual error message construction
- [ ] Consistent error response format across API
- [ ] No internal details leaked in production

## Work Log

### 2025-11-23 - Pattern Recognition Audit Discovery
**By:** Claude Code Review System (pattern-recognition-specialist agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
