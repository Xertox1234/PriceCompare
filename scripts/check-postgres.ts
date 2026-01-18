#!/usr/bin/env npx tsx
/**
 * PostgreSQL Availability Check Script
 *
 * Checks if PostgreSQL is running and the test database exists before running tests.
 * This script can be run manually or as a pretest hook.
 *
 * Usage:
 *   npx tsx scripts/check-postgres.ts
 *   npm run check:db
 *
 * Exit codes:
 *   0 - PostgreSQL is available and test database exists/was created
 *   1 - PostgreSQL is not available or cannot connect
 */

import { Client } from 'pg';

interface CheckResult {
  available: boolean;
  version?: string;
  database?: string;
  host?: string;
  port?: string;
  user?: string;
  error?: string;
}

async function checkPostgres(): Promise<CheckResult> {
  // Build connection string from environment or defaults
  const databaseUser = process.env.DATABASE_USER || process.env.USER || 'postgres';
  const databasePassword = process.env.DATABASE_PASSWORD || '';
  const databaseHost = process.env.DATABASE_HOST || 'localhost';
  const databasePort = process.env.DATABASE_PORT || '5432';
  const databaseName = process.env.DATABASE_NAME || 'pricecompare_test';

  // First, try to connect to postgres database to check server availability
  const credentials = databasePassword ? `${databaseUser}:${databasePassword}` : databaseUser;
  const adminUrl = `postgresql://${credentials}@${databaseHost}:${databasePort}/postgres`;
  const testDbUrl = `postgresql://${credentials}@${databaseHost}:${databasePort}/${databaseName}`;

  const adminClient = new Client({ connectionString: adminUrl });

  try {
    await adminClient.connect();

    // Get PostgreSQL version
    const versionResult = await adminClient.query('SELECT version()');
    const version = versionResult.rows[0].version.split(' ').slice(0, 2).join(' ');

    // Check if test database exists
    const dbCheckResult = await adminClient.query(
      `SELECT datname FROM pg_database WHERE datname = $1`,
      [databaseName]
    );

    let dbStatus = 'exists';

    if (dbCheckResult.rows.length === 0) {
      // Create the test database
      // SECURITY: Validate database name to prevent SQL injection
      // Only allow alphanumeric characters and underscores (standard PostgreSQL identifier)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
        throw new Error(
          `Invalid database name: "${databaseName}". ` +
            'Database names must start with a letter or underscore and contain only alphanumeric characters and underscores.'
        );
      }
      console.log(`Creating database '${databaseName}'...`);
      // Use double quotes for identifier quoting (PostgreSQL standard)
      await adminClient.query(`CREATE DATABASE "${databaseName}"`); // IDENTIFIER VALIDATED
      dbStatus = 'created';
    }

    await adminClient.end();

    // Verify we can connect to the test database
    const testClient = new Client({ connectionString: testDbUrl });
    await testClient.connect();
    await testClient.end();

    return {
      available: true,
      version,
      database: `${databaseName} (${dbStatus})`,
      host: databaseHost,
      port: databasePort,
      user: databaseUser,
    };
  } catch (error) {
    try {
      await adminClient.end();
    } catch {
      // Ignore cleanup errors
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide helpful error messages
    let hint = '';
    if (errorMessage.includes('ECONNREFUSED')) {
      hint = '\n  Hint: PostgreSQL may not be running. Try: brew services start postgresql@18';
    } else if (errorMessage.includes('does not exist')) {
      hint = '\n  Hint: User or database may not exist. Check your PostgreSQL setup.';
    } else if (errorMessage.includes('authentication failed')) {
      hint = '\n  Hint: Check DATABASE_USER and DATABASE_PASSWORD environment variables.';
    }

    return {
      available: false,
      error: errorMessage + hint,
    };
  }
}

async function main() {
  console.log('\nChecking PostgreSQL availability...\n');

  const result = await checkPostgres();

  if (result.available) {
    console.log('PostgreSQL Status');
    console.log('=================');
    console.log(`  Version:  ${result.version}`);
    console.log(`  Host:     ${result.host}:${result.port}`);
    console.log(`  User:     ${result.user}`);
    console.log(`  Database: ${result.database}`);
    console.log('\n  Status: Ready for tests\n');
    process.exit(0);
  } else {
    console.error('PostgreSQL Check Failed');
    console.error('=======================');
    console.error(`  Error: ${result.error}`);
    console.error('\n  Tests that require a database will be skipped.\n');
    process.exit(1);
  }
}

main();
