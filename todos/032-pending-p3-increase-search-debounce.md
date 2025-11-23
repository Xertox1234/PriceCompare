---
status: pending
priority: p3
issue_id: "032"
tags: [code-review, performance, frontend, ux]
dependencies: []
---

# Increase Search Debounce Value

## Problem Statement

300ms debounce for search queries may still trigger multiple requests for fast typists.

## Findings

- Discovered by Performance Oracle agent
- Location: `client/src/hooks/use-products.ts:7`
- 500ms better captures typing bursts

## Recommended Action

Increase debounce to 500ms:
```typescript
const debouncedQuery = useDebounce(filters.query, 500);
```

## Acceptance Criteria

- [ ] Debounce increased to 500ms
- [ ] Reduced API calls during typing
- [ ] UX still feels responsive
