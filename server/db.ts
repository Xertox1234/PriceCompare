import * as schema from "@shared/schema";
import type { Pool as NeonPool } from '@neondatabase/serverless';
import type { Pool as PgPool } from 'pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Connection pool configuration
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),           // Max connections
  min: parseInt(process.env.DB_POOL_MIN || '5', 10),            // Min connections kept open
  idleTimeoutMillis: 30000,                                      // Close idle connections after 30s
  connectionTimeoutMillis: 10000,                                // Timeout waiting for connection
  allowExitOnIdle: false,                                        // Keep pool alive
};

// Use standard pg driver for local PostgreSQL or Neon serverless for cloud
const isNeonDatabase = process.env.DATABASE_URL?.includes('neon.tech') || process.env.DATABASE_URL?.includes('.pooler.neon.tech');

let pool: NeonPool | PgPool;
let db: NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;

// Initialize database connection asynchronously
(async () => {
  if (isNeonDatabase) {
    // Use Neon serverless driver for cloud deployment
    const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');
    neonConfig.webSocketConstructor = ws.default;
    const neonPool = new NeonPool(poolConfig);
    pool = neonPool;
    const { drizzle: neonDrizzle } = await import('drizzle-orm/neon-serverless');
    db = neonDrizzle({ client: neonPool, schema });
  } else {
    // Use standard pg driver for local PostgreSQL
    const { Pool: PgPool } = await import('pg');
    const pgPool = new PgPool(poolConfig);
    pool = pgPool;
    const { drizzle: pgDrizzle } = await import('drizzle-orm/node-postgres');
    db = pgDrizzle({ client: pgPool, schema });
  }
})();

export { pool, db };
