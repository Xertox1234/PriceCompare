---
status: pending
priority: p2
issue_id: "030"
tags: [performance, database, pagination, forum, code-review]
dependencies: []
---

# Add Pagination to Forum Topics Query

## Problem Statement

`getTopics()` returns all topics without pagination limits.

**Impact:** As forum grows, returns unbounded result sets. With 10,000 topics, this query returns ~1MB+ of data, causing slow API responses (>500ms) and high memory usage.

## Findings

Discovered during performance audit on 2025-11-23.

**Location:** `server/forum-storage.ts` lines 101-154

**Evidence:**
```typescript
async getTopics(categoryId?: number, productId?: number): Promise<ForumTopicWithDetails[]> {
  // ... builds query without LIMIT
  .orderBy(desc(forumTopics.isPinned), desc(forumTopics.lastPostAt))
  .execute() as unknown as TopicQueryResult[];
```

## Proposed Solutions

### Option 1: Add Mandatory Pagination (Recommended)

**Effort:** Medium (1 hour)

**Implementation:**
```typescript
async getTopics(
  categoryId?: number,
  productId?: number,
  page = 1,
  limit = 50
): Promise<{
  topics: ForumTopicWithDetails[];
  total: number;
  totalPages: number;
}> {
  // Get total count first
  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(forumTopics)
    .where(/* same conditions */);

  // Get paginated results
  const results = await db
    .select({...})
    .from(forumTopics)
    // ... existing joins and conditions
    .orderBy(desc(forumTopics.isPinned), desc(forumTopics.lastPostAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    topics: results,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
```

## Acceptance Criteria

- [ ] getTopics accepts page and limit parameters
- [ ] Returns total count and totalPages
- [ ] Default limit is reasonable (50)
- [ ] API endpoint updated to accept pagination params
- [ ] Frontend updated to handle pagination

## Work Log

### 2025-11-23 - Performance Audit Discovery
**By:** Claude Code Review System (performance-oracle agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
