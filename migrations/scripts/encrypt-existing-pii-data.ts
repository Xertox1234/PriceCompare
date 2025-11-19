/**
 * Migration Script: Encrypt Existing PII Data
 *
 * This script encrypts all existing plaintext PII data in the database.
 * Must be run AFTER the SQL schema migration (0012_encrypt_pii_data_at_rest.sql)
 *
 * GDPR COMPLIANCE:
 * - Article 32: "Encryption of personal data"
 * - Article 5(1)(f): "Processed in a manner that ensures appropriate security"
 *
 * USAGE:
 *   tsx migrations/scripts/encrypt-existing-pii-data.ts
 *
 * PREREQUISITES:
 * - ENCRYPTION_KEY must be set in environment
 * - Database must be backed up
 * - Schema migration (0012) must be applied first
 *
 * @module encrypt-existing-pii-data
 */

import { db } from '../../server/db';
import { users, passwordResetTokens, privateMessages, notifications } from '../../shared/schema';
import { encrypt, isEncrypted } from '../../server/utils/encryption';
import { eq, isNotNull, sql } from 'drizzle-orm';

interface MigrationStats {
  table: string;
  totalRecords: number;
  encrypted: number;
  alreadyEncrypted: number;
  errors: number;
}

const stats: MigrationStats[] = [];

// Batch size for processing large datasets
// Adjust based on available memory and database performance
const BATCH_SIZE = 100;

/**
 * Safely encrypt a value, skipping if already encrypted
 */
function encryptSafely(value: string | null, fieldName: string): string | null {
  if (!value) return null;

  // Skip if already encrypted
  if (isEncrypted(value)) {
    console.log(`  ℹ️  ${fieldName} already encrypted, skipping`);
    return value;
  }

  try {
    return encrypt(value);
  } catch (error) {
    console.error(`  ❌ Failed to encrypt ${fieldName}:`, error);
    throw error;
  }
}

/**
 * Process array in batches for better performance on large datasets
 *
 * @param items - Array of items to process
 * @param batchSize - Number of items per batch
 * @param processor - Async function to process each batch
 */
async function processBatches<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(items.length / batchSize);

    console.log(`  📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
    await processor(batch);
  }
}

/**
 * Encrypt users.email field with batch processing
 */
async function encryptUserEmails() {
  console.log('\n📧 Encrypting user emails...');

  const allUsers = await db.select({
    id: users.id,
    email: users.email,
  }).from(users);

  const tableStats: MigrationStats = {
    table: 'users',
    totalRecords: allUsers.length,
    encrypted: 0,
    alreadyEncrypted: 0,
    errors: 0,
  };

  console.log(`  Found ${allUsers.length} users to process`);

  // Process in batches for better performance on large datasets
  await processBatches(allUsers, BATCH_SIZE, async (batch) => {
    // Process all items in batch concurrently
    await Promise.all(batch.map(async (user) => {
      try {
        const currentEmail = user.email;

        if (isEncrypted(currentEmail)) {
          tableStats.alreadyEncrypted++;
          console.log(`    ✅ User ${user.id}: email already encrypted`);
          return;
        }

        const encryptedEmail = encrypt(currentEmail);

        // Use raw SQL to bypass Drizzle's encryption (which would double-encrypt)
        await db.execute(sql`
          UPDATE users
          SET email = ${encryptedEmail}
          WHERE id = ${user.id}
        `);

        tableStats.encrypted++;
        console.log(`    ✅ User ${user.id}: encrypted email`);
      } catch (error) {
        tableStats.errors++;
        console.error(`    ❌ User ${user.id}: encryption failed`, error);
        throw error; // Stop on first error for safety
      }
    }));
  });

  stats.push(tableStats);
  console.log(`\n✅ Users: ${tableStats.encrypted} encrypted, ${tableStats.alreadyEncrypted} already encrypted`);
}

/**
 * Encrypt passwordResetTokens.ipAddress and userAgent fields
 */
async function encryptPasswordResetTokens() {
  console.log('\n🔐 Encrypting password reset token metadata...');

  const allTokens = await db.select({
    id: passwordResetTokens.id,
    ipAddress: passwordResetTokens.ipAddress,
    userAgent: passwordResetTokens.userAgent,
  }).from(passwordResetTokens);

  const tableStats: MigrationStats = {
    table: 'password_reset_tokens',
    totalRecords: allTokens.length,
    encrypted: 0,
    alreadyEncrypted: 0,
    errors: 0,
  };

  for (const token of allTokens) {
    try {
      let needsUpdate = false;
      let encryptedIp = token.ipAddress;
      let encryptedUserAgent = token.userAgent;

      // Encrypt IP address if present and not already encrypted
      if (token.ipAddress && !isEncrypted(token.ipAddress)) {
        encryptedIp = encrypt(token.ipAddress);
        needsUpdate = true;
      } else if (token.ipAddress && isEncrypted(token.ipAddress)) {
        tableStats.alreadyEncrypted++;
      }

      // Encrypt user agent if present and not already encrypted
      if (token.userAgent && !isEncrypted(token.userAgent)) {
        encryptedUserAgent = encrypt(token.userAgent);
        needsUpdate = true;
      } else if (token.userAgent && isEncrypted(token.userAgent)) {
        tableStats.alreadyEncrypted++;
      }

      if (needsUpdate) {
        await db.execute(sql`
          UPDATE password_reset_tokens
          SET ip_address = ${encryptedIp},
              user_agent = ${encryptedUserAgent}
          WHERE id = ${token.id}
        `);

        tableStats.encrypted++;
        console.log(`  ✅ Token ${token.id}: encrypted metadata`);
      } else {
        console.log(`  ℹ️  Token ${token.id}: already encrypted`);
      }
    } catch (error) {
      tableStats.errors++;
      console.error(`  ❌ Token ${token.id}: encryption failed`, error);
      throw error;
    }
  }

  stats.push(tableStats);
  console.log(`\n✅ Password reset tokens: ${tableStats.encrypted} encrypted, ${tableStats.alreadyEncrypted} already encrypted`);
}

/**
 * Encrypt privateMessages.subject and content fields
 */
async function encryptPrivateMessages() {
  console.log('\n💬 Encrypting private messages...');

  const allMessages = await db.select({
    id: privateMessages.id,
    subject: privateMessages.subject,
    content: privateMessages.content,
  }).from(privateMessages);

  const tableStats: MigrationStats = {
    table: 'private_messages',
    totalRecords: allMessages.length,
    encrypted: 0,
    alreadyEncrypted: 0,
    errors: 0,
  };

  for (const message of allMessages) {
    try {
      let needsUpdate = false;
      let encryptedSubject = message.subject;
      let encryptedContent = message.content;

      // Encrypt subject
      if (!isEncrypted(message.subject)) {
        encryptedSubject = encrypt(message.subject);
        needsUpdate = true;
      } else {
        tableStats.alreadyEncrypted++;
      }

      // Encrypt content
      if (!isEncrypted(message.content)) {
        encryptedContent = encrypt(message.content);
        needsUpdate = true;
      } else {
        tableStats.alreadyEncrypted++;
      }

      if (needsUpdate) {
        await db.execute(sql`
          UPDATE private_messages
          SET subject = ${encryptedSubject},
              content = ${encryptedContent}
          WHERE id = ${message.id}
        `);

        tableStats.encrypted++;
        console.log(`  ✅ Message ${message.id}: encrypted`);
      } else {
        console.log(`  ℹ️  Message ${message.id}: already encrypted`);
      }
    } catch (error) {
      tableStats.errors++;
      console.error(`  ❌ Message ${message.id}: encryption failed`, error);
      throw error;
    }
  }

  stats.push(tableStats);
  console.log(`\n✅ Private messages: ${tableStats.encrypted} encrypted, ${tableStats.alreadyEncrypted} already encrypted`);
}

/**
 * Encrypt notifications.content field (if not null)
 */
async function encryptNotifications() {
  console.log('\n🔔 Encrypting notification content...');

  const allNotifications = await db.select({
    id: notifications.id,
    content: notifications.content,
  }).from(notifications)
    .where(isNotNull(notifications.content));

  const tableStats: MigrationStats = {
    table: 'notifications',
    totalRecords: allNotifications.length,
    encrypted: 0,
    alreadyEncrypted: 0,
    errors: 0,
  };

  for (const notification of allNotifications) {
    try {
      if (!notification.content) {
        continue;
      }

      if (isEncrypted(notification.content)) {
        tableStats.alreadyEncrypted++;
        console.log(`  ℹ️  Notification ${notification.id}: already encrypted`);
        continue;
      }

      const encryptedContent = encrypt(notification.content);

      await db.execute(sql`
        UPDATE notifications
        SET content = ${encryptedContent}
        WHERE id = ${notification.id}
      `);

      tableStats.encrypted++;
      console.log(`  ✅ Notification ${notification.id}: encrypted`);
    } catch (error) {
      tableStats.errors++;
      console.error(`  ❌ Notification ${notification.id}: encryption failed`, error);
      throw error;
    }
  }

  stats.push(tableStats);
  console.log(`\n✅ Notifications: ${tableStats.encrypted} encrypted, ${tableStats.alreadyEncrypted} already encrypted`);
}

/**
 * Main migration function
 */
async function main() {
  console.log('🔐 PII Encryption Migration Starting...');
  console.log('=====================================\n');

  // Validate encryption key is set
  if (!process.env.ENCRYPTION_KEY) {
    console.error('❌ ERROR: ENCRYPTION_KEY environment variable is not set');
    console.error('   Generate one with: openssl rand -hex 32');
    process.exit(1);
  }

  console.log('✅ Encryption key validated');
  console.log(`📊 Starting encryption of existing PII data...\n`);

  try {
    // Encrypt data in each table
    await encryptUserEmails();
    await encryptPasswordResetTokens();
    await encryptPrivateMessages();
    await encryptNotifications();

    // Print final summary
    console.log('\n\n📊 MIGRATION SUMMARY');
    console.log('===================\n');

    let totalEncrypted = 0;
    let totalAlreadyEncrypted = 0;
    let totalErrors = 0;

    for (const stat of stats) {
      console.log(`${stat.table}:`);
      console.log(`  Total records: ${stat.totalRecords}`);
      console.log(`  Encrypted: ${stat.encrypted}`);
      console.log(`  Already encrypted: ${stat.alreadyEncrypted}`);
      console.log(`  Errors: ${stat.errors}\n`);

      totalEncrypted += stat.encrypted;
      totalAlreadyEncrypted += stat.alreadyEncrypted;
      totalErrors += stat.errors;
    }

    console.log('TOTALS:');
    console.log(`  ✅ Successfully encrypted: ${totalEncrypted}`);
    console.log(`  ℹ️  Already encrypted: ${totalAlreadyEncrypted}`);
    console.log(`  ❌ Errors: ${totalErrors}\n`);

    if (totalErrors === 0) {
      console.log('✅ Migration completed successfully!');
      console.log('🔒 All PII data is now encrypted (GDPR Article 32 compliant)\n');
      process.exit(0);
    } else {
      console.error('❌ Migration completed with errors');
      console.error('   Review errors above and fix before proceeding\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED');
    console.error('===================\n');
    console.error(error);
    console.error('\nDatabase may be in inconsistent state. Restore from backup if needed.\n');
    process.exit(1);
  }
}

// Run migration
main();
