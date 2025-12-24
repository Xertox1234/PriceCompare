-- Migration 0026: AI Scraping System Tables
-- Created: 2025-12-23
-- Description: Creates 6 tables for AI-powered product discovery and price monitoring
-- CRITICAL: This migration was generated from comprehensive schema audit
--           Tables match shared/schema.ts lines 1058-1374 EXACTLY

BEGIN;

-- ============================================================================
-- Table 1: trending_products
-- Purpose: Products discovered by AI agents via trends analysis
-- Schema: shared/schema.ts lines 1058-1071
-- ============================================================================
CREATE TABLE IF NOT EXISTS trending_products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  trend_score INTEGER DEFAULT 0,
  search_volume INTEGER DEFAULT 0,
  source VARCHAR(50) NOT NULL, -- google_trends, social_media, news
  source_data TEXT, -- JSON data from source (NOTE: TEXT not JSONB per project pattern)
  discovery_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'discovered', -- discovered, processing, scraped, failed
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table 2: search_queries
-- Purpose: AI-generated search queries for product discovery
-- Schema: shared/schema.ts lines 1074-1087
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_queries (
  id SERIAL PRIMARY KEY,
  trending_product_id INTEGER REFERENCES trending_products(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  query_text VARCHAR(500) NOT NULL,
  retailer VARCHAR(50), -- NOTE: 50 not 100 (schema.ts line 1081)
  query_type VARCHAR(30) DEFAULT 'product_search', -- product_search, price_check, availability
  success_rate DECIMAL(3, 2) DEFAULT 0.00,
  avg_results INTEGER DEFAULT 0,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table 3: agent_sessions
-- Purpose: Track agent performance and execution sessions
-- Schema: shared/schema.ts lines 1090-1102
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id SERIAL PRIMARY KEY,
  agent_type VARCHAR(50) NOT NULL, -- discovery, search, navigation, extraction, validation, coordinator
  session_id VARCHAR(100) NOT NULL,
  session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  session_end TIMESTAMP,
  tasks_completed INTEGER DEFAULT 0,
  success_rate DECIMAL(3, 2) DEFAULT 0.00,
  errors_encountered INTEGER DEFAULT 0,
  performance_metrics TEXT, -- JSON data (NOTE: TEXT not JSONB per project pattern)
  status VARCHAR(20) DEFAULT 'active', -- active, completed, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table 4: scraping_jobs
-- Purpose: Job queue for scraping tasks
-- Schema: shared/schema.ts lines 1105-1123
-- ============================================================================
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL, -- discovery, search, scrape, validate, price_update
  priority INTEGER DEFAULT 5, -- 1-10, higher = more priority
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, retrying
  target_data TEXT NOT NULL, -- JSON with job parameters
  result_data TEXT, -- JSON with job results
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  agent_session_id INTEGER REFERENCES agent_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table 5: price_predictions
-- Purpose: ML-based price forecasting (NOTE: No ML code exists yet)
-- Schema: shared/schema.ts lines 1126-1141
-- ============================================================================
CREATE TABLE IF NOT EXISTS price_predictions (
  id SERIAL PRIMARY KEY,
  product_offer_id INTEGER NOT NULL REFERENCES product_offers(id) ON DELETE CASCADE,
  current_price DECIMAL(10, 2) NOT NULL,
  predicted_price DECIMAL(10, 2) NOT NULL,
  prediction_type VARCHAR(30) NOT NULL, -- daily, weekly, monthly, seasonal
  confidence_score DECIMAL(3, 2) NOT NULL,
  prediction_date TIMESTAMP NOT NULL,
  actual_price DECIMAL(10, 2), -- Filled when prediction period ends
  prediction_accuracy DECIMAL(3, 2), -- Calculated after validation
  model_version VARCHAR(20) DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validated_at TIMESTAMP
);

-- ============================================================================
-- Table 6: scraping_sources
-- Purpose: Configuration for scraping data sources (NOTE: No code uses this yet)
-- Schema: shared/schema.ts lines 1360-1374
-- ============================================================================
CREATE TABLE IF NOT EXISTS scraping_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL, -- retailer, search_engine, social_media, news
  base_url VARCHAR(500),
  search_url VARCHAR(500),
  api_key VARCHAR(200), -- Encrypted API keys
  rate_limit INTEGER DEFAULT 100, -- Requests per hour
  is_active BOOLEAN DEFAULT TRUE,
  last_used TIMESTAMP,
  success_rate DECIMAL(3, 2) DEFAULT 0.00,
  configuration TEXT, -- JSON configuration for scraper
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Performance Indexes
-- ============================================================================

-- Trending products indexes
CREATE INDEX idx_trending_products_status ON trending_products(status);
CREATE INDEX idx_trending_products_created ON trending_products(created_at DESC);
CREATE INDEX idx_trending_products_product ON trending_products(product_id) WHERE product_id IS NOT NULL;

-- Search queries indexes
CREATE INDEX idx_search_queries_trending_product ON search_queries(trending_product_id);
CREATE INDEX idx_search_queries_product ON search_queries(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_search_queries_retailer ON search_queries(retailer);

-- Agent sessions indexes
CREATE INDEX idx_agent_sessions_type ON agent_sessions(agent_type);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX idx_agent_sessions_created ON agent_sessions(created_at DESC);

-- Scraping jobs indexes (CRITICAL for job queue performance)
CREATE INDEX idx_scraping_jobs_status_scheduled ON scraping_jobs(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_scraping_jobs_agent_session ON scraping_jobs(agent_session_id) WHERE agent_session_id IS NOT NULL;
CREATE INDEX idx_scraping_jobs_created ON scraping_jobs(created_at DESC);

-- Price predictions indexes
CREATE INDEX idx_price_predictions_offer ON price_predictions(product_offer_id);
CREATE INDEX idx_price_predictions_date ON price_predictions(prediction_date DESC);

-- Scraping sources indexes
CREATE INDEX idx_scraping_sources_type ON scraping_sources(type);
CREATE INDEX idx_scraping_sources_active ON scraping_sources(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- CHECK Constraints
-- ============================================================================

ALTER TABLE trending_products
  ADD CONSTRAINT check_trending_products_trend_score_positive
    CHECK (trend_score >= 0);

ALTER TABLE trending_products
  ADD CONSTRAINT check_trending_products_search_volume_positive
    CHECK (search_volume >= 0);

ALTER TABLE search_queries
  ADD CONSTRAINT check_search_queries_success_rate_range
    CHECK (success_rate >= 0 AND success_rate <= 1);

ALTER TABLE search_queries
  ADD CONSTRAINT check_search_queries_avg_results_positive
    CHECK (avg_results >= 0);

ALTER TABLE agent_sessions
  ADD CONSTRAINT check_agent_sessions_success_rate_range
    CHECK (success_rate >= 0 AND success_rate <= 1);

ALTER TABLE agent_sessions
  ADD CONSTRAINT check_agent_sessions_tasks_positive
    CHECK (tasks_completed >= 0);

ALTER TABLE agent_sessions
  ADD CONSTRAINT check_agent_sessions_errors_positive
    CHECK (errors_encountered >= 0);

ALTER TABLE scraping_jobs
  ADD CONSTRAINT check_scraping_jobs_priority_range
    CHECK (priority >= 1 AND priority <= 10);

ALTER TABLE scraping_jobs
  ADD CONSTRAINT check_scraping_jobs_retry_count_positive
    CHECK (retry_count >= 0);

ALTER TABLE scraping_jobs
  ADD CONSTRAINT check_scraping_jobs_max_retries_positive
    CHECK (max_retries >= 0);

ALTER TABLE price_predictions
  ADD CONSTRAINT check_price_predictions_prices_positive
    CHECK (current_price >= 0 AND predicted_price >= 0);

ALTER TABLE price_predictions
  ADD CONSTRAINT check_price_predictions_actual_price_positive
    CHECK (actual_price IS NULL OR actual_price >= 0);

ALTER TABLE price_predictions
  ADD CONSTRAINT check_price_predictions_confidence_range
    CHECK (confidence_score >= 0 AND confidence_score <= 1);

ALTER TABLE price_predictions
  ADD CONSTRAINT check_price_predictions_accuracy_range
    CHECK (prediction_accuracy IS NULL OR (prediction_accuracy >= 0 AND prediction_accuracy <= 1));

ALTER TABLE scraping_sources
  ADD CONSTRAINT check_scraping_sources_rate_limit_positive
    CHECK (rate_limit IS NULL OR rate_limit > 0);

ALTER TABLE scraping_sources
  ADD CONSTRAINT check_scraping_sources_success_rate_range
    CHECK (success_rate >= 0 AND success_rate <= 1);

-- ============================================================================
-- Table Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE trending_products IS 'Products discovered by AI agents via trend analysis from Google Trends, social media, news';
COMMENT ON TABLE search_queries IS 'AI-generated search queries for product discovery and optimization';
COMMENT ON TABLE agent_sessions IS 'Agent performance tracking and execution session management';
COMMENT ON TABLE scraping_jobs IS 'Job queue for AI scraping tasks with priority and retry logic';
COMMENT ON TABLE price_predictions IS 'ML-based price forecasting (requires ML model implementation)';
COMMENT ON TABLE scraping_sources IS 'Configuration for external data sources used by scraping agents';

COMMENT ON COLUMN trending_products.source_data IS 'JSON data from trend source (stored as TEXT per project pattern)';
COMMENT ON COLUMN search_queries.success_rate IS 'Percentage of successful searches (0.00-1.00)';
COMMENT ON COLUMN agent_sessions.performance_metrics IS 'JSON performance data (stored as TEXT per project pattern)';
COMMENT ON COLUMN scraping_jobs.priority IS 'Job priority 1-10 where 10 is highest priority';
COMMENT ON COLUMN scraping_jobs.max_retries IS 'Maximum retry attempts before marking job as failed';
COMMENT ON COLUMN price_predictions.confidence_score IS 'ML model confidence score (0.00-1.00)';
COMMENT ON COLUMN scraping_sources.rate_limit IS 'Maximum requests per hour to prevent rate limiting';

COMMIT;

-- ============================================================================
-- Post-Migration Verification Queries
-- ============================================================================
-- Run these after migration to verify success:
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('trending_products', 'search_queries', 'agent_sessions', 'scraping_jobs', 'price_predictions', 'scraping_sources');
--
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('scraping_jobs', 'trending_products', 'agent_sessions');
--
-- SELECT constraint_name, table_name FROM information_schema.table_constraints
-- WHERE constraint_type = 'CHECK'
-- AND table_name IN ('scraping_jobs', 'price_predictions', 'trending_products');
