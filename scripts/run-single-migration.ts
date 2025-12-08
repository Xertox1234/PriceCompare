#!/usr/bin/env tsx
/**
 * Run a single database migration
 * Usage: tsx scripts/run-single-migration.ts migrations/0013_add_daily_price_aggregates.sql
 */

import fs from 'fs';
import path from 'path';

async function runSingleMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('Usage: tsx scripts/run-single-migration.ts <migration-file>');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Detect database type
  const isNeonDatabase =
    process.env.DATABASE_URL?.includes('neon.tech') ||
    process.env.DATABASE_URL?.includes('.pooler.neon.tech');

  // Union type for either Neon or pg Pool
  type PoolClient = { query: (text: string) => Promise<unknown>; end: () => Promise<void> };
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
    console.log(`🔄 Running migration: ${path.basename(migrationFile)}\n`);

    const sql = fs.readFileSync(migrationFile, 'utf-8');
    await pool.query(sql);

    console.log(`✅ Migration completed successfully!`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runSingleMigration().catch((error) => {
  console.error(error);
  process.exit(1);
});
