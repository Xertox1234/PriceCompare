#!/usr/bin/env tsx
/**
 * Run database migrations
 *
 * Usage: npm run migrate
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

neonConfig.webSocketConstructor = ws;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔄 Starting database migrations...\n');

    // Read all migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    if (migrationFiles.length === 0) {
      console.log('⚠️  No migration files found in migrations/');
      return;
    }

    // Run each migration
    for (const file of migrationFiles) {
      console.log(`📄 Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await pool.query(sql);
      console.log(`✅ Migration ${file} completed successfully\n`);
    }

    console.log('✨ All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch(error => {
  console.error(error);
  process.exit(1);
});
