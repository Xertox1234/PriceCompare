#!/usr/bin/env tsx
/**
 * Apply migrations 0026 and 0027 specifically
 *
 * These migrations use BEGIN/COMMIT blocks and can be executed atomically.
 * This script bypasses the SQL statement splitting issues in the main migration runner.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

// Load env vars
loadEnv({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log(`📍 Database: ${process.env.DATABASE_URL.split('@')[1]}\n`);

  // Detect database type
  const isNeonDatabase =
    process.env.DATABASE_URL?.includes('neon.tech') ||
    process.env.DATABASE_URL?.includes('.pooler.neon.tech');

  type PoolClient = {
    query: (text: string, params?: unknown[]) => Promise<unknown>;
    end: () => Promise<void>;
  };
  let pool: PoolClient;

  if (isNeonDatabase) {
    const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');
    neonConfig.webSocketConstructor = ws.default;
    pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  } else {
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  }

  try {
    console.log('🔍 Checking migration status...\n');

    // Ensure migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Check which migrations are already applied
    const appliedRows = (await pool.query('SELECT filename FROM schema_migrations')) as {
      rows: Array<{ filename: string }>;
    };
    const applied = new Set(appliedRows.rows.map((r) => r.filename));

    const migrations = [
      '0026_create_scraping_tables.sql',
      '0027_create_price_snapshots.sql',
    ];

    for (const filename of migrations) {
      if (applied.has(filename)) {
        console.log(`⏭️  Migration ${filename} already applied, skipping\n`);
        continue;
      }

      console.log(`📄 Applying migration: ${filename}`);

      const migrationPath = path.join(__dirname, '..', 'migrations', filename);

      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
      }

      const sql = fs.readFileSync(migrationPath, 'utf-8');

      try {
        // Execute entire migration as single SQL (BEGIN/COMMIT handles atomicity)
        await pool.query(sql);

        // Record migration as applied
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
          [filename]
        );

        console.log(`✅ Migration ${filename} completed successfully\n`);
      } catch (error) {
        const err = error as { code?: string; message?: string };

        // Check if it's an idempotent error (objects already exist)
        if (
          err.code === '42P07' || // duplicate_table
          err.code === '42710' || // duplicate_object
          /already exists/i.test(err.message || '')
        ) {
          console.warn(
            `⚠️  Migration ${filename} objects already exist, recording as applied\n`
          );
          await pool.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
            [filename]
          );
        } else {
          throw error;
        }
      }
    }

    console.log('✨ Migrations 0026 and 0027 processing complete!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});
