#!/usr/bin/env tsx
/**
 * Verify database indexes for migration 0021
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function verifyIndexes() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const isNeonDatabase =
    process.env.DATABASE_URL?.includes('neon.tech') ||
    process.env.DATABASE_URL?.includes('.pooler.neon.tech');

  type PoolClient = {
    query: (text: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
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
    console.log('🔍 Verifying indexes from migration 0021...\n');

    // Check if indexes exist
    const indexQuery = `
      SELECT
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
      FROM pg_indexes
      WHERE indexname IN (
        'idx_price_alerts_active_product',
        'idx_price_history_aggregated_cleanup',
        'idx_product_offers_product_retailer_price'
      )
      ORDER BY tablename, indexname;
    `;

    const result = await pool.query(indexQuery);

    if (result.rows.length === 0) {
      console.log('❌ No indexes found! Migration may have failed.\n');
      return;
    }

    console.log('✅ Found indexes:\n');
    console.log('Table                | Index Name                                      | Size');
    console.log('-'.repeat(85));

    for (const row of result.rows) {
      const table = String(row.tablename).padEnd(20);
      const index = String(row.indexname).padEnd(48);
      const size = String(row.index_size);
      console.log(`${table} | ${index} | ${size}`);
    }

    console.log('\n📊 Table statistics:\n');

    // Get table row counts
    const statsQuery = `
      SELECT
        'price_alerts' as table_name,
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE is_active = true) as filtered_rows,
        pg_size_pretty(pg_total_relation_size('price_alerts')) as total_size
      FROM price_alerts
      UNION ALL
      SELECT
        'price_history',
        COUNT(*),
        COUNT(*) FILTER (WHERE aggregated_at IS NOT NULL),
        pg_size_pretty(pg_total_relation_size('price_history'))
      FROM price_history
      UNION ALL
      SELECT
        'product_offers',
        COUNT(*),
        COUNT(*),
        pg_size_pretty(pg_total_relation_size('product_offers'))
      FROM product_offers;
    `;

    const statsResult = await pool.query(statsQuery);

    console.log('Table            | Total Rows | Filtered Rows | Total Size');
    console.log('-'.repeat(65));

    for (const row of statsResult.rows) {
      const table = String(row.table_name).padEnd(16);
      const total = String(row.total_rows).padStart(10);
      const filtered = String(row.filtered_rows).padStart(13);
      const size = String(row.total_size);
      console.log(`${table} | ${total} | ${filtered} | ${size}`);
    }

    console.log('\n✨ Index verification complete!\n');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyIndexes().catch((error) => {
  console.error(error);
  process.exit(1);
});
