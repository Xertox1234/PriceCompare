/**
 * Migration Script: Backfill email_hash column for existing users
 *
 * This script computes SHA-256 hashes of decrypted emails for all existing users
 * and populates the email_hash column for indexed lookups.
 *
 * Must be run AFTER the SQL schema migration (0022_add_email_hash_column.sql)
 *
 * USAGE:
 *   tsx migrations/scripts/backfill-email-hashes.ts
 *
 * PREREQUISITES:
 * - ENCRYPTION_KEY must be set in environment
 * - Database must be backed up
 * - Schema migration (0022) must be applied first
 *
 * PATTERN REFERENCE:
 * See docs/ENCRYPTION_KEY_ROTATION.md section "Hash-Based Lookup Columns"
 *
 * @module backfill-email-hashes
 */

import { db } from '../../server/db';
import { users } from '../../shared/schema';
import { decrypt, hashEmail } from '../../server/utils/encryption';
import { sql, isNull } from 'drizzle-orm';

interface MigrationStats {
  totalRecords: number;
  processed: number;
  alreadyHashed: number;
  errors: number;
}

// Batch size for processing large datasets
const BATCH_SIZE = parseInt(process.env.MIGRATION_BATCH_SIZE ?? '100', 10);

/**
 * Main backfill function
 */
async function backfillEmailHashes(): Promise<void> {
  console.log('🔄 Starting email hash backfill...');
  console.log(`   Batch size: ${BATCH_SIZE}`);

  const stats: MigrationStats = {
    totalRecords: 0,
    processed: 0,
    alreadyHashed: 0,
    errors: 0,
  };

  try {
    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(users);
    stats.totalRecords = Number(countResult[0]?.count ?? 0);
    console.log(`   Total users: ${stats.totalRecords}`);

    // Get users without email_hash set
    const usersNeedingHash = await db
      .select({
        id: users.id,
        email: users.email,
        emailHash: users.emailHash,
      })
      .from(users)
      .where(isNull(users.emailHash));

    if (usersNeedingHash.length === 0) {
      console.log('✅ All users already have email hashes. Nothing to do.');
      return;
    }

    console.log(`   Users needing hash: ${usersNeedingHash.length}`);

    // Process in batches
    for (let i = 0; i < usersNeedingHash.length; i += BATCH_SIZE) {
      const batch = usersNeedingHash.slice(i, i + BATCH_SIZE);
      console.log(
        `   Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(usersNeedingHash.length / BATCH_SIZE)}...`
      );

      for (const user of batch) {
        try {
          // Decrypt the email (it's stored encrypted)
          const decryptedEmail = decrypt(user.email);

          // Compute hash of lowercase email
          const emailHashValue = hashEmail(decryptedEmail);

          // Update the user's email_hash
          await db
            .update(users)
            .set({ emailHash: emailHashValue })
            .where(sql`${users.id} = ${user.id}`);

          stats.processed++;
        } catch (error) {
          console.error(`   ❌ Failed to process user ${user.id}:`, error);
          stats.errors++;
        }
      }
    }

    // Summary
    console.log('\n📊 Backfill Summary:');
    console.log(`   Total users: ${stats.totalRecords}`);
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Already hashed: ${stats.totalRecords - usersNeedingHash.length}`);
    console.log(`   Errors: ${stats.errors}`);

    if (stats.errors > 0) {
      console.log('\n⚠️  Some records failed. Review errors above and re-run if needed.');
      process.exit(1);
    }

    console.log('\n✅ Email hash backfill complete!');
    console.log('\n📝 NEXT STEPS:');
    console.log('   1. Verify data: SELECT id, email_hash FROM users WHERE email_hash IS NULL;');
    console.log('   2. Apply constraints migration: 0023_add_email_hash_constraints.sql');
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run if called directly
backfillEmailHashes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
