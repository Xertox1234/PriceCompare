import 'dotenv/config';
import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import bcrypt from 'bcrypt';
import { createLogger } from '../utils/logger';

const log = createLogger('CreateAdmin');

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('Admin123!', 12);

    const result = await db.insert(users).values({
      email: 'admin@pricecompare.com',
      username: 'admin',
      passwordHash: hashedPassword,
      role: 'admin',
    }).returning();

    log.info('Admin user created successfully', {
      email: 'admin@pricecompare.com',
      username: 'admin',
      role: 'admin'
    });
    log.info('Default password: Admin123! (please change after first login)');
    process.exit(0);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') { // Unique constraint violation
      log.warn('Admin user already exists');
      process.exit(0);
    }
    log.error('Error creating admin user', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

createAdmin();
