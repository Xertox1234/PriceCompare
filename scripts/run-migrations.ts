#!/usr/bin/env tsx
/**
 * Run database migrations
 *
 * Usage: npm run migrate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

// Load env vars for migrations, matching server behavior.
// NOTE: Use NODE_ENV=test with `.env.test` for E2E/test DB migrations.
loadEnv({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';

  let inSingleQuote = false;
  let dollarTag: string | null = null;
  let inLineComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    // Handle line comments (-- to end of line)
    // Single quotes and dollar quotes inside comments are NOT string delimiters
    if (!inSingleQuote && !dollarTag && !inLineComment && ch === '-' && sql[i + 1] === '-') {
      inLineComment = true;
      current += ch;
      continue;
    }

    // End of line comment
    if (inLineComment && (ch === '\n' || ch === '\r')) {
      inLineComment = false;
      current += ch;
      continue;
    }

    // Skip quote handling inside line comments
    if (inLineComment) {
      current += ch;
      continue;
    }

    // Toggle single-quote strings, respecting escaped quotes ('')
    if (!dollarTag && ch === "'") {
      const next = sql[i + 1];
      current += ch;
      if (inSingleQuote && next === "'") {
        // Escaped quote inside string
        current += next;
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }

    // Enter/exit dollar-quoted blocks ($$ or $tag$)
    if (!inSingleQuote && ch === '$') {
      const rest = sql.slice(i);
      const match = rest.match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        const tag = match[0];
        current += tag;
        i += tag.length - 1;

        if (dollarTag === tag) {
          dollarTag = null;
        } else if (!dollarTag) {
          dollarTag = tag;
        }
        continue;
      }
    }

    // Statement boundary
    if (!inSingleQuote && !dollarTag && ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Detect database type (same logic as server/db.ts)
  const isNeonDatabase =
    process.env.DATABASE_URL?.includes('neon.tech') ||
    process.env.DATABASE_URL?.includes('.pooler.neon.tech');

  // Union type for either Neon or pg Pool
  type PoolClient = {
    query: (text: string, params?: unknown[]) => Promise<unknown>;
    end: () => Promise<void>;
  };
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

    // Ensure a migrations tracking table exists so we can run incrementally.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRows = (await pool.query('SELECT filename FROM schema_migrations')) as unknown as {
      rows?: Array<{ filename: string }>;
    };
    const applied = new Set((appliedRows.rows ?? []).map((r) => r.filename));

    // Read all migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    if (migrationFiles.length === 0) {
      console.log('⚠️  No migration files found in migrations/');
      return;
    }

    const idempotentErrorCodes = new Set([
      '42710', // duplicate_object
      '42P07', // duplicate_table
      '42701', // duplicate_column
      '42P06', // duplicate_schema
      '42P16', // invalid_table_definition (often constraint already exists)
      '23505', // unique_violation (already inserted)
    ]);

    // Run each migration
    for (const file of migrationFiles) {
      if (applied.has(file)) {
        continue;
      }
      console.log(`📄 Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      try {
        const statements = splitSqlStatements(sql);
        for (const statement of statements) {
          await pool.query(statement);
        }

        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
          [file]
        );
        console.log(`✅ Migration ${file} completed successfully\n`);
      } catch (error) {
        const err = error as { code?: string; message?: string };
        const message = err.message ?? '';

        // If the DB already has the object(s) this migration creates, mark it as applied
        // and keep going. This keeps local/test DBs from breaking when re-running.
        if (
          (err.code && idempotentErrorCodes.has(err.code)) ||
          /already exists|duplicate/i.test(message)
        ) {
          console.warn(`⚠️  Migration ${file} appears already applied; recording and continuing`);
          await pool.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
            [file]
          );
          console.log(`✅ Migration ${file} recorded as applied\n`);
          continue;
        }

        throw error;
      }
    }

    console.log('✨ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});
