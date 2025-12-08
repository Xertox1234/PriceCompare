#!/usr/bin/env tsx
/**
 * Apply a single migration file
 *
 * Usage: tsx scripts/apply-single-migration.ts <migration-file>
 * Example: tsx scripts/apply-single-migration.ts 0021_add_performance_indexes.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applySingleMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('❌ Usage: tsx scripts/apply-single-migration.ts <migration-file>');
    console.error(
      '   Example: tsx scripts/apply-single-migration.ts 0021_add_performance_indexes.sql'
    );
    process.exit(1);
  }

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
    console.log(`🔄 Applying migration: ${migrationFile}\n`);

    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split SQL into individual statements for CONCURRENTLY operations
    // CREATE INDEX CONCURRENTLY cannot run inside a transaction block

    // Remove line comments before splitting to avoid parsing issues
    const withoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const statements = withoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      if (statement.length > 0) {
        console.log(`  Executing: ${statement.substring(0, 80)}...`);
        await pool.query(statement);
      }
    }

    console.log(`✅ Migration ${migrationFile} completed successfully!\n`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applySingleMigration().catch((error) => {
  console.error(error);
  process.exit(1);
});
