-- Migration: Add Missing Foreign Key Cascade Rules
-- Description: Adds ON DELETE CASCADE/SET NULL to all foreign keys for data integrity
-- Author: Claude (data-integrity-guardian agent)
-- Date: 2025-11-18
-- Issue: #59

-- CRITICAL: This migration fixes orphaned record accumulation by ensuring referential integrity
-- through proper cascade rules on all foreign key constraints.

-- =============================================================================
-- TABLE: product_offers
-- Strategy: CASCADE - Offers are meaningless without products/retailers
-- =============================================================================

ALTER TABLE product_offers
  DROP CONSTRAINT IF EXISTS product_offers_product_id_products_id_fk,
  ADD CONSTRAINT product_offers_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE product_offers
  DROP CONSTRAINT IF EXISTS product_offers_retailer_id_retailers_id_fk,
  ADD CONSTRAINT product_offers_retailer_id_retailers_id_fk
    FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: price_history
-- Strategy: CASCADE - Price history is meaningless without offers/products/retailers
-- =============================================================================

ALTER TABLE price_history
  DROP CONSTRAINT IF EXISTS price_history_product_offer_id_product_offers_id_fk,
  ADD CONSTRAINT price_history_product_offer_id_product_offers_id_fk
    FOREIGN KEY (product_offer_id) REFERENCES product_offers(id) ON DELETE CASCADE;

ALTER TABLE price_history
  DROP CONSTRAINT IF EXISTS price_history_product_id_products_id_fk,
  ADD CONSTRAINT price_history_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE price_history
  DROP CONSTRAINT IF EXISTS price_history_retailer_id_retailers_id_fk,
  ADD CONSTRAINT price_history_retailer_id_retailers_id_fk
    FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: forum_categories
-- Strategy: SET NULL - Subcategory can exist without parent
-- =============================================================================

ALTER TABLE forum_categories
  DROP CONSTRAINT IF EXISTS forum_categories_parent_id_forum_categories_id_fk,
  ADD CONSTRAINT forum_categories_parent_id_forum_categories_id_fk
    FOREIGN KEY (parent_id) REFERENCES forum_categories(id) ON DELETE SET NULL;

-- =============================================================================
-- TABLE: forum_topics
-- Strategy: SET NULL - Topics persist, references become null
-- =============================================================================

ALTER TABLE forum_topics
  DROP CONSTRAINT IF EXISTS forum_topics_category_id_forum_categories_id_fk,
  ADD CONSTRAINT forum_topics_category_id_forum_categories_id_fk
    FOREIGN KEY (category_id) REFERENCES forum_categories(id) ON DELETE SET NULL;

ALTER TABLE forum_topics
  DROP CONSTRAINT IF EXISTS forum_topics_author_id_users_id_fk,
  ADD CONSTRAINT forum_topics_author_id_users_id_fk
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE forum_topics
  DROP CONSTRAINT IF EXISTS forum_topics_product_id_products_id_fk,
  ADD CONSTRAINT forum_topics_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- =============================================================================
-- TABLE: forum_posts
-- Strategy: Mixed - CASCADE for topic, SET NULL for authors/editors
-- =============================================================================

ALTER TABLE forum_posts
  DROP CONSTRAINT IF EXISTS forum_posts_topic_id_forum_topics_id_fk,
  ADD CONSTRAINT forum_posts_topic_id_forum_topics_id_fk
    FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE;

ALTER TABLE forum_posts
  DROP CONSTRAINT IF EXISTS forum_posts_author_id_users_id_fk,
  ADD CONSTRAINT forum_posts_author_id_users_id_fk
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE forum_posts
  DROP CONSTRAINT IF EXISTS forum_posts_reply_to_post_id_forum_posts_id_fk,
  ADD CONSTRAINT forum_posts_reply_to_post_id_forum_posts_id_fk
    FOREIGN KEY (reply_to_post_id) REFERENCES forum_posts(id) ON DELETE SET NULL;

ALTER TABLE forum_posts
  DROP CONSTRAINT IF EXISTS forum_posts_edited_by_id_users_id_fk,
  ADD CONSTRAINT forum_posts_edited_by_id_users_id_fk
    FOREIGN KEY (edited_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- =============================================================================
-- TABLE: price_alerts
-- Strategy: CASCADE - Alerts die with user/product
-- =============================================================================

ALTER TABLE price_alerts
  DROP CONSTRAINT IF EXISTS price_alerts_user_id_users_id_fk,
  ADD CONSTRAINT price_alerts_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE price_alerts
  DROP CONSTRAINT IF EXISTS price_alerts_product_id_products_id_fk,
  ADD CONSTRAINT price_alerts_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: post_likes
-- Strategy: CASCADE - Likes die with post/user
-- =============================================================================

ALTER TABLE post_likes
  DROP CONSTRAINT IF EXISTS post_likes_post_id_forum_posts_id_fk,
  ADD CONSTRAINT post_likes_post_id_forum_posts_id_fk
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE;

ALTER TABLE post_likes
  DROP CONSTRAINT IF EXISTS post_likes_user_id_users_id_fk,
  ADD CONSTRAINT post_likes_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: notifications
-- Strategy: CASCADE for userId, SET NULL for related entities
-- =============================================================================

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_users_id_fk,
  ADD CONSTRAINT notifications_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_related_post_id_forum_posts_id_fk,
  ADD CONSTRAINT notifications_related_post_id_forum_posts_id_fk
    FOREIGN KEY (related_post_id) REFERENCES forum_posts(id) ON DELETE SET NULL;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_related_topic_id_forum_topics_id_fk,
  ADD CONSTRAINT notifications_related_topic_id_forum_topics_id_fk
    FOREIGN KEY (related_topic_id) REFERENCES forum_topics(id) ON DELETE SET NULL;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_related_user_id_users_id_fk,
  ADD CONSTRAINT notifications_related_user_id_users_id_fk
    FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_related_product_id_products_id_fk,
  ADD CONSTRAINT notifications_related_product_id_products_id_fk
    FOREIGN KEY (related_product_id) REFERENCES products(id) ON DELETE SET NULL;

-- =============================================================================
-- TABLE: notification_preferences
-- Strategy: CASCADE - Preferences die with user
-- =============================================================================

ALTER TABLE notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_users_id_fk,
  ADD CONSTRAINT notification_preferences_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: topic_tag_relations
-- Strategy: CASCADE - Relation dies with topic/tag
-- =============================================================================

ALTER TABLE topic_tag_relations
  DROP CONSTRAINT IF EXISTS topic_tag_relations_topic_id_forum_topics_id_fk,
  ADD CONSTRAINT topic_tag_relations_topic_id_forum_topics_id_fk
    FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE;

ALTER TABLE topic_tag_relations
  DROP CONSTRAINT IF EXISTS topic_tag_relations_tag_id_topic_tags_id_fk,
  ADD CONSTRAINT topic_tag_relations_tag_id_topic_tags_id_fk
    FOREIGN KEY (tag_id) REFERENCES topic_tags(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: post_mentions
-- Strategy: CASCADE - Mentions die with post/users
-- =============================================================================

ALTER TABLE post_mentions
  DROP CONSTRAINT IF EXISTS post_mentions_post_id_forum_posts_id_fk,
  ADD CONSTRAINT post_mentions_post_id_forum_posts_id_fk
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE;

ALTER TABLE post_mentions
  DROP CONSTRAINT IF EXISTS post_mentions_mentioned_user_id_users_id_fk,
  ADD CONSTRAINT post_mentions_mentioned_user_id_users_id_fk
    FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE post_mentions
  DROP CONSTRAINT IF EXISTS post_mentions_mentioning_user_id_users_id_fk,
  ADD CONSTRAINT post_mentions_mentioning_user_id_users_id_fk
    FOREIGN KEY (mentioning_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: private_messages
-- Strategy: SET NULL for sender, CASCADE for recipient (privacy)
-- =============================================================================

ALTER TABLE private_messages
  DROP CONSTRAINT IF EXISTS private_messages_sender_id_users_id_fk,
  ADD CONSTRAINT private_messages_sender_id_users_id_fk
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE private_messages
  DROP CONSTRAINT IF EXISTS private_messages_recipient_id_users_id_fk,
  ADD CONSTRAINT private_messages_recipient_id_users_id_fk
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: user_badges
-- Strategy: CASCADE - Badge assignment dies with user/badge
-- =============================================================================

ALTER TABLE user_badges
  DROP CONSTRAINT IF EXISTS user_badges_user_id_users_id_fk,
  ADD CONSTRAINT user_badges_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_badges
  DROP CONSTRAINT IF EXISTS user_badges_badge_id_badges_id_fk,
  ADD CONSTRAINT user_badges_badge_id_badges_id_fk
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: watch_lists
-- Strategy: CASCADE - Watchlist dies with user
-- =============================================================================

ALTER TABLE watch_lists
  DROP CONSTRAINT IF EXISTS watch_lists_user_id_users_id_fk,
  ADD CONSTRAINT watch_lists_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: product_watches
-- Strategy: CASCADE - Watch dies with user/product/list
-- =============================================================================

ALTER TABLE product_watches
  DROP CONSTRAINT IF EXISTS product_watches_user_id_users_id_fk,
  ADD CONSTRAINT product_watches_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE product_watches
  DROP CONSTRAINT IF EXISTS product_watches_product_id_products_id_fk,
  ADD CONSTRAINT product_watches_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE product_watches
  DROP CONSTRAINT IF EXISTS product_watches_watch_list_id_watch_lists_id_fk,
  ADD CONSTRAINT product_watches_watch_list_id_watch_lists_id_fk
    FOREIGN KEY (watch_list_id) REFERENCES watch_lists(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: user_reputation
-- Strategy: CASCADE - Reputation dies with user
-- =============================================================================

ALTER TABLE user_reputation
  DROP CONSTRAINT IF EXISTS user_reputation_user_id_users_id_fk,
  ADD CONSTRAINT user_reputation_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: deal_spottings
-- Strategy: CASCADE for user/product, SET NULL for forum post
-- =============================================================================

ALTER TABLE deal_spottings
  DROP CONSTRAINT IF EXISTS deal_spottings_user_id_users_id_fk,
  ADD CONSTRAINT deal_spottings_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE deal_spottings
  DROP CONSTRAINT IF EXISTS deal_spottings_product_id_products_id_fk,
  ADD CONSTRAINT deal_spottings_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE deal_spottings
  DROP CONSTRAINT IF EXISTS deal_spottings_forum_post_id_forum_posts_id_fk,
  ADD CONSTRAINT deal_spottings_forum_post_id_forum_posts_id_fk
    FOREIGN KEY (forum_post_id) REFERENCES forum_posts(id) ON DELETE SET NULL;

-- =============================================================================
-- TABLE: post_revisions
-- Strategy: CASCADE for post, SET NULL for editor
-- =============================================================================

ALTER TABLE post_revisions
  DROP CONSTRAINT IF EXISTS post_revisions_post_id_forum_posts_id_fk,
  ADD CONSTRAINT post_revisions_post_id_forum_posts_id_fk
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE;

ALTER TABLE post_revisions
  DROP CONSTRAINT IF EXISTS post_revisions_edited_by_id_users_id_fk,
  ADD CONSTRAINT post_revisions_edited_by_id_users_id_fk
    FOREIGN KEY (edited_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- =============================================================================
-- TABLE: trending_products
-- Strategy: SET NULL - Trending record persists
-- =============================================================================

ALTER TABLE trending_products
  DROP CONSTRAINT IF EXISTS trending_products_product_id_products_id_fk,
  ADD CONSTRAINT trending_products_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- =============================================================================
-- TABLE: search_queries
-- Strategy: CASCADE for trending_product, SET NULL for product
-- =============================================================================

ALTER TABLE search_queries
  DROP CONSTRAINT IF EXISTS search_queries_trending_product_id_trending_products_id_fk,
  ADD CONSTRAINT search_queries_trending_product_id_trending_products_id_fk
    FOREIGN KEY (trending_product_id) REFERENCES trending_products(id) ON DELETE CASCADE;

ALTER TABLE search_queries
  DROP CONSTRAINT IF EXISTS search_queries_product_id_products_id_fk,
  ADD CONSTRAINT search_queries_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- =============================================================================
-- TABLE: scraping_jobs
-- Strategy: SET NULL - Job persists even if session deleted
-- =============================================================================

ALTER TABLE scraping_jobs
  DROP CONSTRAINT IF EXISTS scraping_jobs_agent_session_id_agent_sessions_id_fk,
  ADD CONSTRAINT scraping_jobs_agent_session_id_agent_sessions_id_fk
    FOREIGN KEY (agent_session_id) REFERENCES agent_sessions(id) ON DELETE SET NULL;

-- =============================================================================
-- TABLE: price_predictions
-- Strategy: CASCADE - Prediction dies with offer
-- =============================================================================

ALTER TABLE price_predictions
  DROP CONSTRAINT IF EXISTS price_predictions_product_offer_id_product_offers_id_fk,
  ADD CONSTRAINT price_predictions_product_offer_id_product_offers_id_fk
    FOREIGN KEY (product_offer_id) REFERENCES product_offers(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: price_snapshots
-- Strategy: CASCADE - Snapshot dies with product/retailer
-- =============================================================================

ALTER TABLE price_snapshots
  DROP CONSTRAINT IF EXISTS price_snapshots_product_id_products_id_fk,
  ADD CONSTRAINT price_snapshots_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE price_snapshots
  DROP CONSTRAINT IF EXISTS price_snapshots_retailer_id_retailers_id_fk,
  ADD CONSTRAINT price_snapshots_retailer_id_retailers_id_fk
    FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON DELETE CASCADE;

-- =============================================================================
-- TABLE: product_urls
-- Strategy: CASCADE - URL dies with product/retailer
-- =============================================================================

ALTER TABLE product_urls
  DROP CONSTRAINT IF EXISTS product_urls_product_id_products_id_fk,
  ADD CONSTRAINT product_urls_product_id_products_id_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE product_urls
  DROP CONSTRAINT IF EXISTS product_urls_retailer_id_retailers_id_fk,
  ADD CONSTRAINT product_urls_retailer_id_retailers_id_fk
    FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON DELETE CASCADE;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Summary:
-- - 51 foreign keys updated with proper CASCADE rules
-- - 34 CASCADE (child data meaningless without parent)
-- - 17 SET NULL (child data persists, reference becomes null)
-- - 0 RESTRICT (deletion prevented if children exist)
--
-- This ensures:
-- 1. No orphaned records accumulate
-- 2. Database maintains referential integrity
-- 3. Automatic cleanup when parent records deleted
-- 4. Forum posts/content preserved but anonymized when users deleted
