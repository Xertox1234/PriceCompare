#!/usr/bin/env tsx
/**
 * Manually create the 3 new indexes one at a time to see any errors
 */

async function createIndexes() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const isNeonDatabase = process.env.DATABASE_URL?.includes('neon.tech') ||
                         process.env.DATABASE_URL?.includes('.pooler.neon.tech');

  type PoolClient = { query: (text: string) => Promise<{ rows: Array<Record<string, unknown>> }>; end: () => Promise<void> };
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

  const indexes = [
    {
      name: 'idx_price_alerts_active_product',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_alerts_active_product
            ON price_alerts(product_id, is_active, target_price)
            WHERE is_active = true`
    },
    {
      name: 'idx_price_history_aggregated_cleanup',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_aggregated_cleanup
            ON price_history (recorded_at)
            WHERE aggregated_at IS NOT NULL`
    },
    {
      name: 'idx_product_offers_product_retailer_price',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_offers_product_retailer_price
            ON product_offers (product_id, retailer_id, price)`
    }
  ];

  try {
    for (const index of indexes) {
      console.log(`\n🔨 Creating index: ${index.name}...`);
      try {
        await pool.query(index.sql);
        console.log(`✅ Successfully created ${index.name}`);
      } catch (error) {
        const err = error as { message?: string; code?: string };
        console.log(`⚠️  ${index.name}: ${err.message || 'Unknown error'} (code: ${err.code || 'N/A'})`);
      }
    }

    console.log('\n📊 Verifying indexes were created...\n');

    const verifyQuery = `
      SELECT indexname
      FROM pg_indexes
      WHERE indexname IN (
        'idx_price_alerts_active_product',
        'idx_price_history_aggregated_cleanup',
        'idx_product_offers_product_retailer_price'
      );
    `;

    const result = await pool.query(verifyQuery);

    if (result.rows.length > 0) {
      console.log('✅ Found indexes:');
      for (const row of result.rows) {
        console.log(`  - ${row.indexname}`);
      }
    } else {
      console.log('❌ No indexes found!');
    }

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createIndexes().catch(error => {
  console.error(error);
  process.exit(1);
});
