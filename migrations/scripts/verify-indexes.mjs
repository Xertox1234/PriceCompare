#!/usr/bin/env node
/**
 * Verify indexes exist in database
 */
import pg from 'pg';
const { Pool } = pg;

async function verifyIndexes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://williamtower@localhost:5432/price_db',
  });

  try {
    const client = await pool.connect();

    try {
      console.log('🔍 Checking database indexes...\n');

      // Query all indexes on relevant tables
      const result = await client.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename IN ('products', 'product_offers', 'price_history', 'price_alerts')
        ORDER BY tablename, indexname;
      `);

      const byTable = result.rows.reduce((acc, row) => {
        if (!acc[row.tablename]) acc[row.tablename] = [];
        acc[row.tablename].push(row);
        return acc;
      }, {});

      Object.entries(byTable).forEach(([table, indexes]) => {
        console.log(`\n📊 ${table} (${indexes.length} indexes)`);
        indexes.forEach(idx => {
          const highlight = idx.indexname.includes('created_at') || idx.indexname.includes('last_updated') ? '✨' : '  ';
          console.log(`${highlight} ${idx.indexname}`);
        });
      });

      console.log('\n✅ Index verification complete!');
      console.log(`\nTotal indexes found: ${result.rows.length}`);

      // Check specifically for our new indexes
      const newIndexes = result.rows.filter(r =>
        r.indexname === 'products_created_at_idx' || r.indexname === 'product_offers_last_updated_idx'
      );

      if (newIndexes.length === 2) {
        console.log('\n✅ Both new indexes from migration 0028 are present!');
      } else {
        console.log(`\n⚠️  Expected 2 new indexes, found ${newIndexes.length}`);
      }

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyIndexes();
