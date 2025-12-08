# Forum System Cleanup - Keep Lightweight Product Reviews

## Context

The PriceCompare codebase contains a complete Discourse-inspired forum system (13 database tables, ~500 lines of schema) that was never implemented. The decision has been made to:

- **External Community**: Use commercially hosted Discourse for general forums
- **Internal Product Reviews**: Keep lightweight product discussion/review system
- **Technical Debt**: Remove unused forum infrastructure

## Current State

### Unused Forum Tables (11 to DELETE)

1. `forumCategories` - Forum category organization
2. `postLikes` - Like/reaction system
3. `postMentions` - User mentions in posts
4. `postRevisions` - Post edit history
5. `topicTags` - Tag system for topics
6. `topicTagRelations` - Many-to-many topic<->tag
7. `privateMessages` - Direct messaging system
8. `badges` - User achievement system
9. `userBadges` - Badge assignments
10. User profile fields: `trustLevel`, `postCount`, `topicCount`, `likesGiven`, `likesReceived`, `timeReadPosts`, `daysVisited`
11. Foreign key references in `notifications`, `dealSpottings`, `priceAlerts`

### Tables to KEEP and Rename (2)

1. `forumTopics` → `productDiscussions` (has `productId` foreign key)
2. `forumPosts` → `discussionReplies` (replies to discussions)

### Current Usage

- ❌ No routes implemented
- ❌ No services use forum tables
- ❌ No client components
- ✅ Schema exists but completely unused

## Implementation Plan

### Phase 1: Database Migration (HIGH PRIORITY)

**Step 1: Create Migration to Drop Unused Tables**

```sql
-- Migration: 00XX_drop_unused_forum_tables.sql

-- Drop tables (order matters for foreign key constraints)
DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS badges CASCADE;
DROP TABLE IF EXISTS post_revisions CASCADE;
DROP TABLE IF EXISTS post_mentions CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS topic_tag_relations CASCADE;
DROP TABLE IF EXISTS topic_tags CASCADE;
DROP TABLE IF EXISTS private_messages CASCADE;

-- Remove forum-related foreign keys
ALTER TABLE notifications DROP COLUMN IF EXISTS related_post_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS related_topic_id;
ALTER TABLE deal_spottings ALTER COLUMN forum_post_id DROP NOT NULL; -- Make nullable or drop
ALTER TABLE price_alerts DROP COLUMN IF EXISTS notify_forum;

-- Remove forum-related user profile fields
ALTER TABLE users DROP COLUMN IF EXISTS trust_level;
ALTER TABLE users DROP COLUMN IF EXISTS post_count;
ALTER TABLE users DROP COLUMN IF EXISTS topic_count;
ALTER TABLE users DROP COLUMN IF EXISTS likes_given;
ALTER TABLE users DROP COLUMN IF EXISTS likes_received;
ALTER TABLE users DROP COLUMN IF EXISTS time_read_posts;
ALTER TABLE users DROP COLUMN IF EXISTS days_visited;
```

**Step 2: Create Migration to Rename Product Discussion Tables**

```sql
-- Migration: 00XX_rename_forum_to_product_discussions.sql

-- Rename tables
ALTER TABLE forum_topics RENAME TO product_discussions;
ALTER TABLE forum_posts RENAME TO discussion_replies;

-- Rename constraints and indexes
ALTER INDEX forum_topics_pkey RENAME TO product_discussions_pkey;
ALTER INDEX forum_topics_category_id_idx RENAME TO product_discussions_category_id_idx;
ALTER INDEX forum_topics_author_id_idx RENAME TO product_discussions_author_id_idx;
ALTER INDEX forum_topics_product_id_idx RENAME TO product_discussions_product_id_idx;
ALTER INDEX forum_topics_created_at_idx RENAME TO product_discussions_created_at_idx;
ALTER INDEX forum_topics_slug_idx RENAME TO product_discussions_slug_idx;

ALTER INDEX forum_posts_pkey RENAME TO discussion_replies_pkey;
ALTER INDEX forum_posts_topic_id_idx RENAME TO discussion_replies_topic_id_idx;
ALTER INDEX forum_posts_author_id_idx RENAME TO discussion_replies_author_id_idx;

-- Update foreign key names (if explicitly named)
-- Note: May need to check actual constraint names with:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'forum_topics'::regclass;
```

**Step 3: Drop Category System (Optional - Product Discussions Don't Need Categories)**

```sql
-- If keeping category system for product discussions:
ALTER TABLE product_discussions RENAME COLUMN category_id TO discussion_category_id;

-- If removing category system entirely:
ALTER TABLE product_discussions DROP COLUMN IF EXISTS category_id;
DROP TABLE IF EXISTS forum_categories CASCADE;
```

### Phase 2: Schema Updates (HIGH PRIORITY)

**File**: `shared/schema.ts`

1. **Remove table definitions** (lines ~250-542):
   - `forumCategories`
   - `postLikes`
   - `postMentions`
   - `postRevisions`
   - `topicTags`
   - `topicTagRelations`
   - `privateMessages`
   - `badges`
   - `userBadges`

2. **Rename tables**:

   ```typescript
   // OLD
   export const forumTopics = pgTable("forum_topics", { ... });
   export const forumPosts = pgTable("forum_posts", { ... });

   // NEW
   export const productDiscussions = pgTable("product_discussions", { ... });
   export const discussionReplies = pgTable("discussion_replies", { ... });
   ```

3. **Update `users` table** (remove forum fields):

   ```typescript
   // Remove these fields:
   trustLevel: integer("trust_level").default(0),
   postCount: integer("post_count").default(0),
   topicCount: integer("topic_count").default(0),
   likesGiven: integer("likes_given").default(0),
   likesReceived: integer("likes_received").default(0),
   timeReadPosts: integer("time_read_posts").default(0),
   daysVisited: integer("days_visited").default(0),

   // Keep these (for reputation system):
   reputation: integer("reputation").default(0),
   avatarUrl: text("avatar_url"),
   bio: text("bio"),
   ```

4. **Update `notifications` table**:

   ```typescript
   // Remove:
   relatedPostId: integer("related_post_id").references(() => forumPosts.id, { onDelete: 'set null' }),
   relatedTopicId: integer("related_topic_id").references(() => forumTopics.id, { onDelete: 'set null' }),

   // Add (if keeping discussion notifications):
   relatedDiscussionId: integer("related_discussion_id").references(() => productDiscussions.id, { onDelete: 'set null' }),
   ```

5. **Update `dealSpottings` table**:

   ```typescript
   // Option A: Make nullable
   forumPostId: integer("forum_post_id").references(() => forumPosts.id, { onDelete: 'set null' }),

   // Option B: Rename to discussionId
   discussionId: integer("discussion_id").references(() => productDiscussions.id, { onDelete: 'set null' }),
   ```

6. **Update type exports**:

   ```typescript
   // Remove:
   export type ForumCategory = typeof forumCategories.$inferSelect;
   export type ForumTopic = typeof forumTopics.$inferSelect;
   export type ForumPost = typeof forumPosts.$inferSelect;
   export type PostLike = typeof postLikes.$inferSelect;
   // ... etc

   // Add:
   export type ProductDiscussion = typeof productDiscussions.$inferSelect;
   export type DiscussionReply = typeof discussionReplies.$inferSelect;
   export type InsertProductDiscussion = typeof insertProductDiscussionSchema._type;
   export type InsertDiscussionReply = typeof insertDiscussionReplySchema._type;
   ```

### Phase 3: Storage Layer Cleanup (MEDIUM PRIORITY)

**File**: `server/storage.ts`

1. **Remove forum-related methods** (if any exist):
   - `getForumTopics()`
   - `getForumPost()`
   - `createForumPost()`
   - etc.

2. **Check for `notifyForum` parameters** in existing methods:

   ```bash
   grep -rn "notifyForum" server/storage.ts
   ```

   Remove or replace with `notifyDiscussion` if keeping product discussions

3. **Add product discussion methods** (FUTURE - when implementing feature):
   ```typescript
   async getProductDiscussions(productId: number, options?: PaginationOptions) { ... }
   async createProductDiscussion(data: InsertProductDiscussion) { ... }
   async getDiscussionReplies(discussionId: number) { ... }
   async createDiscussionReply(data: InsertDiscussionReply) { ... }
   ```

### Phase 4: Routes Cleanup (LOW PRIORITY)

**File**: `server/routes/community-routes.ts`

- Currently handles ONLY watch lists (no forum routes)
- No cleanup needed unless adding product discussion endpoints later

**Future Product Discussion Routes** (when implementing):

```typescript
// GET /api/products/:productId/discussions - List discussions for a product
// POST /api/products/:productId/discussions - Create discussion (auth required)
// GET /api/discussions/:discussionId - Get discussion with replies
// POST /api/discussions/:discussionId/replies - Add reply (auth required)
// DELETE /api/discussions/:discussionId - Delete discussion (admin/author only)
```

### Phase 5: Client Cleanup (LOW PRIORITY)

**Files to check**:

- `client/src/hooks/use-community.ts` - Minimal usage, likely no changes needed
- Search for any forum-related components: `grep -r "forum\|Forum" client/src/`

**Future Product Discussion UI** (when implementing):

- Product page discussion tab
- Simple comment list component
- Reply form component
- Link to Discourse for general community

## Testing Plan

### Database Migration Testing

```bash
# Test migration on development database
npm run migrate

# Verify tables dropped
psql $DATABASE_URL -c "\dt" | grep -i forum
# Should show ONLY: product_discussions, discussion_replies

# Verify columns removed from users
psql $DATABASE_URL -c "\d users" | grep -i "trust_level\|post_count"
# Should return nothing

# Check foreign key constraints
psql $DATABASE_URL -c "SELECT conname FROM pg_constraint WHERE conrelid = 'product_discussions'::regclass;"
```

### Schema Validation

```bash
# TypeScript compilation should pass
npm run check

# Verify no references to old table names
grep -rn "forumTopics\|forumPosts\|forumCategories" shared/schema.ts
# Should return nothing (except in comments/strings)
```

### Application Testing

```bash
# Run all tests (should pass)
npm test

# Specifically test product routes
npm test server/routes/__tests__/product-routes.test.ts

# Check for runtime errors
npm run dev
# Visit product pages, check console for errors
```

## Success Criteria

- [ ] All 11 unused forum tables dropped from database
- [ ] User profile cleaned (7 forum fields removed)
- [ ] Tables renamed: `forumTopics` → `productDiscussions`, `forumPosts` → `discussionReplies`
- [ ] Schema updated with new table names and types
- [ ] All foreign key references updated
- [ ] TypeScript compilation passes (`npm run check`)
- [ ] All tests pass (`npm test`)
- [ ] No runtime errors in development
- [ ] Database migration runs successfully in production-like environment

## Rollback Plan

If migration fails:

```sql
-- Restore from backup
pg_restore --clean --if-exists -d pricecompare backup_before_forum_cleanup.dump

-- OR revert migrations
-- Manually reverse each migration in reverse order
```

## Related Issues

- [TODO_006](../todos/TODO_006_PRODUCT_DISCUSSION_COUNT.md) - Tests removed (completed)
- Future: Implement lightweight product discussion endpoints

## Estimated Effort

- **Phase 1 (Migrations)**: 2-3 hours (careful testing required)
- **Phase 2 (Schema)**: 1-2 hours (straightforward refactor)
- **Phase 3 (Storage)**: 1 hour (minimal cleanup)
- **Phase 4 (Routes)**: 0 hours (nothing to clean up currently)
- **Phase 5 (Client)**: 0-1 hours (verify no breaking changes)

**Total**: ~5-7 hours

## Notes

- **IMPORTANT**: Test migrations on development/staging before production
- Take database backup before running migrations
- Consider blue-green deployment for zero-downtime migration
- Document Discourse integration plan separately
- Product discussion endpoints can be implemented later when user demand grows

## Future Work (Separate Issues)

1. Implement product discussion CRUD endpoints
2. Add product discussion UI components
3. Integrate with Discourse SSO for unified authentication
4. Add Discourse embed on product pages for cross-platform discussions
5. Implement moderation tools for product discussions
