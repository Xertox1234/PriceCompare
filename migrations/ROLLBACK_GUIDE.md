# Migration Rollback Guide

This document provides comprehensive rollback procedures for all database migrations in PriceCompare. Each migration is categorized by risk level and includes specific rollback SQL statements.

## Table of Contents

- [General Rollback Strategy](#general-rollback-strategy)
- [Pre-Rollback Checklist](#pre-rollback-checklist)
- [Risk Classification](#risk-classification)
- [Migration Rollbacks](#migration-rollbacks)
  - [0001 - pgvector Embeddings](#0001---pgvector-embeddings)
  - [0002 - Performance Indexes](#0002---performance-indexes)
  - [0003 - Password Reset Tokens](#0003---password-reset-tokens)
  - [0004 - Price History](#0004---price-history)
  - [0005 - Notifications Enhancements](#0005---notifications-enhancements)
  - [0006 - Enhance Price Alerts](#0006---enhance-price-alerts)
  - [0007 - Community Features](#0007---community-features)
  - [0008 - Watch Lists](#0008---watch-lists)
  - [0009 - Price Aggregation](#0009---price-aggregation)
  - [0010 - Job Locks](#0010---job-locks)
  - [0011 - Cascade Rules](#0011---cascade-rules)
  - [0012 - PII Encryption](#0012---pii-encryption)
  - [0013 - Daily Price Aggregates](#0013---daily-price-aggregates)
  - [0014 - Aggregation Indexes](#0014---aggregation-indexes)
  - [0015 - Fix SET NULL Constraints](#0015---fix-set-null-constraints)
  - [0016 - Fix Data Integrity Issues](#0016---fix-data-integrity-issues)
  - [0017 - Wishlists and Specifications](#0017---wishlists-and-specifications)
  - [0018 - Forum Topic Title](#0018---forum-topic-title)
  - [0019 - Product Watches Unique Constraint](#0019---product-watches-unique-constraint)
  - [0020 - Price CHECK Constraints](#0020---price-check-constraints)
- [Emergency Procedures](#emergency-procedures)
- [Post-Rollback Verification](#post-rollback-verification)

---

## General Rollback Strategy

### When to Rollback

1. **Migration failed partway through** - Leaves database in inconsistent state
2. **Performance degradation** - New schema causes unacceptable slowdowns
3. **Application incompatibility** - Code changes not deployed with migration
4. **Data corruption discovered** - Migration introduced data issues
5. **Business decision** - Feature removed or changed

### Rollback Order

**CRITICAL**: Rollbacks must be executed in REVERSE order of migration application.

If you need to rollback to migration 0005:

1. Rollback 0016 first
2. Then 0015, 0014, 0013... down to 0006
3. Stop at 0005 (do not rollback)

### Backup First

**ALWAYS** create a backup before any rollback:

```bash
# PostgreSQL backup
pg_dump -Fc -h hostname -U username -d pricecompare > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore from backup if rollback fails
pg_restore -h hostname -U username -d pricecompare backup.dump
```

---

## Pre-Rollback Checklist

- [ ] Notify team of planned rollback
- [ ] Create full database backup
- [ ] Stop application servers
- [ ] Identify dependent migrations (must rollback in order)
- [ ] Review data loss implications
- [ ] Prepare rollback SQL in transaction
- [ ] Have DBA on standby for complex rollbacks
- [ ] Test rollback on staging first

---

## Risk Classification

| Risk Level   | Description                              | Examples                                           |
| ------------ | ---------------------------------------- | -------------------------------------------------- |
| **LOW**      | Safe to rollback, no data loss           | Index creation, adding nullable columns            |
| **MEDIUM**   | May require code changes                 | Trigger/function changes, constraint modifications |
| **HIGH**     | Causes data loss                         | Dropping tables, removing columns with data        |
| **CRITICAL** | Irreversible or requires decryption keys | Encryption migrations                              |

---

## Migration Rollbacks

### 0001 - pgvector Embeddings

**Risk Level**: MEDIUM
**Data Loss**: Yes - embedding data will be lost
**Code Impact**: Semantic search features will break

```sql
-- Rollback 0001_add_pgvector_embeddings.sql
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS products_embedding_idx;
DROP INDEX IF EXISTS products_name_gin_idx;
DROP INDEX IF EXISTS products_description_gin_idx;

-- Remove columns
ALTER TABLE products DROP COLUMN IF EXISTS embedding;
ALTER TABLE products DROP COLUMN IF EXISTS embedding_updated_at;

-- Remove extension (optional - may be used by other features)
-- DROP EXTENSION IF EXISTS vector;

COMMIT;
```

**Post-Rollback Actions**:

- Disable AI-powered product search endpoints
- Update frontend to use basic text search
- Remove embedding generation from product creation flow

---

### 0002 - Performance Indexes

**Risk Level**: LOW
**Data Loss**: No
**Code Impact**: Query performance may degrade

```sql
-- Rollback 0002_add_performance_indexes.sql
BEGIN;

-- Remove trigger first
DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
DROP FUNCTION IF EXISTS products_search_vector_update();

-- Remove search vector column
ALTER TABLE products DROP COLUMN IF EXISTS search_vector;

-- Remove product indexes
DROP INDEX IF EXISTS idx_products_search;
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_brand;
DROP INDEX IF EXISTS idx_products_created_at;

-- Remove offer indexes
DROP INDEX IF EXISTS idx_offers_product_id;
DROP INDEX IF EXISTS idx_offers_retailer_id;
DROP INDEX IF EXISTS idx_offers_price;
DROP INDEX IF EXISTS idx_offers_rating;
DROP INDEX IF EXISTS idx_offers_availability;
DROP INDEX IF EXISTS idx_offers_last_updated;
DROP INDEX IF EXISTS idx_offers_product_price;
DROP INDEX IF EXISTS idx_offers_product_rating;

-- Remove retailer indexes
DROP INDEX IF EXISTS idx_retailers_active;
DROP INDEX IF EXISTS idx_retailers_affiliate_status;

-- Remove user indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_role;

-- Remove forum indexes
DROP INDEX IF EXISTS idx_forum_topics_category;
DROP INDEX IF EXISTS idx_forum_topics_product;
DROP INDEX IF EXISTS idx_forum_topics_author;
DROP INDEX IF EXISTS idx_forum_topics_created;
DROP INDEX IF EXISTS idx_forum_posts_topic;
DROP INDEX IF EXISTS idx_forum_posts_author;
DROP INDEX IF EXISTS idx_forum_posts_created;

-- Remove price alert indexes
DROP INDEX IF EXISTS idx_price_alerts_user;
DROP INDEX IF EXISTS idx_price_alerts_product;
DROP INDEX IF EXISTS idx_price_alerts_active;

COMMIT;
```

**Post-Rollback Actions**:

- Monitor query performance
- Consider adding back critical indexes individually

---

### 0003 - Password Reset Tokens

**Risk Level**: HIGH
**Data Loss**: Yes - all password reset tokens lost
**Code Impact**: Password reset feature will break

```sql
-- Rollback 0003_add_password_reset_tokens.sql
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS password_reset_tokens_user_id_idx;
DROP INDEX IF EXISTS password_reset_tokens_token_idx;
DROP INDEX IF EXISTS password_reset_tokens_expires_at_idx;

-- Remove table (ALL DATA WILL BE LOST)
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

COMMIT;
```

**Post-Rollback Actions**:

- Disable password reset endpoint
- Remove password reset email functionality
- Update authentication routes to return 503 for reset requests

---

### 0004 - Price History

**Risk Level**: HIGH
**Data Loss**: Yes - all price history data lost
**Code Impact**: Price graphs and trend analysis break

```sql
-- Rollback 0004_add_price_history.sql
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS idx_price_history_product_id;
DROP INDEX IF EXISTS idx_price_history_offer_id;
DROP INDEX IF EXISTS idx_price_history_retailer_id;
DROP INDEX IF EXISTS idx_price_history_recorded_at;
DROP INDEX IF EXISTS idx_price_history_product_retailer_time;
DROP INDEX IF EXISTS idx_price_history_product_price;

-- Remove table (ALL PRICE HISTORY DATA WILL BE LOST)
DROP TABLE IF EXISTS price_history CASCADE;

COMMIT;
```

**Post-Rollback Actions**:

- Disable price history API endpoints
- Remove price trend charts from product pages
- Stop price snapshot scheduled jobs

---

### 0005 - Notifications Enhancements

**Risk Level**: MEDIUM
**Data Loss**: Yes - notification preferences lost
**Code Impact**: Price drop notifications break

```sql
-- Rollback 0005_add_notifications_enhancements.sql
BEGIN;

-- Remove triggers
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON users;
DROP TRIGGER IF EXISTS trigger_update_notification_preferences_timestamp ON notification_preferences;
DROP FUNCTION IF EXISTS create_default_notification_preferences();
DROP FUNCTION IF EXISTS update_notification_preferences_updated_at();

-- Remove indexes
DROP INDEX IF EXISTS idx_notifications_product;
DROP INDEX IF EXISTS idx_notifications_type_user;
DROP INDEX IF EXISTS idx_notif_prefs_user;

-- Remove notification preferences table
DROP TABLE IF EXISTS notification_preferences CASCADE;

-- Remove column from notifications (preserves notification data)
ALTER TABLE notifications DROP COLUMN IF EXISTS related_product_id;

COMMIT;
```

**Post-Rollback Actions**:

- Disable notification preference settings in UI
- Use default notification behavior
- Remove price drop notification logic

---

### 0006 - Enhance Price Alerts

**Risk Level**: MEDIUM
**Data Loss**: Yes - alert tracking data lost
**Code Impact**: Smart alert suggestions break

```sql
-- Rollback 0006_enhance_price_alerts.sql
BEGIN;

-- Remove trigger
DROP TRIGGER IF EXISTS trigger_update_price_alerts_timestamp ON price_alerts;
DROP FUNCTION IF EXISTS update_price_alerts_updated_at();

-- Remove indexes
DROP INDEX IF EXISTS idx_price_alerts_user_active;
DROP INDEX IF EXISTS idx_price_alerts_product;
DROP INDEX IF EXISTS idx_price_alerts_triggered;
DROP INDEX IF EXISTS idx_price_alerts_suggested;

-- Remove columns from price_alerts
ALTER TABLE price_alerts DROP COLUMN IF EXISTS price_when_created;
ALTER TABLE price_alerts DROP COLUMN IF EXISTS times_triggered;
ALTER TABLE price_alerts DROP COLUMN IF EXISTS last_triggered_at;
ALTER TABLE price_alerts DROP COLUMN IF EXISTS suggested_by_system;
ALTER TABLE price_alerts DROP COLUMN IF EXISTS suggestion_reason;
ALTER TABLE price_alerts DROP COLUMN IF EXISTS updated_at;

COMMIT;
```

**Post-Rollback Actions**:

- Disable smart alert suggestions
- Remove alert effectiveness tracking from dashboard

---

### 0007 - Community Features

**Risk Level**: HIGH
**Data Loss**: Yes - reputation, watches, deal spottings lost
**Code Impact**: Community/gamification features break

```sql
-- Rollback 0007_add_community_features.sql
BEGIN;

-- Remove triggers
DROP TRIGGER IF EXISTS trigger_create_user_reputation ON users;
DROP TRIGGER IF EXISTS trigger_update_user_reputation_timestamp ON user_reputation;
DROP FUNCTION IF EXISTS create_default_user_reputation();
DROP FUNCTION IF EXISTS update_user_reputation_updated_at();

-- Remove indexes
DROP INDEX IF EXISTS idx_product_watches_user;
DROP INDEX IF EXISTS idx_product_watches_product;
DROP INDEX IF EXISTS idx_product_watches_created;
DROP INDEX IF EXISTS idx_user_reputation_user;
DROP INDEX IF EXISTS idx_user_reputation_points;
DROP INDEX IF EXISTS idx_user_reputation_level;
DROP INDEX IF EXISTS idx_deal_spottings_user;
DROP INDEX IF EXISTS idx_deal_spottings_product;
DROP INDEX IF EXISTS idx_deal_spottings_created;
DROP INDEX IF EXISTS idx_deal_spottings_drop_percent;

-- Remove tables (DATA WILL BE LOST)
DROP TABLE IF EXISTS deal_spottings CASCADE;
DROP TABLE IF EXISTS user_reputation CASCADE;
DROP TABLE IF EXISTS product_watches CASCADE;

COMMIT;
```

**Post-Rollback Actions**:

- Disable community features in UI
- Remove leaderboard endpoints
- Remove deal spotting notifications

---

### 0008 - Watch Lists

**Risk Level**: HIGH
**Data Loss**: Yes - watch lists and enhanced watch data lost
**Code Impact**: Watch list organization features break

```sql
-- Rollback 0008_add_watch_lists.sql
BEGIN;

-- Remove triggers
DROP TRIGGER IF EXISTS trigger_create_default_watch_list ON users;
DROP TRIGGER IF EXISTS trigger_update_watch_list_timestamp ON watch_lists;
DROP TRIGGER IF EXISTS trigger_update_product_watch_timestamp ON product_watches;
DROP FUNCTION IF EXISTS create_default_watch_list();
DROP FUNCTION IF EXISTS update_watch_list_updated_at();
DROP FUNCTION IF EXISTS update_product_watch_updated_at();
DROP FUNCTION IF EXISTS refresh_watch_list_stats();

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS watch_list_stats;

-- Remove indexes on product_watches
DROP INDEX IF EXISTS idx_product_watches_list;
DROP INDEX IF EXISTS idx_product_watches_category;
DROP INDEX IF EXISTS idx_product_watches_priority;
DROP INDEX IF EXISTS idx_product_watches_updated;

-- Remove watch list indexes
DROP INDEX IF EXISTS idx_watch_lists_user;
DROP INDEX IF EXISTS idx_watch_lists_default;
DROP INDEX IF EXISTS idx_watch_list_stats_user;

-- Drop constraint changes on product_watches
ALTER TABLE product_watches DROP CONSTRAINT IF EXISTS unique_user_product_list;

-- Remove columns from product_watches
ALTER TABLE product_watches DROP COLUMN IF EXISTS watch_list_id;
ALTER TABLE product_watches DROP COLUMN IF EXISTS category;
ALTER TABLE product_watches DROP COLUMN IF EXISTS notes;
ALTER TABLE product_watches DROP COLUMN IF EXISTS priority;
ALTER TABLE product_watches DROP COLUMN IF EXISTS target_price;
ALTER TABLE product_watches DROP COLUMN IF EXISTS updated_at;

-- Restore original unique constraint
ALTER TABLE product_watches ADD CONSTRAINT product_watches_user_id_product_id_key UNIQUE(user_id, product_id);

-- Drop watch_lists table
DROP TABLE IF EXISTS watch_lists CASCADE;

COMMIT;
```

**Post-Rollback Actions**:

- Disable watch list management UI
- Revert to simple product watch functionality
- Remove priority and category filtering

---

### 0009 - Price Aggregation

**Risk Level**: HIGH
**Data Loss**: Yes - all aggregated analytics data lost
**Code Impact**: Price analytics dashboard breaks

```sql
-- Rollback 0009_add_price_aggregation.sql
BEGIN;

-- Remove triggers
DROP TRIGGER IF EXISTS update_price_aggregates_weekly_updated_at ON price_aggregates_weekly;
DROP TRIGGER IF EXISTS update_price_aggregates_monthly_updated_at ON price_aggregates_monthly;
DROP TRIGGER IF EXISTS update_price_trends_updated_at ON price_trends;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Remove indexes
DROP INDEX IF EXISTS idx_weekly_product_year;
DROP INDEX IF EXISTS idx_weekly_retailer_year;
DROP INDEX IF EXISTS idx_weekly_created;
DROP INDEX IF EXISTS idx_monthly_product_year;
DROP INDEX IF EXISTS idx_monthly_retailer_year;
DROP INDEX IF EXISTS idx_monthly_created;
DROP INDEX IF EXISTS idx_trends_product;
DROP INDEX IF EXISTS idx_trends_retailer;
DROP INDEX IF EXISTS idx_trends_direction;
DROP INDEX IF EXISTS idx_trends_analyzed;

-- Drop tables (ALL ANALYTICS DATA WILL BE LOST)
DROP TABLE IF EXISTS price_trends CASCADE;
DROP TABLE IF EXISTS price_aggregates_monthly CASCADE;
DROP TABLE IF EXISTS price_aggregates_weekly CASCADE;

COMMIT;
```

**Post-Rollback Actions**:

- Disable price analytics dashboard
- Stop weekly/monthly aggregation jobs
- Remove trend analysis endpoints

---

### 0010 - Job Locks

**Risk Level**: LOW
**Data Loss**: Minimal - only active locks lost
**Code Impact**: Jobs may run concurrently (potential duplicates)

```sql
-- Rollback 0010_add_job_locks.sql
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS idx_job_locks_name;
DROP INDEX IF EXISTS idx_job_locks_expires;

-- Drop table
DROP TABLE IF EXISTS job_locks CASCADE;

COMMIT;
```

**Post-Rollback Actions**:

- Warning: Jobs may execute concurrently on multiple servers
- Consider disabling scheduled jobs temporarily
- Implement application-level locking as fallback

---

### 0011 - Cascade Rules

**Risk Level**: MEDIUM
**Data Loss**: No (only changes constraints)
**Code Impact**: Orphan records may accumulate after deletions

```sql
-- Rollback 0011_add_cascade_rules.sql
-- WARNING: This removes CASCADE rules and restores NO ACTION (default)
-- This is a large rollback - test thoroughly on staging first

BEGIN;

-- PRODUCT_OFFERS: Remove CASCADE rules
ALTER TABLE product_offers
  DROP CONSTRAINT IF EXISTS product_offers_product_id_products_id_fk;
ALTER TABLE product_offers
  ADD CONSTRAINT product_offers_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id);

ALTER TABLE product_offers
  DROP CONSTRAINT IF EXISTS product_offers_retailer_id_retailers_id_fk;
ALTER TABLE product_offers
  ADD CONSTRAINT product_offers_retailer_id_retailers_id_fk
    FOREIGN KEY (retailer_id) REFERENCES retailers(id);

-- PRICE_HISTORY: Remove CASCADE rules
ALTER TABLE price_history
  DROP CONSTRAINT IF EXISTS price_history_product_offer_id_product_offers_id_fk;
ALTER TABLE price_history
  ADD CONSTRAINT price_history_product_offer_id_product_offers_id_fk
    FOREIGN KEY (product_offer_id) REFERENCES product_offers(id);

ALTER TABLE price_history
  DROP CONSTRAINT IF EXISTS price_history_product_id_products_id_fk;
ALTER TABLE price_history
  ADD CONSTRAINT price_history_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id);

ALTER TABLE price_history
  DROP CONSTRAINT IF EXISTS price_history_retailer_id_retailers_id_fk;
ALTER TABLE price_history
  ADD CONSTRAINT price_history_retailer_id_retailers_id_fk
    FOREIGN KEY (retailer_id) REFERENCES retailers(id);

-- Continue for other tables as needed...
-- Full rollback would require reversing all 51 foreign key changes

-- Note: For brevity, showing pattern. Full rollback would need all tables:
-- forum_categories, forum_topics, forum_posts, price_alerts, post_likes,
-- notifications, notification_preferences, topic_tag_relations, post_mentions,
-- private_messages, user_badges, watch_lists, product_watches, user_reputation,
-- deal_spottings, post_revisions, trending_products, search_queries,
-- scraping_jobs, price_predictions, price_snapshots, product_urls

COMMIT;
```

**Post-Rollback Actions**:

- Implement manual cleanup for orphaned records
- Add application-level deletion handlers
- Schedule regular orphan cleanup jobs

---

### 0012 - PII Encryption

**Risk Level**: CRITICAL
**Data Loss**: ENCRYPTED DATA BECOMES UNREADABLE without key
**Code Impact**: All PII fields become unreadable

**WARNING**: This rollback is ONLY possible if:

1. You have the original `ENCRYPTION_KEY`
2. You have not lost access to encrypted data

```sql
-- Rollback 0012_encrypt_pii_data_at_rest.sql
-- CRITICAL: Run the decryption script BEFORE this SQL rollback

-- Step 1: Run decryption script (Node.js)
-- npm run migrate:decrypt-pii-data

-- Step 2: After decryption completes, rollback column types
BEGIN;

-- Revert column types (after decryption)
ALTER TABLE users
  ALTER COLUMN email TYPE varchar(255);

ALTER TABLE password_reset_tokens
  ALTER COLUMN ip_address TYPE varchar(45),
  ALTER COLUMN user_agent TYPE varchar(500);

ALTER TABLE private_messages
  ALTER COLUMN subject TYPE varchar(255),
  ALTER COLUMN content TYPE text;

-- Remove encryption comments
COMMENT ON COLUMN users.email IS NULL;
COMMENT ON COLUMN password_reset_tokens.ip_address IS NULL;
COMMENT ON COLUMN password_reset_tokens.user_agent IS NULL;
COMMENT ON COLUMN private_messages.subject IS NULL;
COMMENT ON COLUMN private_messages.content IS NULL;
COMMENT ON COLUMN notifications.content IS NULL;

COMMIT;
```

**Pre-Rollback Requirements**:

1. Have `ENCRYPTION_KEY` available
2. Run decryption script to convert encrypted data back to plaintext
3. Verify decryption succeeded before changing column types

**Post-Rollback Actions**:

- Update Drizzle schema to remove encryptedText type
- Update application to not use encryption utilities
- Document security posture change (GDPR implications)

---

### 0013 - Daily Price Aggregates

**Risk Level**: MEDIUM
**Data Loss**: Yes - daily aggregates and aggregation tracking lost
**Code Impact**: Daily aggregation jobs break

```sql
-- Rollback 0013_add_daily_price_aggregates.sql
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS idx_price_history_aggregated_at;
DROP INDEX IF EXISTS daily_product_date_idx;
DROP INDEX IF EXISTS daily_retailer_date_idx;
DROP INDEX IF EXISTS daily_date_idx;
DROP INDEX IF EXISTS daily_created_idx;
DROP INDEX IF EXISTS unique_product_retailer_date;

-- Remove column from price_history
ALTER TABLE price_history DROP COLUMN IF EXISTS aggregated_at;

-- Drop daily aggregates table
DROP TABLE IF EXISTS price_aggregates_daily CASCADE;

COMMIT;
```

**Post-Rollback Actions**:

- Disable daily aggregation jobs
- Update aggregation service to skip daily processing
- Adjust data lifecycle configuration

---

### 0014 - Aggregation Indexes

**Risk Level**: LOW
**Data Loss**: No
**Code Impact**: Aggregation queries become slower

```sql
-- Rollback 0014_add_aggregation_indexes.sql
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS idx_price_history_product_recorded;
DROP INDEX IF EXISTS idx_price_history_retailer_recorded;
DROP INDEX IF EXISTS idx_price_history_recorded_desc;

COMMIT;
```

**Post-Rollback Actions**:

- Monitor query performance on price_history table
- Consider adding back critical indexes if performance degrades

---

### 0015 - Fix SET NULL Constraints

**Risk Level**: MEDIUM
**Data Loss**: No
**Code Impact**: User deletion may fail with constraint violations

```sql
-- Rollback 0015_fix_set_null_constraints.sql
-- WARNING: This restores NOT NULL constraints
-- User deletion will fail if forum content exists

BEGIN;

-- Restore NOT NULL constraints
-- Note: These will FAIL if any NULL values exist in these columns

-- Check for NULL values first
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM forum_topics WHERE author_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot rollback: NULL values exist in forum_topics.author_id';
  END IF;
  IF EXISTS (SELECT 1 FROM forum_posts WHERE author_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot rollback: NULL values exist in forum_posts.author_id';
  END IF;
  IF EXISTS (SELECT 1 FROM post_revisions WHERE edited_by_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot rollback: NULL values exist in post_revisions.edited_by_id';
  END IF;
END $$;

ALTER TABLE forum_topics ALTER COLUMN author_id SET NOT NULL;
ALTER TABLE forum_posts ALTER COLUMN author_id SET NOT NULL;
ALTER TABLE post_revisions ALTER COLUMN edited_by_id SET NOT NULL;

COMMIT;
```

**Post-Rollback Actions**:

- User deletion will cascade-delete all their forum content
- Update user deletion logic to handle constraint failures
- Consider soft-delete instead of hard-delete for users

---

### 0016 - Fix Data Integrity Issues

**Risk Level**: MEDIUM
**Data Loss**: No
**Code Impact**: Duplicate likes/badges/mentions possible again

```sql
-- Rollback 0016_fix_data_integrity_issues.sql
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS notifications_user_type_idx;
DROP INDEX IF EXISTS forum_topics_slug_idx;

-- Remove unique constraints
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS unique_post_user_like;
ALTER TABLE user_badges DROP CONSTRAINT IF EXISTS unique_user_badge;
ALTER TABLE topic_tag_relations DROP CONSTRAINT IF EXISTS unique_topic_tag;
ALTER TABLE post_mentions DROP CONSTRAINT IF EXISTS unique_post_mention;

-- Restore NOT NULL on private_messages.sender_id
-- Note: Will FAIL if NULL values exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM private_messages WHERE sender_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot rollback: NULL values exist in private_messages.sender_id';
  END IF;
END $$;

ALTER TABLE private_messages ALTER COLUMN sender_id SET NOT NULL;

COMMIT;
```

**Post-Rollback Actions**:

- Add application-level duplicate prevention
- User deletion will fail if they sent private messages
- Monitor for duplicate data creation

---

### 0017 - Wishlists and Specifications

**Risk Level**: HIGH
**Data Loss**: Yes - all wishlists and product specifications lost
**Code Impact**: Wishlist and specification features break

```sql
-- Rollback 0017_add_wishlists_and_specifications.sql
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS wishlists_user_id_idx;
DROP INDEX IF EXISTS wishlist_items_wishlist_id_idx;
DROP INDEX IF EXISTS wishlist_items_user_id_idx;
DROP INDEX IF EXISTS wishlist_items_product_id_idx;
DROP INDEX IF EXISTS product_specs_product_id_idx;
DROP INDEX IF EXISTS product_specs_group_idx;

-- Drop tables (DATA WILL BE LOST)
DROP TABLE IF EXISTS wishlist_items CASCADE;
DROP TABLE IF EXISTS wishlists CASCADE;
DROP TABLE IF EXISTS product_specifications CASCADE;

COMMIT;
```

**Post-Rollback Actions**:

- Disable wishlist features in UI
- Remove product specifications from product detail pages
- Update API to return 404 for wishlist endpoints

---

### 0018 - Forum Topic Title

**Risk Level**: LOW
**Data Loss**: No (data preserved, long titles may be truncated)
**Code Impact**: Long topic titles may be truncated

```sql
-- Rollback 0018_change_forum_topic_title_to_text.sql
BEGIN;

-- Revert to VARCHAR(255) - WARNING: Long titles will be truncated!
ALTER TABLE forum_topics ALTER COLUMN title TYPE varchar(255);

COMMIT;
```

**Post-Rollback Actions**:

- Check for truncated titles after rollback
- Add title length validation in UI (255 char limit)

---

### 0019 - Product Watches Unique Constraint

**Risk Level**: MEDIUM
**Data Loss**: No
**Code Impact**: Duplicate watches possible when watch_list_id is NULL

```sql
-- Rollback 0019_fix_product_watches_unique_constraint.sql
BEGIN;

-- Remove the partial index for NULL case
DROP INDEX IF EXISTS unique_user_product_no_list;

-- Remove the new constraint
ALTER TABLE product_watches DROP CONSTRAINT IF EXISTS unique_user_product_list;

-- Restore original simple unique constraint
ALTER TABLE product_watches
  ADD CONSTRAINT product_watches_user_id_product_id_watch_list_id_key
  UNIQUE(user_id, product_id, watch_list_id);

COMMIT;
```

**Post-Rollback Actions**:

- Duplicate product watches possible when watch_list_id is NULL
- Add application-level duplicate checking
- Monitor for duplicate entries

---

### 0020 - Price CHECK Constraints

**Risk Level**: LOW
**Data Loss**: No
**Code Impact**: Invalid price data can be inserted again

```sql
-- Rollback 0020_add_price_check_constraints.sql
BEGIN;

-- Remove constraints from product_offers
ALTER TABLE product_offers DROP CONSTRAINT IF EXISTS check_product_offers_price_positive;
ALTER TABLE product_offers DROP CONSTRAINT IF EXISTS check_product_offers_original_price_positive;
ALTER TABLE product_offers DROP CONSTRAINT IF EXISTS check_product_offers_price_logical;

-- Remove constraints from price_history
ALTER TABLE price_history DROP CONSTRAINT IF EXISTS check_price_history_price_positive;
ALTER TABLE price_history DROP CONSTRAINT IF EXISTS check_price_history_original_price_positive;

-- Remove constraints from price_alerts
ALTER TABLE price_alerts DROP CONSTRAINT IF EXISTS check_price_alerts_target_price_positive;
ALTER TABLE price_alerts DROP CONSTRAINT IF EXISTS check_price_alerts_price_when_created_positive;

-- Remove constraints from price_snapshots
ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS check_price_snapshots_prices_positive;
ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS check_price_snapshots_range_valid;
ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS check_price_snapshots_avg_in_range;

COMMIT;
```

**Post-Rollback Actions**:

- **WARNING**: Invalid prices can be inserted without database-level validation
- Add application-level price validation as fallback
- Consider adding Zod validation for all price fields
- Monitor for invalid price data

---

## Emergency Procedures

### Complete Database Reset

If you need to completely reset the database to a clean state:

```bash
# 1. Create final backup
pg_dump -Fc pricecompare > final_backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Drop and recreate database
dropdb pricecompare
createdb pricecompare

# 3. Run base schema
npm run db:push

# 4. Apply migrations from scratch
npm run migrate
```

### Restore from Backup

```bash
# Restore full database from backup
pg_restore -h hostname -U username -d pricecompare --clean backup.dump

# Or for plain SQL backup
psql -h hostname -U username -d pricecompare < backup.sql
```

### Point-in-Time Recovery (PITR)

If using a managed database with PITR:

1. Identify the timestamp before the problematic migration
2. Create new database restored to that point
3. Migrate application to new database
4. Validate data integrity

---

## Post-Rollback Verification

After any rollback, verify the database state:

```sql
-- Check tables exist/don't exist as expected
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check for orphaned records (after cascade rule rollback)
SELECT COUNT(*) FROM product_offers WHERE product_id NOT IN (SELECT id FROM products);
SELECT COUNT(*) FROM price_history WHERE product_id NOT IN (SELECT id FROM products);

-- Check constraints
SELECT conname, conrelid::regclass, contype
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace;

-- Check indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

-- Verify application connectivity
-- Run health check endpoints
```

---

## Contact Information

For emergency database assistance:

- **On-call DBA**: Check PagerDuty rotation
- **Database Documentation**: See `docs/DATABASE_PATTERNS.md`
- **Schema Reference**: See `shared/schema.ts`

---

_Last updated: 2025-12-01_
_Document version: 1.1_
