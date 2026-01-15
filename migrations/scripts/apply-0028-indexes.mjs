#!/usr/bin/env node
/**
 * Migration Script: Apply 0028 - Add Missing Performance Indexes
 *
 * Applies the 0028 migration to add performance indexes for:
 * - products.created_at (recent products queries)
 * - product_offers.last_updated (stale offer detection)
 *
 * Usage: node migrations/scripts/apply-0028-indexes.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Connecting to database...');
    const client = await pool.connect();

    try {
      console.log('📖 Reading migration file...');
      const migrationPath = join(__dirname, '..', '0028_add_missing_performance_indexes.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      console.log('🚀 Applying migration 0028...\n');

      // Execute the migration statements separately (CONCURRENTLY requires non-transactional context)
      // Extract CREATE INDEX statements using regex to handle multi-line statements
      const createIndexRegex = /CREATE\s+INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\s+[\w_]+\s+ON\s+[\w_]+\([^)]+\);/gi;
      const indexStatements = migrationSQL.match(createIndexRegex) || [];

      console.log(`  Found ${indexStatements.length} index statements to execute\n`);

      for (const statement of indexStatements) {
        const indexName = statement.match(/CREATE INDEX.*?EXISTS\s+([\w_]+)/i)?.[1] || 'unknown';
        console.log(`  Creating index: ${indexName}...`);
        await client.query(statement);
        console.log(`  ✓ ${indexName} created`);
      }

      console.log('✅ Migration 0028 applied successfully!\n');

      // Verify indexes exist
      console.log('🔍 Verifying indexes...');
      const indexCheck = await client.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE indexname IN ('products_created_at_idx', 'product_offers_last_updated_idx')
        ORDER BY tablename, indexname;
      `);

      if (indexCheck.rows.length === 2) {
        console.log('✅ Both indexes verified:\n');
        indexCheck.rows.forEach(row => {
          console.log(`  - ${row.tablename}.${row.indexname}`);
        });
      } else {
        console.warn('⚠️  Warning: Expected 2 indexes but found', indexCheck.rows.length);
      }

      // Test index usage with EXPLAIN
      console.log('\n📊 Testing index usage with EXPLAIN...\n');

      const test1 = await client.query(`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM products
        ORDER BY created_at DESC
        LIMIT 20;
      `);
      const plan1 = test1.rows[0]['QUERY PLAN'][0].Plan;
      console.log('Query 1: Recent products');
      console.log(`  Index Used: ${plan1['Index Name'] || 'No index (Seq Scan)'}`);
      console.log(`  Scan Type: ${plan1['Node Type']}`);

      const test2 = await client.query(`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM product_offers
        WHERE last_updated < NOW() - INTERVAL '24 hours'
        LIMIT 100;
      `);
      const plan2 = test2.rows[0]['QUERY PLAN'][0].Plan;
      console.log('\nQuery 2: Stale offers');
      console.log(`  Index Used: ${plan2['Index Name'] || 'No index (Seq Scan)'}`);
      console.log(`  Scan Type: ${plan2['Node Type']}`);

      console.log('\n✅ Migration complete!');

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
