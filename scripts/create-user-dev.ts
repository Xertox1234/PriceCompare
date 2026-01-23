/**
 * DEV ONLY: Create a user directly in the database (bypasses rate limiting)
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
import bcrypt from 'bcrypt';
import { hashEmail } from '../server/utils/encryption';

const USERNAME = 'devuser';
const EMAIL = 'dev@example.com';
const PASSWORD = 'password123';
const ROLE = 'admin'; // Give admin access for testing

async function createUser() {
  console.log(`\n🔐 Creating user: ${USERNAME} (${EMAIL})\n`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const emailHash = hashEmail(EMAIL);

  try {
    const result = await db
      .insert(users)
      .values({
        username: USERNAME,
        email: EMAIL,
        emailHash: emailHash,
        passwordHash: passwordHash,
        role: ROLE,
        isActive: true,
        isSuspended: false,
        trustLevel: 2,
        reputation: 100,
      })
      .returning({ id: users.id, username: users.username });

    console.log(`✅ User created successfully!`);
    console.log(`   ID: ${result[0].id}`);
    console.log(`   Username: ${result[0].username}`);
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log(`   Role: ${ROLE}`);
    console.log(`\n   Login at: http://localhost:5001\n`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('duplicate')) {
      console.log(`❌ User already exists. Updating password instead...`);

      await db
        .update(users)
        .set({ passwordHash })
        .where(require('drizzle-orm').eq(users.emailHash, emailHash));

      console.log(`✅ Password updated!`);
      console.log(`   Email: ${EMAIL}`);
      console.log(`   New Password: ${PASSWORD}`);
    } else {
      throw err;
    }
  }

  process.exit(0);
}

createUser().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
