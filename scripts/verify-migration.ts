#!/usr/bin/env tsx
import { Pool } from 'pg';

async function verify() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'price_aggregates_daily'
      ORDER BY ordinal_position
    `);

    console.log('✅ price_aggregates_daily table structure:');
    result.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

    const checkAggregated = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'price_history' AND column_name = 'aggregated_at'
    `);

    if (checkAggregated.rows.length > 0) {
      console.log('\n✅ price_history.aggregated_at column added');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

verify();
