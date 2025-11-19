import 'dotenv/config';
import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import bcrypt from 'bcrypt';

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('Admin123!', 12);

    const result = await db.insert(users).values({
      email: 'admin@pricecompare.com',
      username: 'admin',
      passwordHash: hashedPassword,
      role: 'admin',
    }).returning();

    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@pricecompare.com');
    console.log('Password: Admin123!');
    console.log('Role: admin');
    process.exit(0);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') { // Unique constraint violation
      console.log('⚠️  Admin user already exists');
      process.exit(0);
    }
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdmin();
