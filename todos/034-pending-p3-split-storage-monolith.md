---
status: pending
priority: p3
issue_id: "034"
tags: [code-review, architecture, srp, refactoring]
dependencies: []
---

# Split Storage Monolith into Domain Modules

## Problem Statement

`storage.ts` is 1,897 lines handling multiple unrelated concerns (retailers, products, price history, watch lists, trends).

## Findings

- Discovered by Pattern Recognition and Architecture Strategist agents
- Location: `server/storage.ts`
- Violates Single Responsibility Principle

## Recommended Action

Split into domain-specific modules:
```
server/storage/
  - retailer-storage.ts
  - product-storage.ts
  - price-history-storage.ts
  - watch-list-storage.ts
  - index.ts (re-exports + combined IStorage)
```

## Acceptance Criteria

- [ ] Storage split into domain modules
- [ ] IStorage interface preserved
- [ ] All imports updated
- [ ] Tests pass
