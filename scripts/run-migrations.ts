#!/usr/bin/env tsx
/**
 * Run database migrations
 *
 * Usage: npm run migrate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Detect database type (same logic as server/db.ts)
  const isNeonDatabase = process.env.DATABASE_URL?.includes('neon.tech') ||
                         process.env.DATABASE_URL?.includes('.pooler.neon.tech');

  // Union type for either Neon or pg Pool
  type PoolClient = { query: (text: string) => Promise<unknown>; end: () => Promise<void> };
  let pool: PoolClient;

  if (isNeonDatabase) {
    // Use Neon serverless driver for cloud deployment
    const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');
    neonConfig.webSocketConstructor = ws.default;
    pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  } else {
    // Use standard pg driver for local PostgreSQL
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  }

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

      // Check if migration contains CONCURRENT operations (cannot run in transaction)
      const hasConcurrentOps = /CREATE\s+INDEX\s+CONCURRENTLY|DROP\s+INDEX\s+CONCURRENTLY|REINDEX\s+CONCURRENTLY/i.test(sql);

      if (hasConcurrentOps) {
        console.log('   ⚠️  Migration contains CONCURRENT operations - executing outside transaction');

        // Split SQL by semicolons, filter out comments and empty statements
        const statements = sql
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
          .filter(stmt => !/^\/\*[\s\S]*?\*\/$/.test(stmt)); // Remove multi-line comments

        // Execute each statement separately (required for CONCURRENT operations)
        for (const statement of statements) {
          if (statement.trim()) {
            await pool.query(statement);
          }
        }
      } else {
        // Regular migration - can run in single query
        await pool.query(sql);
      }

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
