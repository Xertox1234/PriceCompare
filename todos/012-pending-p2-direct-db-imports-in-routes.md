---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, architecture, repository-pattern]
dependencies: []
---

# Refactor Direct db Imports in Routes to Use Storage Layer

## Problem Statement

Multiple routes bypass the `storage.ts` abstraction by directly importing `db`, violating the repository pattern and making code harder to test.

## Findings

- Discovered by Architecture Strategist and Pattern Recognition agents
- Affected files:
  - `server/routes/auth-routes.ts:2`
  - `server/routes/forum-routes.ts:2`
  - `server/routes/admin-routes.ts:2`
  - `server/routes/health-routes.ts:3`
  - `server/scraping-routes.ts:18`
  - `server/enhanced-forum-routes.ts:14`
  - `server/price-analytics-routes.ts:4`
  - `server/discourse-routes.ts:4`
  - `server/affiliate-routes.ts:3`

## Recommended Action

1. Extend `IStorage` interface with methods for auth, forum, admin operations
2. Create domain-specific storage classes
3. Routes should never import `db` directly

## Acceptance Criteria

- [ ] No route files import `db` directly
- [ ] All database access goes through storage layer
- [ ] IStorage interface extended as needed
