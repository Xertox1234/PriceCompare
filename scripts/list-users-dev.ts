/**
 * DEV ONLY: List all users in the database
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

async function listUsers() {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .limit(20);

  console.log('\n📋 Users in database:\n');

  if (result.length === 0) {
    console.log('   No users found. Register a new account!\n');
  } else {
    result.forEach((u) => {
      console.log(`   ID: ${u.id} | Username: ${u.username} | Email: ${u.email} | Role: ${u.role}`);
    });
    console.log('');
  }

  process.exit(0);
}

listUsers().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
