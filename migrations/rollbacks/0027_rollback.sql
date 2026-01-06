-- Rollback for Migration 0027: price_snapshots Table
-- Created: 2025-12-23
-- WARNING: This will delete ALL price snapshot data

BEGIN;

DROP TABLE IF EXISTS price_snapshots CASCADE;

COMMIT;
