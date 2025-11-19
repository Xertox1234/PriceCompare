/**
 * Encryption utilities for PII data at rest (GDPR Article 32 compliance)
 *
 * Implements AES-256-GCM authenticated encryption for sensitive user data.
 * This module provides encryption/decryption functions for PII fields in the database.
 *
 * SECURITY NOTES:
 * - Uses AES-256-GCM (NIST approved, authenticated encryption)
 * - Random IV (Initialization Vector) per encryption operation
 * - Authentication tag prevents tampering
 * - Key must be 32 bytes (256 bits) stored in ENCRYPTION_KEY env variable
 *
 * GDPR COMPLIANCE:
 * - Article 32: "Encryption of personal data"
 * - Article 5(1)(f): "Processed in a manner that ensures appropriate security"
 *
 * @module encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits for GCM
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment
 * @throws {Error} If ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required for PII encryption. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // Convert hex string to buffer
  const keyBuffer = Buffer.from(key, 'hex');

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters). ` +
      `Got ${keyBuffer.length} bytes. Generate with: openssl rand -hex 32`
    );
  }

  return keyBuffer;
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - The sensitive data to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex encoded)
 * @throws {Error} If encryption fails or ENCRYPTION_KEY is invalid
 *
 * @example
 * const encrypted = encrypt('user@example.com');
 * // Returns: "a1b2c3...d4e5:f6g7h8...i9j0:k1l2m3...n4o5"
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  const key = getEncryptionKey();

  // Generate random IV for each encryption (critical for security)
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt data
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag (GCM provides authenticated encryption)
  const authTag = cipher.getAuthTag();

  // Return format: iv:authTag:encrypted (all hex encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param ciphertext - Encrypted string in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext
 * @throws {Error} If decryption fails, data is tampered, or format is invalid
 *
 * @example
 * const decrypted = decrypt('a1b2c3...d4e5:f6g7h8...i9j0:k1l2m3...n4o5');
 * // Returns: "user@example.com"
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    throw new Error('Cannot decrypt empty string');
  }

  // Parse encrypted format: iv:authTag:encrypted
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted format. Expected 'iv:authTag:encrypted', got ${parts.length} parts`
    );
  }

  const [ivHex, authTagHex, encrypted] = parts;

  // Convert hex strings to buffers
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getEncryptionKey();

  // Validate buffer lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
  }

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    // Decrypt data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // GCM auth tag verification failed = data has been tampered
    throw new Error(
      'Decryption failed: data may have been tampered with or encryption key is incorrect'
    );
  }
}

/**
 * Check if a string is encrypted (has the expected format)
 *
 * @param value - String to check
 * @returns true if string appears to be encrypted
 *
 * @example
 * isEncrypted('a1b2c3:d4e5f6:g7h8i9') // true
 * isEncrypted('plaintext@example.com') // false
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;

  const parts = value.split(':');
  if (parts.length !== 3) return false;

  // Check if all parts are valid hex strings
  const hexPattern = /^[0-9a-f]+$/i;
  return parts.every(part => hexPattern.test(part));
}

/**
 * Encrypt existing plaintext data (for migrations)
 *
 * @param value - Value to encrypt if not already encrypted
 * @returns Encrypted value
 *
 * @example
 * const safe = encryptIfNeeded('user@example.com'); // Encrypts
 * const alreadySafe = encryptIfNeeded('a1b2:c3d4:e5f6'); // Returns as-is
 */
export function encryptIfNeeded(value: string | null): string | null {
  if (!value) return null;
  if (isEncrypted(value)) return value;
  return encrypt(value);
}
