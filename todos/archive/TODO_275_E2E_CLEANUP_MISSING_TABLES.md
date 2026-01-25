# TODO 275: Update E2E Test Cleanup with Missing Tables

**Priority**: P2 (IMPORTANT - Test Reliability)
**File(s)**: `e2e/helpers.ts`
**Estimated Time**: 30 minutes
**Status**: Completed
**Completed Date**: 2026-01-25
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

The E2E test TRUNCATE list is missing 21 tables from the schema. While the dynamic table existence check prevents immediate failures, leftover data from previous test runs can cause inconsistent results.

## Root Cause

New tables were added via migrations but the E2E cleanup list wasn't updated.

## Evidence

**Previous tables in helpers.ts:145-151 (20 tables):**
```typescript
table_list TEXT[] := ARRAY[
  'users', 'products', 'product_offers', 'price_history', 'price_alerts',
  'watch_lists', 'notifications', 'retailers', 'password_reset_tokens',
  'notification_preferences', 'product_watches', 'watch_list_shares',
  'user_reputation', 'trending_products', 'search_queries', 'agent_sessions',
  'scraping_jobs', 'price_predictions', 'scraping_sources', 'price_snapshots'
];
```

**Missing tables from schema.ts:**
- price_aggregates_weekly
- price_aggregates_monthly
- price_aggregates_daily
- price_trends
- wishlists
- wishlist_items
- product_specifications
- product_urls
- job_locks
- forum_categories
- forum_topics
- forum_posts
- post_likes
- topic_tags
- topic_tag_relations
- post_mentions
- private_messages
- badges
- user_badges
- deal_spottings
- post_revisions
- user_compare_items (discovered during implementation)
- user_product_views (discovered during implementation)

## Solution Approach

Add all missing tables to the cleanup list, maintaining dependency order.

## Implementation Steps

### Step 1: Update Table List

- [x] Add all missing tables to helpers.ts
- [x] Ensure order respects FK dependencies
- [x] Test truncation doesn't fail

## Resolution

Updated `e2e/helpers.ts` table_list array from 20 tables to 41 tables, organized by FK dependency order:

```typescript
table_list TEXT[] := ARRAY[
  -- Core entities (no FK deps)
  'users', 'products', 'retailers', 'forum_categories', 'badges', 'topic_tags',

  -- First-level dependencies (depend only on core entities)
  'product_offers', 'watch_lists', 'notifications', 'password_reset_tokens',
  'notification_preferences', 'user_reputation', 'trending_products',
  'search_queries', 'agent_sessions', 'wishlists', 'user_badges',
  'scraping_sources', 'forum_topics', 'private_messages',
  'user_compare_items', 'user_product_views',

  -- Second-level dependencies (depend on first-level)
  'price_history', 'price_alerts', 'product_watches', 'watch_list_shares',
  'scraping_jobs', 'price_predictions', 'price_snapshots',
  'wishlist_items', 'product_specifications', 'product_urls', 'job_locks',
  'forum_posts', 'deal_spottings', 'topic_tag_relations',

  -- Third-level dependencies (depend on second-level)
  'price_aggregates_daily', 'price_aggregates_weekly', 'price_aggregates_monthly',
  'price_trends', 'post_likes', 'post_mentions', 'post_revisions'
];
```

## Checklist

- [x] All schema tables included (41 tables)
- [x] FK dependency order verified (CASCADE handles order automatically)
- [x] E2E tests pass with updated list
- [x] No "relation does not exist" errors

## Success Criteria

- [x] `npm run test:e2e` passes without cleanup errors (102 passed, 24 skipped)
- [x] All tables properly truncated between tests
- [x] No test pollution from previous runs

## Verification

E2E test run completed successfully:
- Schema validation: "all 41 tables present"
- Test results: 102 passed, 24 skipped, 0 failed
- Runtime: 10.4 minutes

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Completed by**: Code Review Resolution Specialist
**Completion Date**: 2026-01-25
**Agents**: data-integrity-guardian
