#!/bin/bash
#
# Apply migration 0010: Add Job Locks Table
#
# Usage:
#   ./migrations/apply-0010-job-locks.sh
#
# Or with custom DATABASE_URL:
#   DATABASE_URL="your-url" ./migrations/apply-0010-job-locks.sh
#

set -e

MIGRATION_FILE="$(dirname "$0")/0010_add_job_locks.sql"

echo "🔒 Applying Job Locks Migration (0010)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo
  echo "Please set DATABASE_URL before running this script:"
  echo "  export DATABASE_URL='postgresql://user:password@host:5432/database'"
  echo
  echo "Or run with:"
  echo "  DATABASE_URL='your-url' ./migrations/apply-0010-job-locks.sh"
  echo
  exit 1
fi

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📄 Migration file: 0010_add_job_locks.sql"
echo "🔗 Database: ${DATABASE_URL%%@*}@***"
echo

# Check if psql is available
if command -v psql &> /dev/null; then
  echo "🔧 Using psql to apply migration..."
  echo

  psql "$DATABASE_URL" -f "$MIGRATION_FILE"

  echo
  echo "✅ Migration applied successfully!"
  echo
  echo "Verifying job_locks table..."
  psql "$DATABASE_URL" -c "\d job_locks"

elif command -v node &> /dev/null || command -v npm &> /dev/null; then
  echo "🔧 Using npm migrate script..."
  echo

  cd "$(dirname "$0")/.."
  npm run migrate

else
  echo "❌ ERROR: Neither psql nor node/npm found"
  echo
  echo "Please install PostgreSQL client or Node.js to run migrations"
  exit 1
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Job locks migration complete!"
echo
echo "Next steps:"
echo "  1. Restart your application servers"
echo "  2. Monitor job execution: GET /api/health/job-locks"
echo "  3. Check logs for distributed lock messages"
echo
