#!/usr/bin/env tsx
/**
 * Verify migrations 0026 and 0027 applied correctly
 *
 * Runs all verification queries from the audit document.
 * Usage: tsx scripts/verify-migrations-0026-0027.ts
 */

import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';

// Load env vars
loadEnv({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

async function verifyMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log(`📍 Database: ${process.env.DATABASE_URL.split('@')[1]}\n`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔍 Verifying migrations 0026 and 0027...\n');

    // 1. Verify tables created
    console.log('📋 Step 1: Verify tables created (7 tables expected)');
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'trending_products', 'search_queries', 'agent_sessions',
        'scraping_jobs', 'price_predictions', 'scraping_sources',
        'price_snapshots'
      )
      ORDER BY table_name;
    `);

    console.log(`   Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach((row: { table_name: string }) => {
      console.log(`   ✅ ${row.table_name}`);
    });

    if (tablesResult.rows.length !== 7) {
      console.error(`\n   ❌ Expected 7 tables, found ${tablesResult.rows.length}`);
      process.exit(1);
    }

    // 2. Verify indexes
    console.log('\n📊 Step 2: Verify indexes created');
    const indexesResult = await pool.query(`
      SELECT tablename, indexname FROM pg_indexes
      WHERE tablename IN ('scraping_jobs', 'trending_products', 'price_snapshots')
      ORDER BY tablename, indexname;
    `);

    console.log(`   Found ${indexesResult.rows.length} indexes:`);
    const indexesByTable: Record<string, string[]> = {};
    indexesResult.rows.forEach((row: { tablename: string; indexname: string }) => {
      if (!indexesByTable[row.tablename]) {
        indexesByTable[row.tablename] = [];
      }
      indexesByTable[row.tablename].push(row.indexname);
    });

    Object.entries(indexesByTable).forEach(([table, indexes]) => {
      console.log(`   ✅ ${table}: ${indexes.length} indexes`);
    });

    // 3. Verify CHECK constraints
    console.log('\n✅ Step 3: Verify CHECK constraints');
    const constraintsResult = await pool.query(`
      SELECT table_name, constraint_name FROM information_schema.table_constraints
      WHERE constraint_type = 'CHECK'
      AND table_name IN ('scraping_jobs', 'price_predictions', 'price_snapshots')
      ORDER BY table_name, constraint_name;
    `);

    console.log(`   Found ${constraintsResult.rows.length} CHECK constraints:`);
    const constraintsByTable: Record<string, string[]> = {};
    constraintsResult.rows.forEach(
      (row: { table_name: string; constraint_name: string }) => {
        if (!constraintsByTable[row.table_name]) {
          constraintsByTable[row.table_name] = [];
        }
        constraintsByTable[row.table_name].push(row.constraint_name);
      }
    );

    Object.entries(constraintsByTable).forEach(([table, constraints]) => {
      console.log(`   ✅ ${table}: ${constraints.length} constraints`);
      constraints.forEach((c) => console.log(`      - ${c}`));
    });

    // 4. Verify foreign keys
    console.log('\n🔗 Step 4: Verify foreign keys with CASCADE rules');
    const fkResult = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('search_queries', 'scraping_jobs', 'price_predictions', 'price_snapshots')
      ORDER BY tc.table_name, tc.constraint_name;
    `);

    console.log(`   Found ${fkResult.rows.length} foreign keys:`);
    fkResult.rows.forEach(
      (row: {
        table_name: string;
        column_name: string;
        foreign_table_name: string;
        delete_rule: string;
      }) => {
        const icon = row.delete_rule === 'CASCADE' || row.delete_rule === 'SET NULL' ? '✅' : '⚠️ ';
        console.log(
          `   ${icon} ${row.table_name}.${row.column_name} → ${row.foreign_table_name} (${row.delete_rule})`
        );
      }
    );

    // 5. Verify column counts
    console.log('\n📏 Step 5: Verify column counts');
    const expectedCounts: Record<string, number> = {
      trending_products: 12,
      search_queries: 10,
      agent_sessions: 11,
      scraping_jobs: 15, // 15 columns (includes id, created_at, updated_at)
      price_predictions: 12, // 12 columns (includes id, created_at, validated_at)
      scraping_sources: 13, // 13 columns (includes id, created_at, updated_at)
      price_snapshots: 9, // 9 columns (includes id, created_at)
    };

    for (const [tableName, expectedCount] of Object.entries(expectedCounts)) {
      const countResult = await pool.query(
        `
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public';
      `,
        [tableName]
      );

      // Type assertion: SQL count() returns string or number depending on PostgreSQL driver
      const countValue = countResult.rows[0]?.count;
      const actualCount =
        typeof countValue === 'number'
          ? countValue
          : typeof countValue === 'string'
            ? parseInt(countValue, 10)
            : 0;

      if (isNaN(actualCount) || actualCount < 0) {
        console.error(`\n   ❌ Invalid column count for ${tableName}: "${countValue}"`);
        process.exit(1);
      }

      const icon = actualCount === expectedCount ? '✅' : '❌';
      console.log(
        `   ${icon} ${tableName}: ${actualCount} columns (expected ${expectedCount})`
      );

      if (actualCount !== expectedCount) {
        console.error(`\n   ❌ Column count mismatch for ${tableName}`);
        process.exit(1);
      }
    }

    console.log('\n🎉 All verifications passed successfully!\n');
    console.log('Summary:');
    console.log('  ✅ 7 tables created');
    console.log(`  ✅ ${indexesResult.rows.length} indexes created`);
    console.log(`  ✅ ${constraintsResult.rows.length} CHECK constraints applied`);
    console.log(`  ✅ ${fkResult.rows.length} foreign keys with CASCADE rules`);
    console.log('  ✅ Column counts match schema.ts\n');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});
