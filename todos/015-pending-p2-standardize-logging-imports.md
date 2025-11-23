---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, logging, consistency]
dependencies: []
---

# Standardize Logging to Use logger Instead of vite log

## Problem Statement

Mixed usage of `log` from `vite.ts` vs `logger` from `utils/logger.ts`. The vite `log` is a legacy helper.

## Findings

- Discovered by Pattern Recognition agent
- Also found 72 occurrences of `console.log/error` in production code
- Files using vite log:
  - `server/services/distributed-lock.ts:3`
  - `server/services/email-service.ts:3`
  - `server/routes/watchlist-routes.ts:9`

## Recommended Action

1. Replace all `log` from vite.ts with `logger` from utils/logger.ts
2. Replace all `console.*` with `logger.*`

## Acceptance Criteria

- [ ] No imports from vite.ts for logging
- [ ] No console.log/error in production code
- [ ] All logging uses utils/logger.ts
