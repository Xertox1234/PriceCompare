-- Migration: 0029_add_foreign_key_indexes
-- Description: Add missing indexes on foreign key columns for improved query performance
-- Identified during code audit on 2026-01-18

-- Index on post_revisions.post_id for efficient revision lookups by post
CREATE INDEX IF NOT EXISTS post_revisions_post_id_idx ON post_revisions(post_id);

-- Index on post_revisions.edited_by_id for finding revisions by editor
CREATE INDEX IF NOT EXISTS post_revisions_edited_by_id_idx ON post_revisions(edited_by_id);

-- Index on price_predictions.product_offer_id for prediction lookups by offer
CREATE INDEX IF NOT EXISTS price_predictions_product_offer_id_idx ON price_predictions(product_offer_id);

-- Index on price_predictions.prediction_date for time-based queries
CREATE INDEX IF NOT EXISTS price_predictions_prediction_date_idx ON price_predictions(prediction_date);

-- Index on scraping_jobs.agent_session_id for session job lookups
CREATE INDEX IF NOT EXISTS scraping_jobs_agent_session_id_idx ON scraping_jobs(agent_session_id);

-- Index on scraping_jobs.status for job status filtering
CREATE INDEX IF NOT EXISTS scraping_jobs_status_idx ON scraping_jobs(status);

-- Composite index on scraping_jobs for priority-based job queue queries
CREATE INDEX IF NOT EXISTS scraping_jobs_priority_status_idx ON scraping_jobs(priority, status);
