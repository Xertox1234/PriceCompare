---
status: pending
priority: p2
issue_id: "021"
tags: [code-review, performance, database, indexing]
dependencies: []
---

# Add Composite Index for Notification Queries

## Problem Statement

Notifications table has individual indexes but common queries filter by `userId`, `isRead`, and `type` simultaneously without a composite index.

## Findings

- Discovered by Performance Oracle agent
- Location: `shared/schema.ts:334-336`
- getUserNotifications at `notification-service.ts:36-62` filters by multiple columns
- At scale (1000+ users, 100+ notifications each): full table scans

## Recommended Action

Add composite index:
```typescript
userTypeIdx: index("notifications_user_type_idx")
  .on(table.userId, table.type, table.isRead, table.createdAt),
```

## Acceptance Criteria

- [ ] Composite index added to schema
- [ ] Migration created
- [ ] Query performance improved (verify with EXPLAIN ANALYZE)
