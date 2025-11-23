---
status: pending
priority: p3
issue_id: "038"
tags: [code-review, simplification, dead-code]
dependencies: []
---

# Remove Unused cacheAnalytics Decorator

## Problem Statement

`cacheAnalytics` decorator is defined but likely unused (TypeScript decorators need `experimentalDecorators`).

## Findings

- Discovered by Code Simplicity Reviewer agent
- Location: `server/services/analytics-cache.ts:250-275`

## Recommended Action

1. Grep for `@cacheAnalytics` usage in codebase
2. If unused, remove the decorator (~25 LOC)

## Acceptance Criteria

- [ ] Decorator usage audited
- [ ] If unused, decorator removed
- [ ] ~25 LOC reduction
