# Migration Management

## Directory Structure

- `migrations/` - Active migration files (run automatically)
- `migrations/rollbacks/` - Rollback scripts (manual use only)

## Critical Rule

**NEVER place rollback files in the migrations/ directory.**

Rollback files (e.g., `0026_rollback.sql`, `0027_rollback.sql`) will execute alphabetically AFTER their create migrations, causing tables to be dropped immediately after creation.

## Running Migrations

```bash
# Development database
npm run migrate

# Test database
NODE_ENV=test npm run migrate
```

## Rollback Process (Manual)

If you need to rollback a migration:

1. Find the rollback script in `migrations/rollbacks/`
2. Manually run against the database
3. Remove the migration from `schema_migrations` table

**DO NOT** place rollback files in `migrations/` directory.

## Recent Fix (2026-01-05)

Migration 0026 and 0027 were rolled back unintentionally because rollback files were placed in migrations/ directory. Fixed by:

1. Moving `0026_rollback.sql` and `0027_rollback.sql` to `migrations/rollbacks/`
2. Re-running create migrations manually
3. Verifying E2E tests can access new tables

See `docs/learnings/database/LEARNINGS_TODO_009_MIGRATION_ROLLBACK_INCIDENT.md` for full details.
