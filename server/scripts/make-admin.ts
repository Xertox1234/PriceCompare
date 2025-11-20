import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const log = createLogger('MakeAdmin');

const email = process.argv[2];

if (!email) {
  log.error('Usage: tsx server/scripts/make-admin.ts <email>');
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
      log.error('No user found with email', { email });
      process.exit(1);
    }

    log.info('User promoted to admin', { email });
    process.exit(0);
  } catch (error) {
    log.error('Error making user admin', {
      email,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

makeAdmin();
