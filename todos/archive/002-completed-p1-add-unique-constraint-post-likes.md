---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, data-integrity, schema, database, constraints]
dependencies: []
---

# Add Unique Constraint on post_likes Table

## Problem Statement

The `post_likes` table lacks a unique constraint on `(post_id, user_id)`, allowing a user to "like" the same post multiple times. This corrupts like counts and violates business logic that each user can only like a post once.

## Findings

- Discovered during comprehensive code review by Data Integrity Guardian agent
- Location: `shared/schema.ts:309-318`
- Current code has no unique constraint preventing duplicate likes

## Proposed Solutions

### Option 1: Add unique constraint via migration (RECOMMENDED)
- **Change:** Add `unique("unique_post_user_like").on(table.postId, table.userId)`
- **Pros:** Database-enforced uniqueness, prevents corruption at source
- **Cons:** Need to clean up any existing duplicates first
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Add unique constraint with migration that first cleans up any existing duplicates.

## Technical Details

- **Affected Files:** `shared/schema.ts`, new migration file
- **Related Components:** Forum likes, like counts
- **Database Changes:** Yes - add unique constraint

### Migration SQL
```sql
-- First, remove any duplicate likes (keep the earliest)
DELETE FROM post_likes a
USING post_likes b
WHERE a.ctid > b.ctid
  AND a.post_id = b.post_id
  AND a.user_id = b.user_id;

-- Then add the unique constraint
ALTER TABLE post_likes
ADD CONSTRAINT unique_post_user_like UNIQUE (post_id, user_id);
```

## Acceptance Criteria

- [ ] Existing duplicate likes cleaned up
- [ ] Unique constraint added to database
- [ ] Schema updated with unique constraint definition
- [ ] Like functionality still works correctly
- [ ] Tests pass

## Work Log

### 2025-11-22 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during comprehensive code review
- Analyzed by Data Integrity Guardian agent
- Identified as P1 due to data corruption risk

**Learnings:**
- Many-to-many join tables should always have unique constraints on the relationship
- Similar issue exists in user_badges, product_watches, topic_tag_relations, post_mentions

## Notes

Source: Code review performed on 2025-11-22
Review command: /compounding-engineering:review codebase
Related findings: Similar constraints needed on user_badges, product_watches, topic_tag_relations, post_mentions
