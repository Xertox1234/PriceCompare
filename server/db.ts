import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use standard pg driver for local PostgreSQL or Neon serverless for cloud
const isNeonDatabase = process.env.DATABASE_URL?.includes('neon.tech') || process.env.DATABASE_URL?.includes('.pooler.neon.tech');

let pool: any;
let db: any;

if (isNeonDatabase) {
  // Use Neon serverless driver for cloud deployment
  const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
  const ws = await import('ws');
  neonConfig.webSocketConstructor = ws.default;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  const { drizzle: neonDrizzle } = await import('drizzle-orm/neon-serverless');
  db = neonDrizzle({ client: pool, schema });
} else {
  // Use standard pg driver for local PostgreSQL
  const { Pool: PgPool } = await import('pg');
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  const { drizzle: pgDrizzle } = await import('drizzle-orm/node-postgres');
  db = pgDrizzle({ client: pool, schema });
}

export { pool, db };