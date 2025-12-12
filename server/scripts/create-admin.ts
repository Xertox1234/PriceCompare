import 'dotenv/config';
import { db } from '../db';
import { users } from '../../shared/schema';
import bcrypt from 'bcrypt';
import { createLogger } from '../utils/logger';
import { PASSWORD } from '../utils/constants';
import { hashEmail } from '../utils/encryption';

const log = createLogger('CreateAdmin');

async function createAdmin() {
  try {
    // SECURITY: Read admin password from environment variable instead of hardcoding
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      log.error('ADMIN_PASSWORD environment variable is required');
      log.error('Please set ADMIN_PASSWORD before running this script');
      log.error('Example: ADMIN_PASSWORD="YourSecurePassword123!" npm run create-admin');
      process.exit(1);
    }

    // Validate password meets security requirements
    const { validatePassword } = await import('../utils/validation-helpers');
    const passwordValidation = validatePassword(adminPassword);

    if (!passwordValidation.valid) {
      log.error('Admin password does not meet security requirements:', {
        errors: passwordValidation.errors,
      });
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(adminPassword, PASSWORD.BCRYPT_ROUNDS);

    const result = await db
      .insert(users)
      .values({
        email: 'admin@pricecompare.com',
        username: 'admin',
        emailHash: hashEmail('admin@pricecompare.com'), // SHA-256 hash for indexed lookups
        passwordHash: hashedPassword,
        role: 'admin',
      })
      .returning();

    log.info('Admin user created successfully', {
      email: 'admin@pricecompare.com',
      username: 'admin',
      role: 'admin',
    });
    log.warn('Please save your admin password securely - it cannot be recovered');
    process.exit(0);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      // Unique constraint violation
      log.warn('Admin user already exists');
      process.exit(0);
    }
    log.error('Error creating admin user', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

createAdmin();
