#!/usr/bin/env tsx
/**
 * Analyze existing indexes to see if they match our requirements
 */

async function analyzeIndexes() {
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
    console.log('🔍 Analyzing existing indexes...\n');

    // Get detailed index definitions
    const indexQuery = `
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('price_alerts', 'price_history', 'product_offers')
        AND indexname LIKE 'idx%'
      ORDER BY tablename, indexname;
    `;

    const result = await pool.query(indexQuery);

    console.log('📋 Existing indexes with definitions:\n');

    for (const row of result.rows) {
      console.log(`Table: ${row.tablename}`);
      console.log(`Index: ${row.indexname}`);
      console.log(`Definition: ${row.indexdef}`);
      console.log('---');
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

analyzeIndexes().catch((error) => {
  console.error(error);
  process.exit(1);
});
