#!/usr/bin/env tsx
/**
 * Audit columns for a specific table
 * Compare schema.ts definition against actual database
 *
 * Usage: npm run audit:columns <table_name>
 * Example: npm run audit:columns wishlists
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const tableName = process.argv[2];

if (!tableName) {
  console.error('❌ Error: Missing table name argument\n');
  console.error('Usage: npm run audit:columns <table_name>');
  console.error('\nExamples:');
  console.error('  npm run audit:columns wishlists');
  console.error('  npm run audit:columns product_specifications');
  console.error('  npm run audit:columns users');
  process.exit(1);
}

async function auditColumns(table: string) {
  console.log(`\n🔍 Auditing table: "${table}"\n`);

  try {
    // 1. Get column information
    const columnsResult = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = ${table}
        AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    if (columnsResult.rows.length === 0) {
      console.error(`❌ Table "${table}" not found in database`);
      console.error('\nAvailable tables:');

      const tablesResult = await db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      (tablesResult.rows as Array<{ table_name: string }>).forEach((r) => {
        console.error(`  - ${r.table_name}`);
      });

      await cleanup();
      process.exit(1);
    }

    console.log(`📋 Columns in table "${table}" (${columnsResult.rows.length} total):\n`);

    // Format output as table
    const columns = columnsResult.rows.map((row: Record<string, unknown>) => ({
      Column: row.column_name,
      Type: row.character_maximum_length
        ? `${row.data_type}(${row.character_maximum_length})`
        : row.data_type,
      Nullable: row.is_nullable === 'YES' ? 'YES' : 'NO',
      Default: row.column_default || '(none)',
    }));

    console.table(columns);

    // 2. Get index information
    const indexesResult = await db.execute(sql`
      SELECT
        i.relname as index_name,
        a.attname as column_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = ${table}
        AND t.relkind = 'r'
      ORDER BY i.relname, a.attnum
    `);

    if (indexesResult.rows.length > 0) {
      console.log(`\n📊 Indexes on table "${table}":\n`);

      const indexes = indexesResult.rows.map((row: Record<string, unknown>) => ({
        Index: row.index_name,
        Column: row.column_name,
        Type: row.is_primary ? 'PRIMARY KEY' : row.is_unique ? 'UNIQUE' : 'INDEX',
      }));

      console.table(indexes);
    }

    // 3. Get foreign key information
    const fkResult = await db.execute(sql`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = ${table}
        AND tc.table_schema = 'public'
    `);

    if (fkResult.rows.length > 0) {
      console.log(`\n🔗 Foreign Keys on table "${table}":\n`);

      const foreignKeys = fkResult.rows.map((row: Record<string, unknown>) => ({
        Column: row.column_name,
        References: `${row.foreign_table_name}(${row.foreign_column_name})`,
        'On Delete': row.delete_rule,
      }));

      console.table(foreignKeys);

      // Check for missing CASCADE rules
      const missingCascade = fkResult.rows.filter(
        (row: Record<string, unknown>) =>
          row.delete_rule === 'NO ACTION' || row.delete_rule === null
      );

      if (missingCascade.length > 0) {
        console.warn('\n⚠️  WARNING: Foreign keys without CASCADE rules:');
        missingCascade.forEach((row: Record<string, unknown>) => {
          console.warn(`   - ${row.column_name} → ${row.foreign_table_name}`);
        });
        console.warn('\nSee: docs/02_DATABASE_PATTERNS.md (Section 5.1)');
      }
    }

    // 4. Get CHECK constraints
    const checkResult = await db.execute(sql`
      SELECT
        con.conname as constraint_name,
        pg_get_constraintdef(con.oid) as constraint_definition
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = ${table}
        AND con.contype = 'c'
      ORDER BY con.conname
    `);

    if (checkResult.rows.length > 0) {
      console.log(`\n✅ CHECK Constraints on table "${table}":\n`);

      checkResult.rows.forEach((row: Record<string, unknown>) => {
        console.log(`  - ${row.constraint_name}`);
        console.log(`    ${row.constraint_definition}\n`);
      });
    }

    console.log('✅ Audit complete!\n');

    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('❌ Audit failed:', error);
    await cleanup();
    process.exit(1);
  }
}

async function cleanup() {
  try {
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

auditColumns(tableName).catch(async (error) => {
  console.error('❌ Unexpected error:', error);
  await cleanup();
  process.exit(1);
});
