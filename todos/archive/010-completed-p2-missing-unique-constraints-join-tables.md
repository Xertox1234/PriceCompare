---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, data-integrity, schema, constraints]
dependencies: ["002"]
---

# Add Missing Unique Constraints on Join Tables

## Problem Statement

Several join tables lack unique constraints, allowing duplicate relationships:
- `user_badges` - user can have same badge twice
- `product_watches` - user can watch same product multiple times in same list
- `topic_tag_relations` - topic can have same tag twice
- `post_mentions` - same user can be mentioned twice in same post

## Findings

- Discovered by Data Integrity Guardian agent
- Related to Finding #002 (post_likes)

## Recommended Action

Create migration to add unique constraints:
```sql
ALTER TABLE user_badges ADD CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id);
ALTER TABLE product_watches ADD CONSTRAINT unique_user_product_list_watch UNIQUE (user_id, product_id, watch_list_id);
ALTER TABLE topic_tag_relations ADD CONSTRAINT unique_topic_tag UNIQUE (topic_id, tag_id);
ALTER TABLE post_mentions ADD CONSTRAINT unique_post_mention UNIQUE (post_id, mentioned_user_id);
```

## Acceptance Criteria

- [ ] All join tables have appropriate unique constraints
- [ ] Existing duplicates cleaned up before constraint added
- [ ] Schema.ts updated with constraint definitions
