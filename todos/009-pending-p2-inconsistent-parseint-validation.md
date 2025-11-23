---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, security, validation, input-sanitization]
dependencies: []
---

# Replace Raw parseInt with parseIntSafe Across Routes

## Problem Statement

Multiple route handlers use raw `parseInt()` without the safe parsing helpers (`parseIntSafe`/`parseIntOptional`), which could result in NaN values being passed to database queries.

## Findings

- Discovered by Security Sentinel and Data Integrity Guardian agents
- Affected files:
  - `server/routes/alert-routes.ts:49,67`
  - `server/smart-alerts-routes.ts:30`
  - `server/price-history-routes.ts:89,125,162,290`
  - `server/community-routes.ts:30,55,100,125,149,188,208,284,313,357,383,409`
  - `server/price-analytics-routes.ts:55,104,153,154,197,198,241,265,266`
  - `server/monitoring-routes.ts:44,120`

## Recommended Action

Replace all `parseInt(req.params.*)` with `parseIntSafe()`:
```typescript
// Instead of:
const alertId = parseInt(req.params.id);

// Use:
const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });
```

## Acceptance Criteria

- [ ] All raw parseInt calls in routes replaced with parseIntSafe
- [ ] Invalid IDs return proper 400 errors
- [ ] Tests pass
