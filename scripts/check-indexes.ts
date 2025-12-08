#!/usr/bin/env tsx
/**
 * Check all indexes on relevant tables
 */

async function checkIndexes() {
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
    console.log('🔍 Checking all indexes...\n');

    // Check ALL indexes on these tables
    const indexQuery = `
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('price_alerts', 'price_history', 'product_offers')
      ORDER BY tablename, indexname;
    `;

    const result = await pool.query(indexQuery);

    console.log(`Found ${result.rows.length} indexes:\n`);

    let currentTable = '';
    for (const row of result.rows) {
      if (currentTable !== row.tablename) {
        currentTable = String(row.tablename);
        console.log(`\n📋 ${currentTable}:`);
      }
      console.log(`  - ${row.indexname}`);
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkIndexes().catch((error) => {
  console.error(error);
  process.exit(1);
});
