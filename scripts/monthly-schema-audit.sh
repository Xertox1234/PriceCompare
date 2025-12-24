#!/bin/bash
#
# Monthly Schema Audit Script
# Run this monthly to catch schema drift and missing migrations
#
# Usage: npm run audit:monthly

set -e

echo "🔍 Running Monthly Schema Audit..."
echo "=================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ISSUES_FOUND=0

# 1. Schema vs Database validation
echo "1️⃣  Schema vs Database Validation"
echo "-----------------------------------"
if npm run validate:schema; then
  echo -e "${GREEN}✅ Schema matches database${NC}"
else
  echo -e "${RED}❌ Schema validation failed${NC}"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 2. Check for tables without migrations
echo "2️⃣  Migration Coverage Check"
echo "-----------------------------------"
TABLES=$(psql $DATABASE_URL -t -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name != 'schema_migrations'
  ORDER BY table_name
")

MIGRATION_COVERAGE_OK=true
for table in $TABLES; do
  FOUND=$(grep -r "CREATE TABLE.*$table" migrations/ 2>/dev/null || echo "")
  if [ -z "$FOUND" ]; then
    if [ "$MIGRATION_COVERAGE_OK" = true ]; then
      echo -e "${YELLOW}⚠️  Tables without CREATE TABLE migration:${NC}"
      MIGRATION_COVERAGE_OK=false
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
    echo "   - $table"
  fi
done

if [ "$MIGRATION_COVERAGE_OK" = true ]; then
  echo -e "${GREEN}✅ All tables have migrations${NC}"
fi
echo ""

# 3. Check for foreign keys without cascade rules
echo "3️⃣  Foreign Key Cascade Rules Check"
echo "-----------------------------------"
FK_RESULT=$(psql $DATABASE_URL -t -c "
  SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (rc.delete_rule IS NULL OR rc.delete_rule = 'NO ACTION')
    AND tc.table_schema = 'public'
" 2>/dev/null || echo "")

if [ -z "$FK_RESULT" ]; then
  echo -e "${GREEN}✅ All foreign keys have cascade rules${NC}"
else
  echo -e "${RED}❌ Foreign keys without cascade rules:${NC}"
  echo "$FK_RESULT"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 4. Check for tables without primary keys
echo "4️⃣  Primary Key Check"
echo "-----------------------------------"
PK_RESULT=$(psql $DATABASE_URL -t -c "
  SELECT table_name
  FROM information_schema.tables t
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      WHERE tc.table_name = t.table_name
        AND tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
    )
    AND table_name != 'schema_migrations'
" 2>/dev/null || echo "")

if [ -z "$PK_RESULT" ]; then
  echo -e "${GREEN}✅ All tables have primary keys${NC}"
else
  echo -e "${YELLOW}⚠️  Tables without primary keys:${NC}"
  echo "$PK_RESULT"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 5. Check migration file naming
echo "5️⃣  Migration File Naming Check"
echo "-----------------------------------"
NAMING_OK=true
for migration in migrations/*.sql; do
  basename=$(basename "$migration")
  if ! [[ "$basename" =~ ^[0-9]{4}_[a-z_]+\.sql$ ]]; then
    if [ "$NAMING_OK" = true ]; then
      echo -e "${YELLOW}⚠️  Migration files with incorrect naming:${NC}"
      NAMING_OK=false
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
    echo "   - $basename"
  fi
done

if [ "$NAMING_OK" = true ]; then
  echo -e "${GREEN}✅ All migration files follow naming convention${NC}"
fi
echo ""

# 6. Check for duplicate migrations
echo "6️⃣  Duplicate Migration Check"
echo "-----------------------------------"
DUPLICATES=$(ls migrations/*.sql | sed 's/^migrations\/\([0-9]*\)_.*/\1/' | sort | uniq -d)
if [ -z "$DUPLICATES" ]; then
  echo -e "${GREEN}✅ No duplicate migration numbers${NC}"
else
  echo -e "${RED}❌ Duplicate migration numbers found:${NC}"
  echo "$DUPLICATES"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 7. Report summary
echo "=================================="
echo "📊 Audit Summary"
echo "=================================="
echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! No issues found.${NC}"
  echo ""
  exit 0
else
  echo -e "${YELLOW}⚠️  Found $ISSUES_FOUND issue(s) that need attention${NC}"
  echo ""
  echo "📖 For guidance, see:"
  echo "   - docs/LEARNINGS_SCHEMA_MIGRATION_MISMATCH_PREVENTION.md"
  echo "   - docs/02_DATABASE_PATTERNS.md (Section 5.1)"
  echo ""
  exit 1
fi
