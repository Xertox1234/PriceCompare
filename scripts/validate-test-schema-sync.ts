#!/usr/bin/env tsx

/**
 * Schema Synchronization Validator
 *
 * Validates that e2e/helpers.ts TRUNCATE statement includes all tables
 * defined in shared/schema.ts to prevent E2E test failures.
 *
 * Usage:
 *   npm run validate:schema-sync
 *   tsx scripts/validate-test-schema-sync.ts
 *
 * Exit codes:
 *   0 = Schema in sync
 *   1 = Schema out of sync (missing tables or extra tables)
 *   2 = File read error
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface ValidationResult {
  inSync: boolean;
  missingInTruncate: string[];
  extraInTruncate: string[];
  schemaTables: string[];
  truncateTables: string[];
}

/**
 * Extract table names from shared/schema.ts
 * Parses patterns like:
 *   export const tableName = pgTable('table_name', ...)
 *   export const tableName = pgTable(
 *     'table_name',
 *     ...
 */
function extractSchemaTableNames(schemaPath: string): string[] {
  try {
    const content = readFileSync(schemaPath, 'utf-8');
    // Match both single-line and multi-line pgTable patterns
    const tableRegex = /export const \w+ = pgTable\(\s*'([^']+)'/g;
    const tables: string[] = [];
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      tables.push(match[1]);
    }

    return tables.sort();
  } catch (error) {
    console.error(`${colors.red}Error reading schema file:${colors.reset}`, error);
    process.exit(2);
  }
}

/**
 * Extract table names from e2e/helpers.ts TRUNCATE statement
 * Parses the TRUNCATE TABLE ... list between TRUNCATE TABLE and RESTART IDENTITY
 */
function extractTruncateTableNames(helpersPath: string): string[] {
  try {
    const content = readFileSync(helpersPath, 'utf-8');

    // First, try to match the new PL/pgSQL array-based approach:
    // table_list TEXT[] := ARRAY['table1', 'table2', ...]
    const arrayMatch = content.match(/table_list\s+TEXT\[\]\s*:=\s*ARRAY\[([\s\S]+?)\];/);

    if (arrayMatch) {
      // Extract table names from ARRAY[...] format
      const tableList = arrayMatch[1];
      // Match quoted strings: 'table_name'
      const tableRegex = /'([^']+)'/g;
      const tables: string[] = [];
      let match;
      while ((match = tableRegex.exec(tableList)) !== null) {
        tables.push(match[1]);
      }
      return tables.sort();
    }

    // Fallback: Try old TRUNCATE TABLE block format
    const truncateMatch = content.match(
      /TRUNCATE TABLE\s+([\s\S]+?)\s+RESTART IDENTITY CASCADE/
    );

    if (!truncateMatch) {
      console.error(
        `${colors.red}Error: Could not find table_list ARRAY or TRUNCATE TABLE statement in ${helpersPath}${colors.reset}`
      );
      process.exit(2);
    }

    // Extract table names (comma-separated, possibly multi-line)
    const tableList = truncateMatch[1];
    const tables = tableList
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    return tables.sort();
  } catch (error) {
    console.error(`${colors.red}Error reading helpers file:${colors.reset}`, error);
    process.exit(2);
  }
}

/**
 * Tables that should be EXCLUDED from E2E cleanup (have valid reasons to skip)
 *
 * Add tables here with justification if they should NOT be truncated in E2E tests.
 *
 * Common reasons to exclude:
 *   - Reference data tables (loaded once, never modified in tests)
 *   - Audit/logging tables (append-only, no test pollution)
 *   - Tables that don't exist in test DB schema (missing migrations)
 *   - Infrastructure tables (job_locks, internal state)
 *   - Computed tables (can be rebuilt from source data)
 *
 * IMPORTANT: Only add tables here if you have a STRONG justification.
 * Most tables should be truncated to ensure test isolation.
 */
const EXCLUDED_TABLES = new Set<string>([
  // Add excluded tables here with comments explaining why
  // Example: 'audit_logs', // Append-only, no test pollution
  // Example: 'job_locks',  // Distributed locking infrastructure
]);

/**
 * Validate schema synchronization between shared/schema.ts and e2e/helpers.ts
 */
function validateSchemaSync(): ValidationResult {
  const projectRoot = join(__dirname, '..');
  const schemaPath = join(projectRoot, 'shared', 'schema.ts');
  const helpersPath = join(projectRoot, 'e2e', 'helpers.ts');

  console.log(`${colors.blue}Validating test schema synchronization...${colors.reset}\n`);
  console.log(`Schema file: ${schemaPath}`);
  console.log(`Helpers file: ${helpersPath}\n`);

  const schemaTables = extractSchemaTableNames(schemaPath);
  const truncateTables = extractTruncateTableNames(helpersPath);

  // Filter out excluded tables from schema tables
  const relevantSchemaTables = schemaTables.filter((t) => !EXCLUDED_TABLES.has(t));

  // Find discrepancies
  const missingInTruncate = relevantSchemaTables.filter(
    (table) => !truncateTables.includes(table)
  );
  const extraInTruncate = truncateTables.filter((table) => !schemaTables.includes(table));

  const inSync = missingInTruncate.length === 0 && extraInTruncate.length === 0;

  return {
    inSync,
    missingInTruncate,
    extraInTruncate,
    schemaTables: relevantSchemaTables,
    truncateTables,
  };
}

/**
 * Print validation results with colored output
 */
function printResults(result: ValidationResult): void {
  console.log(`${colors.cyan}Schema Tables (${result.schemaTables.length}):${colors.reset}`);
  console.log(result.schemaTables.join(', ') || '(none)');
  console.log();

  console.log(`${colors.cyan}TRUNCATE Tables (${result.truncateTables.length}):${colors.reset}`);
  console.log(result.truncateTables.join(', ') || '(none)');
  console.log();

  if (result.inSync) {
    console.log(`${colors.green}✓ Schema in sync!${colors.reset}`);
    console.log(
      `${colors.green}  All ${result.schemaTables.length} tables are included in E2E cleanup.${colors.reset}\n`
    );
  } else {
    console.log(`${colors.red}✗ Schema out of sync!${colors.reset}\n`);

    if (result.missingInTruncate.length > 0) {
      console.log(
        `${colors.yellow}Missing in TRUNCATE statement (${result.missingInTruncate.length} tables):${colors.reset}`
      );
      result.missingInTruncate.forEach((table) => {
        console.log(`  ${colors.red}✗${colors.reset} ${table}`);
      });
      console.log();
      console.log(`${colors.yellow}Action Required:${colors.reset}`);
      console.log(`Add these tables to the TRUNCATE statement in e2e/helpers.ts (lines 61-77)`);
      console.log(`Or add to EXCLUDED_TABLES in this script with justification.\n`);
    }

    if (result.extraInTruncate.length > 0) {
      console.log(
        `${colors.yellow}Extra in TRUNCATE statement (${result.extraInTruncate.length} tables):${colors.reset}`
      );
      result.extraInTruncate.forEach((table) => {
        console.log(`  ${colors.red}✗${colors.reset} ${table}`);
      });
      console.log();
      console.log(`${colors.yellow}Action Required:${colors.reset}`);
      console.log(`These tables don't exist in shared/schema.ts:`);
      console.log(`  - If they were removed, delete from TRUNCATE statement`);
      console.log(`  - If they're valid, add table definition to shared/schema.ts\n`);
    }

    // Provide fix instructions
    console.log(`${colors.cyan}Fix Instructions:${colors.reset}\n`);

    if (result.missingInTruncate.length > 0) {
      console.log(`1. Open e2e/helpers.ts (lines 61-77)`);
      console.log(`2. Add missing tables to TRUNCATE statement:`);
      console.log(`   ${colors.green}TRUNCATE TABLE${colors.reset}`);
      result.missingInTruncate.forEach((table) => {
        console.log(`     ${table},`);
      });
      console.log(`     ... (other tables)`);
      console.log(`   ${colors.green}RESTART IDENTITY CASCADE${colors.reset}\n`);
    }

    if (result.extraInTruncate.length > 0) {
      console.log(`3. Remove non-existent tables from TRUNCATE statement:`);
      result.extraInTruncate.forEach((table) => {
        console.log(`   ${colors.red}Remove:${colors.reset} ${table}`);
      });
      console.log();
    }

    console.log(`4. Run validation again: ${colors.cyan}npm run validate:schema-sync${colors.reset}\n`);
  }
}

/**
 * Main execution
 */
function main() {
  const result = validateSchemaSync();
  printResults(result);

  // Exit with error code if out of sync
  process.exit(result.inSync ? 0 : 1);
}

// Run validation
main();
