# TODO 001: Create Migration 0026 for Scraping System Tables

**Priority**: P0 (CRITICAL BLOCKER)
**File(s)**: `migrations/0026_create_scraping_tables.sql` (NEW)
**Estimated Time**: 4-6 hours
**Status**: Not Started

## Problem Statement

The scraping system defines **13 new database tables** in `shared/schema.ts` (lines 1055-1336) but **no corresponding migration files exist**. This creates a critical deployment blocker:

- Application will crash on startup with: `relation "trending_products" does not exist`
- Database queries in all 7 agent files will fail
- No way to deploy scraping system to production

**Review Finding Reference**: Data Integrity Guardian - Critical Finding #1

## Root Cause

The database schema was defined in TypeScript (`shared/schema.ts`) but the SQL migration file (0026) was never created. This is a common oversight when schema changes are made incrementally during development.

**Context from user**: 25 existing migrations (0001-0025) cover security, performance, and data integrity. Migration 0026 is the natural next step.

## Solution Approach

Create a comprehensive SQL migration file that:
1. Creates all 13 scraping system tables
2. Adds proper indexes for performance
3. Defines foreign key constraints with cascade rules
4. Includes rollback capability
5. Follows existing migration patterns from 0001-0025

## Implementation Steps

### Step 1: Create Migration File Structure

- [ ] Create `migrations/0026_create_scraping_tables.sql`
- [ ] Add migration header with date and description
- [ ] Include BEGIN/COMMIT transaction wrapper

### Step 2: Add Table Definitions

Create tables in dependency order:

- [ ] `trending_products` (no dependencies)
- [ ] `search_queries` (references trending_products)
- [ ] `agent_sessions` (no dependencies)
- [ ] `scraping_jobs` (references agent_sessions)
- [ ] `price_predictions` (references product_offers)
- [ ] `scraping_sources` (references trending_products)
- [ ] `price_snapshots` (references product_offers)
- [ ] `session_lock_statuses` (references agent_sessions)
- [ ] `query_analysis_results` (references search_queries)
- [ ] `search_result_metadata` (references search_queries)
- [ ] `affiliate_links` (references product_offers)
- [ ] `monitoring_configs` (no dependencies)
- [ ] `task_schedules` (no dependencies)

### Step 3: Add Performance Indexes

- [ ] `idx_scraping_jobs_status_scheduled` - Job queue polling
- [ ] `idx_trending_products_status` - Discovery filtering
- [ ] `idx_agent_sessions_type` - Agent metrics
- [ ] `idx_search_queries_trending_product` - Query lookup
- [ ] `idx_price_predictions_offer` - Price analytics

### Step 4: Add Constraints & Validation

- [ ] CHECK constraint: `price_predictions.confidence_score` between 0 and 1
- [ ] CHECK constraint: `scraping_jobs.priority` between 1 and 10
- [ ] CHECK constraint: `scraping_jobs.retry_count >= 0`
- [ ] CHECK constraint: `trending_products.trend_score >= 0`

### Step 5: Create Rollback Script

- [ ] Create `migrations/0026_rollback.sql` with DROP TABLE statements in reverse order
- [ ] Test rollback on development database

## Technical Details

```sql
-- Migration 0026: AI Scraping System Tables
-- Created: 2025-12-23
-- Description: Creates 13 tables for AI-powered product discovery and price monitoring

BEGIN;

-- Table 1: Trending Products (discovered via AI)
CREATE TABLE IF NOT EXISTS trending_products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  trend_score INTEGER CHECK (trend_score >= 0),
  search_volume INTEGER,
  source VARCHAR(50) NOT NULL,  -- google_trends, seasonal, social_media, news
  source_data JSONB,
  status VARCHAR(20) DEFAULT 'discovered' CHECK (status IN ('discovered', 'processing', 'scraped', 'failed')),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  discovery_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Search Queries (AI-generated search terms)
CREATE TABLE IF NOT EXISTS search_queries (
  id SERIAL PRIMARY KEY,
  trending_product_id INTEGER REFERENCES trending_products(id) ON DELETE CASCADE,
  query_text VARCHAR(500) NOT NULL,
  retailer VARCHAR(100),
  query_type VARCHAR(50) DEFAULT 'product_search',
  success_rate DECIMAL(3,2) CHECK (success_rate >= 0 AND success_rate <= 1),
  avg_results INTEGER,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: Agent Sessions (track agent execution)
CREATE TABLE IF NOT EXISTS agent_sessions (
  id SERIAL PRIMARY KEY,
  agent_type VARCHAR(50) NOT NULL,  -- discovery, search, extraction, monitoring, coordination
  session_id VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'stopped', 'crashed', 'completed')),
  session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  session_end TIMESTAMP,
  tasks_completed INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2),
  errors_encountered INTEGER DEFAULT 0,
  performance_metrics JSONB
);

-- Table 4: Scraping Jobs (job queue for scraping tasks)
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL,  -- discovery, search, scrape, validate, price_update
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  target_data TEXT,  -- JSON payload
  result_data TEXT,  -- JSON result
  error_message TEXT,
  agent_session_id INTEGER REFERENCES agent_sessions(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: Price Predictions (ML-based price forecasting)
CREATE TABLE IF NOT EXISTS price_predictions (
  id SERIAL PRIMARY KEY,
  product_offer_id INTEGER REFERENCES product_offers(id) ON DELETE CASCADE,
  predicted_price DECIMAL(10,2) NOT NULL CHECK (predicted_price >= 0),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actual_price DECIMAL(10,2) CHECK (actual_price >= 0),
  prediction_accuracy DECIMAL(3,2)
);

-- Table 6: Scraping Sources (trend data sources)
CREATE TABLE IF NOT EXISTS scraping_sources (
  id SERIAL PRIMARY KEY,
  trending_product_id INTEGER REFERENCES trending_products(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,  -- google_trends, twitter, reddit, news
  source_url VARCHAR(500),
  relevance_score DECIMAL(3,2),
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 7: Price Snapshots (historical price data for ML)
CREATE TABLE IF NOT EXISTS price_snapshots (
  id SERIAL PRIMARY KEY,
  product_offer_id INTEGER REFERENCES product_offers(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  availability VARCHAR(50),
  snapshot_source VARCHAR(100)
);

-- Table 8: Session Lock Statuses (distributed locking)
CREATE TABLE IF NOT EXISTS session_lock_statuses (
  id SERIAL PRIMARY KEY,
  agent_session_id INTEGER REFERENCES agent_sessions(id) ON DELETE CASCADE,
  lock_name VARCHAR(255) NOT NULL,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  instance_id VARCHAR(100),
  UNIQUE(lock_name)
);

-- Table 9: Query Analysis Results (AI query intent analysis)
CREATE TABLE IF NOT EXISTS query_analysis_results (
  id SERIAL PRIMARY KEY,
  search_query_id INTEGER REFERENCES search_queries(id) ON DELETE CASCADE,
  intent VARCHAR(100),
  category_suggestions JSONB,
  filter_suggestions JSONB,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 10: Search Result Metadata (Google Search API results)
CREATE TABLE IF NOT EXISTS search_result_metadata (
  id SERIAL PRIMARY KEY,
  search_query_id INTEGER REFERENCES search_queries(id) ON DELETE CASCADE,
  retailer VARCHAR(100) NOT NULL,
  result_count INTEGER,
  product_urls JSONB,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 11: Affiliate Links (monetization tracking)
CREATE TABLE IF NOT EXISTS affiliate_links (
  id SERIAL PRIMARY KEY,
  product_offer_id INTEGER REFERENCES product_offers(id) ON DELETE CASCADE,
  affiliate_url VARCHAR(500) NOT NULL,
  affiliate_network VARCHAR(100),
  commission_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 12: Monitoring Configs (price monitoring settings)
CREATE TABLE IF NOT EXISTS monitoring_configs (
  id SERIAL PRIMARY KEY,
  monitoring_type VARCHAR(50) NOT NULL,  -- price_drop, stock_alert, trend_alert
  enabled BOOLEAN DEFAULT true,
  check_interval_minutes INTEGER DEFAULT 60,
  config_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 13: Task Schedules (background job scheduling)
CREATE TABLE IF NOT EXISTS task_schedules (
  id SERIAL PRIMARY KEY,
  task_name VARCHAR(255) NOT NULL UNIQUE,
  schedule_expression VARCHAR(100),  -- Cron expression
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX idx_scraping_jobs_status_scheduled ON scraping_jobs(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_trending_products_status ON trending_products(status);
CREATE INDEX idx_agent_sessions_type ON agent_sessions(agent_type);
CREATE INDEX idx_search_queries_trending_product ON search_queries(trending_product_id);
CREATE INDEX idx_price_predictions_offer ON price_predictions(product_offer_id);
CREATE INDEX idx_scraping_sources_trending_product ON scraping_sources(trending_product_id);
CREATE INDEX idx_price_snapshots_offer_date ON price_snapshots(product_offer_id, snapshot_date);
CREATE INDEX idx_session_locks_expires ON session_lock_statuses(expires_at);

COMMIT;
```

**Rollback Script** (`migrations/0026_rollback.sql`):
```sql
-- Rollback for Migration 0026
BEGIN;

DROP TABLE IF EXISTS task_schedules CASCADE;
DROP TABLE IF EXISTS monitoring_configs CASCADE;
DROP TABLE IF EXISTS affiliate_links CASCADE;
DROP TABLE IF EXISTS search_result_metadata CASCADE;
DROP TABLE IF EXISTS query_analysis_results CASCADE;
DROP TABLE IF EXISTS session_lock_statuses CASCADE;
DROP TABLE IF EXISTS price_snapshots CASCADE;
DROP TABLE IF EXISTS scraping_sources CASCADE;
DROP TABLE IF EXISTS price_predictions CASCADE;
DROP TABLE IF EXISTS scraping_jobs CASCADE;
DROP TABLE IF EXISTS agent_sessions CASCADE;
DROP TABLE IF EXISTS search_queries CASCADE;
DROP TABLE IF EXISTS trending_products CASCADE;

COMMIT;
```

## Checklist

- [ ] Migration 0026 SQL file created
- [ ] All 13 tables defined with correct schema
- [ ] Foreign keys match `shared/schema.ts`
- [ ] Indexes added for performance
- [ ] CHECK constraints added for validation
- [ ] Rollback script created
- [ ] Migration tested on local database
- [ ] Migration tested on dev/staging database
- [ ] Documentation updated

## Success Criteria

- [ ] `npm run migrate` succeeds without errors
- [ ] All tables created: `SELECT * FROM information_schema.tables WHERE table_name LIKE '%scraping%' OR table_name LIKE '%trending%' OR table_name LIKE '%agent%'`
- [ ] Foreign key constraints verified: `SELECT * FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY'`
- [ ] Indexes created: `SELECT * FROM pg_indexes WHERE tablename IN ('scraping_jobs', 'trending_products', 'agent_sessions')`
- [ ] Application starts without database errors
- [ ] Agents can insert/query data successfully

## Testing Commands

```bash
# 1. Run migration
npm run migrate

# 2. Verify tables created
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('trending_products', 'scraping_jobs', 'agent_sessions', 'search_queries', 'price_predictions');"

# 3. Verify indexes
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'scraping_jobs';"

# 4. Test foreign key constraints
psql $DATABASE_URL -c "SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('scraping_jobs', 'search_queries', 'price_predictions');"

# 5. Test rollback (on dev database only!)
psql $DATABASE_URL -f migrations/0026_rollback.sql

# 6. Re-run migration to confirm idempotency
npm run migrate
```

---

**Related Issues**:
- Blocks deployment of entire scraping system
- Required before any agent can run in production
- Dependency for all other scraping system todos

**Review Reference**: Comprehensive Code Review - Critical Blocker #1
