#!/usr/bin/env tsx
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';

loadEnv();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkColumns() {
  const result = await pool.query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'scraping_jobs' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);

  console.log('\nColumns in scraping_jobs table:\n');
  // Type assertion: query() result columns match information_schema.columns structure
  result.rows.forEach((row: { column_name: string; data_type: string; character_maximum_length: number | null }, i: number) => {
    console.log(`${i + 1}. ${row.column_name} (${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''})`);
  });
  console.log(`\nTotal: ${result.rows.length} columns\n`);

  await pool.end();
}

checkColumns().catch(console.error);
