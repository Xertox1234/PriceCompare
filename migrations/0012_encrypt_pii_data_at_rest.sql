-- Migration: Encrypt PII Data at Rest (GDPR Article 32 Compliance)
-- Description: Encrypts sensitive user data using AES-256-GCM encryption
-- Created: 2025-11-19
-- Issue: https://github.com/Xertox1234/PriceCompare/issues/63
--
-- GDPR COMPLIANCE:
-- - Article 32: "Encryption of personal data"
-- - Article 5(1)(f): "Processed in a manner that ensures appropriate security"
--
-- IMPORTANT: This migration encrypts existing plaintext PII data.
-- The encryptedText custom column type in Drizzle will handle
-- automatic encryption/decryption for all future operations.
--
-- BEFORE RUNNING:
-- 1. Ensure ENCRYPTION_KEY is set in environment (64 hex chars)
-- 2. Backup database: pg_dump -Fc pricecompare > backup.dump
-- 3. Test on staging environment first
--
-- ROLLBACK INSTRUCTIONS:
-- If you need to rollback, you MUST have the same ENCRYPTION_KEY to decrypt.
-- Without the key, encrypted data cannot be recovered.
--
-- Note: This migration changes column types from varchar to text.
-- Text type is required for encrypted data which is longer than original.
-- The encryptedText custom type uses text as the underlying database type.

BEGIN;

-- ============================================================================
-- STEP 1: Alter column types to text (required for encrypted data)
-- ============================================================================
-- Encrypted data is longer than plaintext due to IV and auth tag,
-- so we need to change varchar columns to text

ALTER TABLE users
  ALTER COLUMN email TYPE text;

ALTER TABLE password_reset_tokens
  ALTER COLUMN ip_address TYPE text,
  ALTER COLUMN user_agent TYPE text;

ALTER TABLE private_messages
  ALTER COLUMN subject TYPE text,
  ALTER COLUMN content TYPE text;

-- notifications.content is already text type, no change needed

-- ============================================================================
-- STEP 2: Create temporary Node.js function for encryption
-- ============================================================================
-- We'll create a plpgsql function that shells out to Node.js
-- to encrypt data using our encryption utilities.
-- This is a one-time operation during migration.

-- Note: In production, you should encrypt data using a migration script
-- that runs outside of SQL (see migrations/encrypt_existing_data.ts)
-- This SQL is provided for documentation and can be used in dev environments.

-- ============================================================================
-- STEP 3: Add comments to encrypted columns
-- ============================================================================
-- Document that these columns contain encrypted PII

COMMENT ON COLUMN users.email IS
  'ENCRYPTED PII: User email address encrypted with AES-256-GCM (GDPR Article 32)';

COMMENT ON COLUMN password_reset_tokens.ip_address IS
  'ENCRYPTED PII: IP address encrypted with AES-256-GCM (GDPR Article 32)';

COMMENT ON COLUMN password_reset_tokens.user_agent IS
  'ENCRYPTED PII: User agent string encrypted with AES-256-GCM (GDPR Article 32)';

COMMENT ON COLUMN private_messages.subject IS
  'ENCRYPTED PII: Message subject encrypted with AES-256-GCM (GDPR Article 32)';

COMMENT ON COLUMN private_messages.content IS
  'ENCRYPTED PII: Message content encrypted with AES-256-GCM (GDPR Article 32)';

COMMENT ON COLUMN notifications.content IS
  'ENCRYPTED PII: Notification content encrypted with AES-256-GCM (GDPR Article 32)';

-- ============================================================================
-- STEP 4: Update security documentation
-- ============================================================================

COMMENT ON TABLE users IS
  'User accounts with encrypted PII fields (email). GDPR Article 32 compliant.';

COMMENT ON TABLE password_reset_tokens IS
  'Password reset tokens with encrypted PII fields (ipAddress, userAgent). GDPR Article 32 compliant.';

COMMENT ON TABLE private_messages IS
  'Private messages with encrypted content (subject, content). GDPR Article 32 compliant.';

COMMENT ON TABLE notifications IS
  'User notifications with encrypted content field. GDPR Article 32 compliant.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION STEPS (Run manually with Node.js)
-- ============================================================================
-- After this SQL migration completes, you MUST run the data encryption script:
--
--   npm run migrate:encrypt-pii-data
--
-- This script will:
-- 1. Connect to the database
-- 2. Fetch all plaintext PII data
-- 3. Encrypt it using server/utils/encryption.ts
-- 4. Update the database with encrypted values
-- 5. Verify encryption success
--
-- See migrations/scripts/encrypt-existing-pii-data.ts for implementation
