#!/usr/bin/env tsx
/**
 * Validate that all foreign keys have explicit cascade rules
 *
 * Checks:
 * 1. All foreign keys have explicit CASCADE, SET NULL, or RESTRICT
 * 2. No foreign keys with default NO ACTION or NULL delete_rule
 *
 * This prevents orphaned records and ensures data integrity.
 *
 * Usage: npm run validate:fk-cascades
 *
 * See: docs/02_DATABASE_PATTERNS.md - Section 5.1 Foreign Key Cascade Rules
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

interface ForeignKeyRow {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  delete_rule: string | null;
  constraint_name: string;
}

async function validateForeignKeyCascades() {
  console.log('🔍 Validating foreign key cascade rules...\n');

  try {
    // Query all foreign keys and their cascade rules
    const results = await db.execute<ForeignKeyRow>(sql`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        rc.delete_rule,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);

    const totalForeignKeys = results.rows.length;
    console.log(`📋 Found ${totalForeignKeys} foreign key constraints\n`);

    // Filter foreign keys without explicit cascade rules
    // NO ACTION and NULL are both considered invalid
    const invalidForeignKeys = results.rows.filter(
      (row) => !row.delete_rule || row.delete_rule === 'NO ACTION'
    );

    if (invalidForeignKeys.length > 0) {
      console.error('❌ Foreign keys without explicit cascade rules:\n');

      // Group by table for better readability
      const byTable = invalidForeignKeys.reduce(
        (acc, row) => {
          if (!acc[row.table_name]) {
            acc[row.table_name] = [];
          }
          acc[row.table_name].push(row);
          return acc;
        },
        {} as Record<string, ForeignKeyRow[]>
      );

      Object.entries(byTable).forEach(([table, fks]) => {
        console.error(`  Table: ${table}`);
        fks.forEach((fk) => {
          const rule = fk.delete_rule || 'NULL';
          console.error(
            `    - ${fk.column_name} → ${fk.foreign_table_name} (rule: ${rule})`
          );
        });
        console.error('');
      });

      console.error('🔧 All foreign keys MUST have explicit cascade rules:\n');
      console.error('  CASCADE    - Child records deleted with parent');
      console.error('               (use for ownership: offers → products)');
      console.error('  SET NULL   - Reference nullified, record preserved');
      console.error('               (use for history: posts → users)');
      console.error('  RESTRICT   - Prevent deletion if children exist');
      console.error('               (rarely used)\n');
      console.error(
        '📖 See docs/02_DATABASE_PATTERNS.md - Section 5.1 Foreign Key Cascade Rules\n'
      );
      console.error('💡 Fix by creating a migration with proper cascade rules:');
      console.error('   ALTER TABLE table_name DROP CONSTRAINT constraint_name;');
      console.error(
        '   ALTER TABLE table_name ADD CONSTRAINT constraint_name'
      );
      console.error(
        '     FOREIGN KEY (column_name) REFERENCES foreign_table (id)'
      );
      console.error('     ON DELETE CASCADE;  -- or SET NULL or RESTRICT\n');

      await cleanup();
      process.exit(1);
    }

    // Show summary of cascade rules in use
    const cascadeStats = results.rows.reduce(
      (acc, row) => {
        const rule = row.delete_rule || 'UNKNOWN';
        acc[rule] = (acc[rule] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('✅ All foreign keys have explicit cascade rules!\n');
    console.log('📊 Cascade Rule Distribution:');
    Object.entries(cascadeStats)
      .sort(([, a], [, b]) => b - a)
      .forEach(([rule, count]) => {
        const percentage = ((count / totalForeignKeys) * 100).toFixed(1);
        console.log(`   ${rule.padEnd(12)} ${count.toString().padStart(3)} (${percentage}%)`);
      });
    console.log('');

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

validateForeignKeyCascades().catch(async (error) => {
  console.error('❌ Unexpected error:', error);
  await cleanup();
  process.exit(1);
});
