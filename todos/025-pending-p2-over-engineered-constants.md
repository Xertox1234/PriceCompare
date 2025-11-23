---
status: pending
priority: p2
issue_id: "025"
tags: [code-review, simplification, yagni]
dependencies: []
---

# Simplify Over-Engineered Constants

## Problem Statement

`server/utils/constants.ts` (272 lines) has YAGNI violations with unused or redundant constants.

## Findings

- Discovered by Code Simplicity Reviewer agent
- Issues:
  - `CACHE_DURATION_MS` duplicates `CACHE_DURATION` with `* 1000`
  - `RATE_LIMIT_TIERS` has elaborate descriptions that aren't used
  - `HTTP_STATUS` - standard codes don't need abstraction
  - `SUCCESS_MESSAGES` - likely unused

## Recommended Action

1. Remove `CACHE_DURATION_MS` - compute when needed
2. Simplify `RATE_LIMIT_TIERS` to just multipliers
3. Remove `HTTP_STATUS` - use numbers directly
4. Audit and remove unused constants

## Acceptance Criteria

- [ ] Unused constants removed
- [ ] No duplicate constant definitions
- [ ] File reduced to essential constants only
