---
status: pending
priority: p3
issue_id: "028"
tags: [code-review, performance, database, indexing]
dependencies: []
---

# Add Index on forum_topics.slug

## Problem Statement

Topic slugs are used for lookups but lack an index, causing full table scans.

## Findings

- Discovered by Data Integrity Guardian agent
- Location: `shared/schema.ts:232-255`

## Recommended Action

Add index:
```typescript
slugIdx: index("forum_topics_slug_idx").on(table.slug),
```

## Acceptance Criteria

- [ ] Index added to schema
- [ ] Migration created
- [ ] Topic lookup by slug uses index
