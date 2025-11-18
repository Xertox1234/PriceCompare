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

// Use standard pg driver for local PostgreSQL or Neon serverless for cloud
const isNeonDatabase = process.env.DATABASE_URL?.includes('neon.tech') || process.env.DATABASE_URL?.includes('.pooler.neon.tech');

let pool: NeonPool | PgPool;
let db: NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;

if (isNeonDatabase) {
  // Use Neon serverless driver for cloud deployment
  const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
  const ws = await import('ws');
  neonConfig.webSocketConstructor = ws.default;
  const neonPool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  pool = neonPool;
  const { drizzle: neonDrizzle } = await import('drizzle-orm/neon-serverless');
  db = neonDrizzle({ client: neonPool, schema });
} else {
  // Use standard pg driver for local PostgreSQL
  const { Pool: PgPool } = await import('pg');
  const pgPool = new PgPool({ connectionString: process.env.DATABASE_URL });
  pool = pgPool;
  const { drizzle: pgDrizzle } = await import('drizzle-orm/node-postgres');
  db = pgDrizzle({ client: pgPool, schema });
}

export { pool, db };