# TODO 275: Update E2E Test Cleanup with Missing Tables

**Priority**: P2 (IMPORTANT - Test Reliability)
**File(s)**: `e2e/helpers.ts`
**Estimated Time**: 30 minutes
**Status**: Not Started
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

The E2E test TRUNCATE list is missing 21 tables from the schema. While the dynamic table existence check prevents immediate failures, leftover data from previous test runs can cause inconsistent results.

## Root Cause

New tables were added via migrations but the E2E cleanup list wasn't updated.

## Evidence

**Current tables in helpers.ts:145-151:**
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

## Solution Approach

Add all missing tables to the cleanup list, maintaining dependency order.

## Implementation Steps

### Step 1: Update Table List

- [ ] Add all missing tables to helpers.ts
- [ ] Ensure order respects FK dependencies
- [ ] Test truncation doesn't fail

## Technical Details

**Updated list (respecting FK order):**
```typescript
table_list TEXT[] := ARRAY[
  -- Core entities (no FK deps)
  'users', 'products', 'retailers', 'forum_categories', 'badges',

  -- First-level dependencies
  'product_offers', 'watch_lists', 'notifications', 'password_reset_tokens',
  'notification_preferences', 'user_reputation', 'trending_products',
  'search_queries', 'agent_sessions', 'wishlists', 'user_badges',

  -- Second-level dependencies
  'price_history', 'price_alerts', 'product_watches', 'watch_list_shares',
  'scraping_jobs', 'price_predictions', 'scraping_sources', 'price_snapshots',
  'wishlist_items', 'product_specifications', 'product_urls', 'job_locks',
  'forum_topics', 'deal_spottings',

  -- Third-level dependencies
  'price_aggregates_daily', 'price_aggregates_weekly', 'price_aggregates_monthly',
  'price_trends', 'forum_posts', 'topic_tags',

  -- Fourth-level dependencies
  'post_likes', 'topic_tag_relations', 'post_mentions', 'post_revisions',
  'private_messages'
];
```

## Checklist

- [ ] All schema tables included
- [ ] FK dependency order verified
- [ ] E2E tests pass with updated list
- [ ] No "relation does not exist" errors

## Success Criteria

- [ ] `npm run test:e2e` passes without cleanup errors
- [ ] All tables properly truncated between tests
- [ ] No test pollution from previous runs

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: data-integrity-guardian
