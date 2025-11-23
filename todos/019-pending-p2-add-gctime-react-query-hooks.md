---
status: pending
priority: p2
issue_id: "019"
tags: [code-review, performance, frontend, react-query]
dependencies: []
---

# Add gcTime to React Query Hooks

## Problem Statement

Most React Query hooks only specify `staleTime` but not `gcTime`, causing data to be garbage collected sooner than intended.

## Findings

- Discovered by Performance Oracle agent
- Location: Multiple hooks in `client/src/hooks/`
- Example: `use-products.ts:38` has `staleTime: 5 * 60 * 1000` but no gcTime
- Without gcTime, users navigating back trigger unnecessary refetches

## Recommended Action

Set `gcTime` consistently (typically 2-3x staleTime):
```typescript
return useQuery({
  queryKey: ['products', filters],
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 15 * 60 * 1000, // 15 minutes
});
```

## Acceptance Criteria

- [ ] All useQuery hooks have explicit gcTime
- [ ] gcTime >= staleTime (typically 2-3x)
- [ ] Reduced unnecessary refetches on navigation
