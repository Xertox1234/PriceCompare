-- Migration: Add NOT NULL and UNIQUE constraints to email_hash column
-- Description: Finalizes the email_hash column after backfill is complete
-- Created: 2025-12-11
--
-- PREREQUISITES:
-- 1. Migration 0022_add_email_hash_column.sql must be applied
-- 2. Backfill script must be run: tsx migrations/scripts/backfill-email-hashes.ts
-- 3. Verify no NULL values: SELECT count(*) FROM users WHERE email_hash IS NULL;
--
-- DO NOT RUN THIS until backfill is complete!

BEGIN;

-- ============================================================================
-- STEP 1: Verify all users have email_hash (safety check)
-- ============================================================================
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT count(*) INTO null_count FROM users WHERE email_hash IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot add constraints: % users still have NULL email_hash. Run backfill script first.', null_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add NOT NULL constraint
-- ============================================================================
ALTER TABLE users ALTER COLUMN email_hash SET NOT NULL;

-- ============================================================================
-- STEP 3: Add UNIQUE constraint
-- ============================================================================
ALTER TABLE users ADD CONSTRAINT users_email_hash_unique UNIQUE (email_hash);

-- ============================================================================
-- STEP 4: Update documentation comment
-- ============================================================================
COMMENT ON COLUMN users.email_hash IS
  'SHA-256 hash of lowercase email for indexed lookups. UNIQUE constraint enforces email uniqueness. See ENCRYPTION_KEY_ROTATION.md.';

COMMIT;
