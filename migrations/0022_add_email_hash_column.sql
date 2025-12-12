-- Migration: Add email_hash column for indexed lookups on encrypted email
-- Description: Adds a SHA-256 hash column to enable fast indexed lookups on encrypted email field
-- Created: 2025-12-11
--
-- PROBLEM SOLVED:
-- The email field uses AES-256-GCM encryption with random IVs for GDPR compliance.
-- Random IVs mean the same email produces different ciphertext each time.
-- This breaks the UNIQUE constraint and prevents efficient email lookups.
--
-- SOLUTION:
-- Store a SHA-256 hash of the lowercase email alongside the encrypted value.
-- - Hash is deterministic (same input = same output)
-- - Hash is case-insensitive (lowercase before hashing)
-- - Hash enables indexed lookups (B-tree index on varchar(64))
-- - UNIQUE constraint moved from encrypted email to hash column
--
-- SECURITY NOTES:
-- - SHA-256 hash alone is NOT reversible to original email
-- - Collision verification after lookup prevents hash collision attacks
-- - Original email remains encrypted with AES-256-GCM for GDPR compliance
--
-- PATTERN REFERENCE:
-- See docs/ENCRYPTION_KEY_ROTATION.md section "Hash-Based Lookup Columns"
--
-- BEFORE RUNNING:
-- 1. Ensure ENCRYPTION_KEY is set in environment (for decrypt during backfill)
-- 2. Backup database: pg_dump -Fc pricecompare > backup.dump
-- 3. Test on staging environment first
-- 4. Run backfill script AFTER this migration: tsx migrations/scripts/backfill-email-hashes.ts

BEGIN;

-- ============================================================================
-- STEP 1: Add email_hash column (nullable initially for backfill)
-- ============================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);

-- ============================================================================
-- STEP 2: Create index on email_hash for fast lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);

-- ============================================================================
-- STEP 3: Add documentation comment
-- ============================================================================
COMMENT ON COLUMN users.email_hash IS
  'SHA-256 hash of lowercase email for indexed lookups. Uniqueness enforced after backfill. See ENCRYPTION_KEY_ROTATION.md.';

-- ============================================================================
-- STEP 4: Remove unique constraint from encrypted email column
-- ============================================================================
-- The email column may have a unique constraint from initial schema.
-- We need to drop it since encrypted values with random IVs cannot be unique.
-- Note: If constraint doesn't exist, this will error - that's OK in dev.
DO $$
BEGIN
  -- Try to drop the constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_unique' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_email_unique;
  END IF;
END $$;

-- Also check for index-based unique constraint
DROP INDEX IF EXISTS users_email_unique;
DROP INDEX IF EXISTS users_email_key;

COMMIT;

-- ============================================================================
-- POST-MIGRATION STEPS (run separately after backfill script):
-- ============================================================================
-- After running migrations/scripts/backfill-email-hashes.ts:
--
-- 1. Add NOT NULL constraint:
--    ALTER TABLE users ALTER COLUMN email_hash SET NOT NULL;
--
-- 2. Add UNIQUE constraint:
--    ALTER TABLE users ADD CONSTRAINT users_email_hash_unique UNIQUE (email_hash);
--
-- These are done in a separate migration (0023) after backfill completes.
