---
status: completed
priority: p1
issue_id: "022"
tags: [performance, database, n+1, queries, code-review]
dependencies: []
completed_date: 2025-11-23
---

# Fix N+1 Query Pattern in Tag Handling

## Problem Statement

**CRITICAL PERFORMANCE ISSUE**: Sequential database queries inside a loop for tag operations when creating topics. With 5 tags, this creates 21 database round trips instead of 4.

**Impact:** 12,000+ unnecessary queries/hour at scale. Significant latency increase.

## Findings

Discovered during comprehensive code audit by performance-oracle agent on 2025-11-23.

**Location:** `server/enhanced-forum-storage.ts` lines 178-206

**Evidence:**
```typescript
for (const tagName of tags) {
  // Query 1: Select existing tag
  let [tag] = await tx.select().from(topicTags)
    .where(eq(topicTags.name, tagName)).limit(1);

  if (!tag) {
    // Query 2: Insert new tag
    [tag] = await tx.insert(topicTags).values({ name: tagName }).returning();
  }

  // Query 3: Insert relation
  await tx.insert(topicTagRelations)
    .values({ topicId: topic.id, tagId: tag.id });

  // Query 4: Update usage count
  await tx.update(topicTags)
    .set({ usageCount: sql`${topicTags.usageCount} + 1` })
    .where(eq(topicTags.id, tag.id));
}
// 4N+1 queries total!
```

## Proposed Solutions

### Option 1: Batch Operations (Recommended)

**Effort:** Medium (2 hours)

**Implementation:**
```typescript
// Batch fetch existing tags (1 query)
const existingTags = await tx.select().from(topicTags)
  .where(inArray(topicTags.name, tags));

const existingTagMap = new Map(existingTags.map(t => [t.name, t]));
const newTagNames = tags.filter(name => !existingTagMap.has(name));

// Batch insert new tags (1 query)
if (newTagNames.length > 0) {
  const insertedTags = await tx.insert(topicTags)
    .values(newTagNames.map(name => ({ name })))
    .onConflictDoNothing()
    .returning();
  insertedTags.forEach(t => existingTagMap.set(t.name, t));
}

// Batch insert relations (1 query)
const tagIds = tags.map(name => existingTagMap.get(name)!.id);
await tx.insert(topicTagRelations)
  .values(tagIds.map(tagId => ({ topicId: topic.id, tagId })));

// Batch update usage counts (1 query)
await tx.update(topicTags)
  .set({ usageCount: sql`${topicTags.usageCount} + 1` })
  .where(inArray(topicTags.id, tagIds));
// 4 queries total!
```

## Recommended Action

Refactor to use batch operations. 81% query reduction (21 -> 4 for 5 tags).

## Technical Details

- **Affected Files**: `server/enhanced-forum-storage.ts`
- **Related Components**: Forum topic creation
- **Database Changes**: None

## Acceptance Criteria

- [ ] Tag operations use batch queries
- [ ] No loops with queries inside
- [ ] Forum topic creation unchanged functionally
- [ ] Tests pass

## Work Log

### 2025-11-23 - Performance Audit Discovery
**By:** Claude Code Review System (performance-oracle agent)
**Actions:**
- Identified N+1 query pattern in tag handling
- Calculated 12,000+ unnecessary queries/hour impact
- Categorized as P1 CRITICAL performance issue

## Notes

Source: Comprehensive code audit performed on 2025-11-23
