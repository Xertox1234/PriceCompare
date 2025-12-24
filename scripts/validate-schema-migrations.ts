#!/usr/bin/env tsx
/**
 * Validate that shared/schema.ts matches migrations
 *
 * Checks:
 * 1. All tables in schema exist in migrations
 * 2. All tables in migrations exist in schema
 * 3. No ghost tables (in DB but not schema)
 * 4. No missing tables (in schema but not DB)
 *
 * Usage: npm run validate:schema
 */

import { config as loadEnv } from 'dotenv';

// Load env vars (use .env.test if NODE_ENV=test)
loadEnv({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

async function validateSchema() {
  console.log('🔍 Validating schema against database...\n');

  // Dynamic imports to ensure dotenv loads first
  const { db } = await import('../server/db.js');
  const schema = await import('../shared/schema.js');
  const { sql } = await import('drizzle-orm');

  try {
    // 1. Extract table names from schema
    const schemaTables = Object.keys(schema)
      .filter((key) => {
        if (key === 'default') return false; // Skip default export
        const obj = schema[key];
        // Check if it's a Drizzle table (has _config.name)
        return obj && typeof obj === 'object' && '_' in obj && obj._ && obj._.name;
      })
      .map((key) => {
        const obj = schema[key];
        return obj._.name as string;
      })
      .sort();

    console.log(`📋 Schema defines ${schemaTables.length} tables:`);
    schemaTables.forEach((t) => console.log(`   - ${t}`));

    // 2. Query actual database tables
    const dbTablesResult = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const dbTables = (
      dbTablesResult.rows as Array<{ table_name: string }>
    ).map((r) => r.table_name);

    console.log(`\n📋 Database has ${dbTables.length} tables:`);
    dbTables.forEach((t) => console.log(`   - ${t}`));

    // 3. Find ghost tables (in DB but not schema)
    const ghostTables = dbTables.filter(
      (t) => !schemaTables.includes(t) && t !== 'schema_migrations'
    );

    if (ghostTables.length > 0) {
      console.error('\n❌ GHOST TABLES FOUND (in DB but not schema.ts):');
      ghostTables.forEach((t) => console.error(`   - ${t}`));
      console.error('\n🔧 Action Required:');
      console.error('   1. Add missing tables to shared/schema.ts, OR');
      console.error('   2. Create rollback migration to remove them');
      console.error('\nSee: docs/LEARNINGS_SCHEMA_MIGRATION_MISMATCH_PREVENTION.md');
      await cleanup();
      process.exit(1);
    }

    // 4. Find missing tables (in schema but not DB)
    const missingTables = schemaTables.filter((t) => !dbTables.includes(t));

    if (missingTables.length > 0) {
      console.error('\n❌ MISSING TABLES FOUND (in schema.ts but not DB):');
      missingTables.forEach((t) => console.error(`   - ${t}`));
      console.error('\n🔧 Action Required:');
      console.error('   1. Create migration to add missing tables, OR');
      console.error('   2. Run migrations: npm run migrate');
      console.error('\nSee: docs/LEARNINGS_SCHEMA_MIGRATION_MISMATCH_PREVENTION.md');
      await cleanup();
      process.exit(1);
    }

    console.log('\n✅ All tables validated successfully!');
    console.log('   - No ghost tables found');
    console.log('   - No missing tables found');
    console.log(`   - ${schemaTables.length} tables match perfectly\n`);

    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('❌ Validation failed:', error);
    await cleanup();
    process.exit(1);
  }
}

async function cleanup() {
  try {
    // Close database connection
    await db.$client.end();
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

validateSchema().catch(async (error) => {
  console.error('❌ Unexpected error:', error);
  await cleanup();
  process.exit(1);
});
