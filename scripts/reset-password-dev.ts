/**
 * DEV ONLY: Reset a user's password directly in the database
 * Usage: npx tsx scripts/reset-password-dev.ts
 */

// Production safety guard
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR: This script cannot run in production');
  console.error('   Set NODE_ENV to "development" or "test" to proceed');
  process.exit(1);
}

import 'dotenv/config';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { hashEmail } from '../server/utils/encryption';
import { PASSWORD } from '../server/utils/constants';

const EMAIL = 'dev@example.com';
const NEW_PASSWORD = 'password123'; // Change this to your desired password

async function resetPassword() {
  console.log(`\n🔐 Resetting password for: ${EMAIL}\n`);

  // DEV SCRIPT: Use reduced bcrypt rounds for faster testing
  const passwordHash = await bcrypt.hash(NEW_PASSWORD, PASSWORD.BCRYPT_ROUNDS_TEST);

  // Create email hash for lookup (emails are encrypted in DB)
  const emailHash = hashEmail(EMAIL);

  // Find and update the user
  const result = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.emailHash, emailHash))
    .returning({ id: users.id, username: users.username });

  if (result.length === 0) {
    console.log('❌ No user found with that email address.');
    process.exit(1);
  }

  console.log(`✅ Password reset successfully!`);
  console.log(`   User: ${result[0].username} (ID: ${result[0].id})`);
  console.log(`   New password: ${NEW_PASSWORD}`);
  console.log(`\n   You can now log in at http://localhost:5001\n`);

  process.exit(0);
}

resetPassword().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
