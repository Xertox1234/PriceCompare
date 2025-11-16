#!/usr/bin/env node

/**
 * Simple migration runner for job_locks table
 * Can be run directly with Node.js without tsx
 *
 * Usage: node migrations/run-job-locks-migration.js
 */

const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('\n❌ ERROR: DATABASE_URL environment variable is not set\n');
    console.error('Please set DATABASE_URL before running this migration:');
    console.error('  export DATABASE_URL="postgresql://user:password@host:5432/database"\n');
    console.error('Or run with:');
    console.error('  DATABASE_URL="your-url" node migrations/run-job-locks-migration.js\n');
    process.exit(1);
  }

  console.log('🔒 Applying Job Locks Migration (0010)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Read migration file
  const migrationFile = path.join(__dirname, '0010_add_job_locks.sql');

  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ ERROR: Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFile, 'utf-8');

  console.log('📄 Migration file: 0010_add_job_locks.sql');
  console.log(`🔗 Database: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}\n`);

  try {
    // Try to use pg library if available
    let Pool;
    try {
      Pool = require('pg').Pool;
    } catch (e) {
      // Try @neondatabase/serverless
      try {
        Pool = require('@neondatabase/serverless').Pool;
        const neonConfig = require('@neondatabase/serverless').neonConfig;
        const ws = require('ws');
        neonConfig.webSocketConstructor = ws;
      } catch (e2) {
        console.error('❌ ERROR: Neither pg nor @neondatabase/serverless found');
        console.error('\nPlease install one of:');
        console.error('  npm install pg');
        console.error('  npm install @neondatabase/serverless ws\n');
        process.exit(1);
      }
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    console.log('🔧 Connecting to database...\n');

    // Execute migration
    await pool.query(sql);

    console.log('✅ Migration applied successfully!\n');

    // Verify table was created
    console.log('🔍 Verifying job_locks table...\n');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'job_locks'
      ORDER BY ordinal_position;
    `);

    if (result.rows.length === 0) {
      console.error('⚠️  Warning: job_locks table not found after migration');
    } else {
      console.log('Table structure:');
      console.table(result.rows);

      // Check for locks
      const lockCount = await pool.query('SELECT COUNT(*) as count FROM job_locks');
      console.log(`\n📊 Current locks in table: ${lockCount.rows[0].count}`);
    }

    await pool.end();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Job locks migration complete!\n');
    console.log('Next steps:');
    console.log('  1. Restart your application servers');
    console.log('  2. Monitor job execution: GET /api/health/job-locks');
    console.log('  3. Check logs for distributed lock messages\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runMigration().catch(error => {
  console.error(error);
  process.exit(1);
});
