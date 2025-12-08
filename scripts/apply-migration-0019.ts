#!/usr/bin/env tsx
/**
 * Apply migration 0019: Fix product_watches unique constraint
 * This migration fixes the duplicate product constraint bug
 */

import fs from 'fs';
import path from 'path';

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Detect database type
  const isNeonDatabase =
    process.env.DATABASE_URL?.includes('neon.tech') ||
    process.env.DATABASE_URL?.includes('.pooler.neon.tech');

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
    console.log('🔄 Applying migration 0019_fix_product_watches_unique_constraint.sql...\n');

    // Read the migration file
    const migrationPath = path.join(
      process.cwd(),
      'migrations',
      '0019_fix_product_watches_unique_constraint.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the entire migration as one statement
    await pool.query(migrationSQL);

    console.log('✅ Migration 0019 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration().catch((error) => {
  console.error(error);
  process.exit(1);
});
