-- Rollback for Migration 0026: AI Scraping System Tables
-- Created: 2025-12-23
-- WARNING: This will delete ALL scraping system data

BEGIN;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS scraping_sources CASCADE;
DROP TABLE IF EXISTS price_predictions CASCADE;
DROP TABLE IF EXISTS scraping_jobs CASCADE;
DROP TABLE IF EXISTS agent_sessions CASCADE;
DROP TABLE IF EXISTS search_queries CASCADE;
DROP TABLE IF EXISTS trending_products CASCADE;

COMMIT;
