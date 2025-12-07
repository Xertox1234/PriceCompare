/**
 * Server-side test setup for Vitest
 *
 * This file configures the test environment for server-side tests including:
 * - Environment variables (encryption keys, database, etc.)
 * - Database connection setup
 * - Global mocks and utilities
 */

import { beforeAll, afterAll } from 'vitest';

// Set up required environment variables for tests BEFORE any imports
// Encryption is now handled via NODE_ENV='test' check in schema.ts (no-op encryption)
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-min-32-chars-long';
process.env.CSRF_SECRET = process.env.CSRF_SECRET || 'test-csrf-secret-min-32-chars';

// Database configuration for tests
// Fallback priority:
// 1. DATABASE_URL from environment (full connection string)
// 2. Construct from individual DATABASE_* variables
// 3. Use system user (process.env.USER) with localhost defaults
const databaseUser = process.env.DATABASE_USER || process.env.USER || 'postgres';
const databasePassword = process.env.DATABASE_PASSWORD || '';
const databaseHost = process.env.DATABASE_HOST || 'localhost';

// Validate DATABASE_PORT is numeric and within valid range
let databasePort = process.env.DATABASE_PORT || '5432';
const portNum = parseInt(databasePort, 10);
if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
  console.warn(`⚠️  Invalid DATABASE_PORT '${databasePort}', using default 5432`);
  databasePort = '5432';
}

const databaseName = process.env.DATABASE_NAME || 'pricecompare_test';

// Construct connection string with or without password
const credentials = databasePassword ? `${databaseUser}:${databasePassword}` : databaseUser;
const defaultDatabaseUrl = `postgresql://${credentials}@${databaseHost}:${databasePort}/${databaseName}`;

process.env.DATABASE_URL = process.env.DATABASE_URL || defaultDatabaseUrl;
process.env.REDIS_URL = process.env.REDIS_URL || '';
process.env.NODE_ENV = 'test';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

// Set up required environment variables for tests
beforeAll(() => {
  // Environment is already configured above
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connections if needed
  // This will be handled by individual test cleanup
});
