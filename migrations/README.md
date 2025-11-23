# Database Migrations

This directory contains SQL migration files for the PriceCompare database.

## Migration Files

Migrations are numbered sequentially and executed in order:

- `0001_add_pgvector_embeddings.sql` - Vector embeddings support
- `0002_add_performance_indexes.sql` - Performance optimization indexes
- `0003_add_password_reset_tokens.sql` - Password reset functionality
- `0004_add_price_history.sql` - Price tracking tables
- `0005_add_notifications_enhancements.sql` - Notification system
- `0006_enhance_price_alerts.sql` - Price alert improvements
- `0007_add_community_features.sql` - Forum and community features
- `0008_add_watch_lists.sql` - Product watch lists
- `0009_add_price_aggregation.sql` - **Price analytics tables** (weekly/monthly aggregates, trends)
- `0010_add_job_locks.sql` - **Distributed job locking** (Nov 16, 2025)
- `0011_add_cascade_rules.sql` - **Foreign key cascade rules** (referential integrity)
- `0012_encrypt_pii_data_at_rest.sql` - **PII encryption at rest** (security enhancement)
- `0013_add_daily_price_aggregates.sql` - **Daily price aggregates** (aggregatedAt tracking, daily aggregation table)
- `0014_add_aggregation_indexes.sql` - **Aggregation performance indexes** (optimizes time-range queries, 10-100x faster)
- `0015_fix_set_null_constraints.sql` - **Fix SET NULL constraints** (allows user deletion with forum content)
- `0016_fix_data_integrity_issues.sql` - **Fix data integrity issues** (unique constraints, nullable sender_id)

## How to Apply Migrations

### Option 1: Using npm script (Recommended)

```bash
# Ensure DATABASE_URL environment variable is set
export DATABASE_URL="postgresql://user:password@host:5432/database"

# Run all migrations
npm run migrate
```

The migration script (`scripts/run-migrations.ts`) will:
- ✅ Automatically run all `.sql` files in order
- ✅ Skip already-applied migrations (using `CREATE TABLE IF NOT EXISTS`)
- ✅ Provide clear success/error messages
- ✅ Connect via Neon serverless PostgreSQL

### Option 2: Using psql directly

```bash
# For local PostgreSQL
psql -d pricecompare -f migrations/0010_add_job_locks.sql

# For remote database with connection string
psql "postgresql://user:password@host:5432/database" -f migrations/0010_add_job_locks.sql
```

### Option 3: Using Neon Console (for Neon databases)

1. Go to your Neon project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `migrations/0010_add_job_locks.sql`
4. Click **Run** to execute

## Latest Migration: 0010_add_job_locks.sql

**Purpose**: Adds distributed locking mechanism for scheduled jobs

**What it creates**:
- `job_locks` table with unique job names
- Indexes on `job_name` and `expires_at`
- Comments for documentation

**Why it's needed**:
- Prevents duplicate job execution in multi-server deployments
- Ensures only one server runs a scheduled job at a time
- Automatic lock expiration handles server crashes gracefully

**Used by**:
- Price analytics jobs (weekly/monthly aggregation, trend analysis)
- Price history jobs (daily snapshots, weekly cleanup)

## Verifying Migration Success

After applying the migration, verify with:

```sql
-- Check if job_locks table exists
\dt job_locks

-- Or using SQL
SELECT tablename FROM pg_tables WHERE tablename = 'job_locks';

-- Check table structure
\d job_locks

-- View indexes
\di job_locks*
```

Expected output:
```
Table "public.job_locks"
   Column   |            Type             | Nullable | Default
------------+-----------------------------+----------+---------
 id         | integer                     | not null | nextval(...)
 job_name   | character varying(100)      | not null |
 locked_by  | character varying(200)      | not null |
 locked_at  | timestamp without time zone | not null | now()
 expires_at | timestamp without time zone | not null |
 metadata   | text                        |          |

Indexes:
    "job_locks_pkey" PRIMARY KEY, btree (id)
    "job_locks_job_name_key" UNIQUE CONSTRAINT, btree (job_name)
    "idx_job_locks_expires" btree (expires_at)
    "idx_job_locks_name" btree (job_name)
```

## Rolling Back Migrations

**See [ROLLBACK_GUIDE.md](./ROLLBACK_GUIDE.md)** for comprehensive rollback procedures for all migrations.

### Quick Reference

Each migration has a specific rollback procedure with risk levels:

| Migration | Risk Level | Data Loss |
|-----------|------------|-----------|
| 0001 - pgvector | MEDIUM | Yes (embeddings) |
| 0002 - Performance indexes | LOW | No |
| 0003 - Password reset | HIGH | Yes (tokens) |
| 0004 - Price history | HIGH | Yes (all history) |
| 0005 - Notifications | MEDIUM | Yes (preferences) |
| 0006 - Price alerts | MEDIUM | Yes (tracking data) |
| 0007 - Community | HIGH | Yes (reputation, watches) |
| 0008 - Watch lists | HIGH | Yes (list organization) |
| 0009 - Price aggregation | HIGH | Yes (analytics) |
| 0010 - Job locks | LOW | Minimal |
| 0011 - Cascade rules | MEDIUM | No |
| 0012 - PII encryption | **CRITICAL** | Requires key |
| 0013 - Daily aggregates | MEDIUM | Yes |
| 0014 - Aggregation indexes | LOW | No |
| 0015 - SET NULL constraints | MEDIUM | No |
| 0016 - Data integrity | MEDIUM | No |

### Simple Rollback Example (Job Locks)

```sql
DROP TABLE IF EXISTS job_locks CASCADE;
```

**Warning**: Always backup before rolling back. See ROLLBACK_GUIDE.md for complete procedures.

## Troubleshooting

### "DATABASE_URL must be set"

Set the environment variable:
```bash
export DATABASE_URL="your-connection-string"
```

Or create a `.env` file:
```
DATABASE_URL=postgresql://user:password@host:5432/database
```

### "relation already exists"

This is normal - migrations use `IF NOT EXISTS` to be idempotent. The migration is already applied.

### "permission denied"

Ensure your database user has CREATE TABLE and CREATE INDEX permissions:
```sql
GRANT CREATE ON SCHEMA public TO your_user;
```

## Migration Development

When creating new migrations:

1. **Naming**: Use format `XXXX_description.sql` (e.g., `0011_add_feature.sql`)
2. **Idempotency**: Use `IF NOT EXISTS` to allow safe re-runs
3. **Comments**: Add COMMENT statements for documentation
4. **Indexes**: Create indexes for commonly queried columns
5. **Constraints**: Add appropriate constraints (UNIQUE, NOT NULL, CHECK)
6. **Testing**: Test migration on development database first

## Related Documentation

- **Rollback Guide**: `migrations/ROLLBACK_GUIDE.md` - **Complete rollback procedures for all migrations**
- **Audit Report**: `docs/AUDIT_2025-11-16.md` - Comprehensive audit of job locking system
- **Patterns Guide**: `docs/PATTERNS.md` - Best practices for database queries and job locking
- **Database Patterns**: `docs/DATABASE_PATTERNS.md` - N+1 prevention, transactions, query optimization
- **Job Lock Service**: `server/services/job-lock-service.ts` - Implementation details
