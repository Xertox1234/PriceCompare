/**
 * E2E Global Setup
 *
 * Runs ONCE before all E2E tests to ensure test database schema is up-to-date.
 * This eliminates schema drift risk by running production migrations instead of
 * manually creating tables in cleanDatabase().
 *
 * SAFETY: Only runs when NODE_ENV=test (enforced by run-migrations.ts)
 */

/* eslint-disable no-console -- Setup script needs console output for migration progress */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment
loadEnv({ path: '.env.test' });

/**
 * Split SQL statements for individual execution
 * Handles single quotes, dollar-quoted blocks, and statement boundaries
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';

  let inSingleQuote = false;
  let dollarTag: string | null = null;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

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

/**
 * Run database migrations before E2E tests
 * Uses same logic as scripts/run-migrations.ts for consistency
 */
async function globalSetup() {
  // SAFETY: Validate test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'E2E global setup can only run when NODE_ENV=test. ' +
        `Current NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // SAFETY: Validate database name contains "test"
  try {
    const url = new URL(process.env.DATABASE_URL);
    const dbName = url.pathname.slice(1);
    if (!dbName.includes('test')) {
      throw new Error(
        `Refusing to run migrations on database "${dbName}" - name must contain "test". ` +
          `Set DATABASE_NAME=pricecompare_test in .env.test`
      );
    }
  } catch (error) {
    if (error instanceof TypeError) {
      console.warn(`⚠️  Could not parse DATABASE_URL for validation`);
    } else {
      throw error;
    }
  }

  console.log('🔄 Running E2E database migrations...\n');

  // Detect database type (matches server/db.ts)
  const isNeonDatabase =
    process.env.DATABASE_URL?.includes('neon.tech') ||
    process.env.DATABASE_URL?.includes('.pooler.neon.tech');

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
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRows = (await pool.query('SELECT filename FROM schema_migrations')) as {
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

    // PostgreSQL error codes for idempotent operations
    const idempotentErrorCodes = new Set([
      '42710', // duplicate_object
      '42P07', // duplicate_table
      '42701', // duplicate_column
      '42P06', // duplicate_schema
      '42P16', // invalid_table_definition (constraint already exists)
      '23505', // unique_violation (already inserted)
    ]);

    let appliedCount = 0;
    let skippedCount = 0;

    // Run each migration
    for (const file of migrationFiles) {
      if (applied.has(file)) {
        skippedCount++;
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
        appliedCount++;
      } catch (error) {
        const err = error as { code?: string; message?: string };
        const message = err.message ?? '';

        // If object already exists, mark migration as applied and continue
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
          appliedCount++;
          continue;
        }

        throw error;
      }
    }

    console.log(`✨ E2E migrations complete! (${appliedCount} applied, ${skippedCount} skipped)\n`);

    // SCHEMA VALIDATION: Verify all expected tables exist
    // See: TODO_012, docs/08_TESTING_PATTERNS.md
    console.log('🔍 Validating test database schema...');

    /**
     * Expected tables in test database schema
     *
     * CRITICAL MAINTENANCE RULE:
     * When adding new migrations that create tables:
     * 1. Add the table name to this list (keep alphabetically sorted)
     * 2. Commit the list update in the SAME commit as the migration
     * 3. Table names must match pgTable definitions in shared/schema.ts
     *
     * Currently tracking 41 tables (as of schema.ts audit 2026-01-06)
     *
     * See: CLAUDE.md "Test Schema Synchronization"
     */
    const EXPECTED_TABLES = [
      'agent_sessions',
      'badges',
      'deal_spottings',
      'forum_categories',
      'forum_posts',
      'forum_topics',
      'job_locks',
      'notification_preferences',
      'notifications',
      'password_reset_tokens',
      'post_likes',
      'post_mentions',
      'post_revisions',
      'price_aggregates_daily',
      'price_aggregates_monthly',
      'price_aggregates_weekly',
      'price_alerts',
      'price_history',
      'price_predictions',
      'price_snapshots',
      'price_trends',
      'private_messages',
      'product_offers',
      'product_specifications',
      'product_urls',
      'product_watches',
      'products',
      'retailers',
      'scraping_jobs',
      'scraping_sources',
      'search_queries',
      'topic_tag_relations',
      'topic_tags',
      'trending_products',
      'user_badges',
      'user_reputation',
      'users',
      'watch_list_shares',
      'watch_lists',
      'wishlist_items',
      'wishlists',
    ] as const satisfies readonly string[];

    type TableRow = {
      table_name: string;
    };

    const result = (await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `)) as { rows: TableRow[] };

    // Use Set for O(1) lookup instead of O(n) includes
    const existingSet = new Set(
      result.rows.map((row) => row.table_name)
    );

    const missingTables = EXPECTED_TABLES.filter(
      (table) => !existingSet.has(table)
    );

    if (missingTables.length > 0) {
      console.error('❌ Schema drift detected - missing tables:');
      missingTables.forEach((table) => {
        console.error(`   - ${table}`);
      });
      console.error('');
      console.error('💡 This should not happen after migrations.');
      console.error('   Check migrations/ directory for missing or failed migrations.');
      console.error('');
      console.error('📚 See: CLAUDE.md "Test Schema Synchronization"');

      throw new Error(
        `Schema validation failed: ${missingTables.length} table(s) missing: ${missingTables.join(', ')}`
      );
    }

    console.log(
      `✅ Schema validated - all ${EXPECTED_TABLES.length} tables present\n`
    );
  } catch (error) {
    console.error('❌ E2E migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/* eslint-enable no-console */

export default globalSetup;
