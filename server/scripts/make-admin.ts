import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const email = process.argv[2];

if (!email) {
  console.error('Usage: tsx server/scripts/make-admin.ts <email>');
  process.exit(1);
}

async function makeAdmin() {
  try {
    const result = await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.email, email))
      .returning();

    if (result.length === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    console.log(`✅ User ${email} is now an admin!`);
    process.exit(0);
  } catch (error) {
    console.error('Error making user admin:', error);
    process.exit(1);
  }
}

makeAdmin();
