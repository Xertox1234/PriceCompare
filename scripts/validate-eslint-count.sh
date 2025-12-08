#!/bin/bash
#
# ESLint Warning Count Validation Script
#
# Purpose: Validates that the current ESLint warning count matches documented intentional patterns
# Usage: ./scripts/validate-eslint-count.sh
# Exit Codes:
#   0 - Warning count is within expected range
#   1 - Warning count exceeds threshold or validation failed
#
# Related Documentation:
#   - docs/01_TYPESCRIPT_PATTERNS.md#eslint-warning-quick-reference
#   - docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md

set -e  # Exit on error

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Expected warning counts (from documentation)
EXPECTED_STORAGE=192
EXPECTED_REDIS=4
EXPECTED_CACHE=4
EXPECTED_TOTAL=200
THRESHOLD_MAX=250
BUFFER=50

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 ESLint Warning Count Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get current total warning count
echo "📊 Checking current warning count..."
CURRENT_OUTPUT=$(npm run lint 2>&1 | grep "problems" || echo "0 problems")
# Handle ESLint output format: "✖ 200 problems (0 errors, 200 warnings)"
CURRENT=$(echo "$CURRENT_OUTPUT" | grep -oE "[0-9]+ problems" | grep -oE "[0-9]+" || echo "0")

# Validate we got a number
if ! [[ "$CURRENT" =~ ^[0-9]+$ ]]; then
  echo -e "${RED}❌ Failed to get warning count${NC}"
  echo "Output: $CURRENT_OUTPUT"
  exit 1
fi

echo -e "${BLUE}Total warnings:${NC} $CURRENT"
echo ""

# Get counts for specific files
echo "🔍 Checking intentional warning locations..."
STORAGE_OUTPUT=$(npx eslint server/storage.ts 2>&1 | grep "problems" || echo "0 problems")
STORAGE=$(echo "$STORAGE_OUTPUT" | grep -oE "[0-9]+ problems" | grep -oE "[0-9]+" || echo "0")

REDIS_OUTPUT=$(npx eslint server/config/redis.ts 2>&1 | grep "problems" || echo "0 problems")
REDIS=$(echo "$REDIS_OUTPUT" | grep -oE "[0-9]+ problems" | grep -oE "[0-9]+" || echo "0")

CACHE_OUTPUT=$(npx eslint server/middleware/redis-cache.ts 2>&1 | grep "problems" || echo "0 problems")
CACHE=$(echo "$CACHE_OUTPUT" | grep -oE "[0-9]+ problems" | grep -oE "[0-9]+" || echo "0")

# Calculate intentional warnings
INTENTIONAL_TOTAL=$((STORAGE + REDIS + CACHE))

echo -e "   • ${BLUE}server/storage.ts:${NC} $STORAGE (expected: $EXPECTED_STORAGE)"
echo -e "   • ${BLUE}server/config/redis.ts:${NC} $REDIS (expected: $EXPECTED_REDIS)"
echo -e "   • ${BLUE}server/middleware/redis-cache.ts:${NC} $CACHE (expected: $EXPECTED_CACHE)"
echo -e "   • ${BLUE}Intentional total:${NC} $INTENTIONAL_TOTAL (expected: $EXPECTED_TOTAL)"
echo ""

# Validation checks
PASSED=true

# Check 1: Total count within threshold
if [ "$CURRENT" -gt "$THRESHOLD_MAX" ]; then
  echo -e "${RED}❌ FAILED: Total warnings ($CURRENT) exceeds threshold ($THRESHOLD_MAX)${NC}"
  echo "   New warnings detected. Please review and fix."
  PASSED=false
else
  echo -e "${GREEN}✓ Total warnings within threshold${NC} ($CURRENT ≤ $THRESHOLD_MAX)"
fi

# Check 2: Storage.ts warnings match expected
if [ "$STORAGE" -ne "$EXPECTED_STORAGE" ]; then
  echo -e "${YELLOW}⚠️  WARNING: storage.ts warnings ($STORAGE) differ from expected ($EXPECTED_STORAGE)${NC}"
  echo "   This may indicate new interface methods or removed methods."
  PASSED=false
else
  echo -e "${GREEN}✓ storage.ts warnings match expected${NC} ($STORAGE)"
fi

# Check 3: Redis warnings match expected
if [ "$REDIS" -ne "$EXPECTED_REDIS" ]; then
  echo -e "${YELLOW}⚠️  WARNING: redis.ts warnings ($REDIS) differ from expected ($EXPECTED_REDIS)${NC}"
  echo "   This may indicate changes to the InMemoryRedis implementation."
  PASSED=false
else
  echo -e "${GREEN}✓ redis.ts warnings match expected${NC} ($REDIS)"
fi

# Check 4: Cache warnings match expected
if [ "$CACHE" -ne "$EXPECTED_CACHE" ]; then
  echo -e "${YELLOW}⚠️  WARNING: redis-cache.ts warnings ($CACHE) differ from expected ($EXPECTED_CACHE)${NC}"
  echo "   This may indicate changes to the InMemoryCache implementation."
  PASSED=false
else
  echo -e "${GREEN}✓ redis-cache.ts warnings match expected${NC} ($CACHE)"
fi

# Check 5: Buffer usage analysis
BUFFER_USED=$((CURRENT - EXPECTED_TOTAL))
BUFFER_REMAINING=$((THRESHOLD_MAX - CURRENT))

echo ""
echo "📈 Buffer Analysis:"
echo -e "   • ${BLUE}Buffer used:${NC} $BUFFER_USED of $BUFFER"
echo -e "   • ${BLUE}Buffer remaining:${NC} $BUFFER_REMAINING"

if [ "$BUFFER_USED" -lt 0 ]; then
  echo -e "   ${GREEN}✓ Warnings BELOW expected (fixable warnings eliminated!)${NC}"
elif [ "$BUFFER_USED" -eq 0 ]; then
  echo -e "   ${GREEN}✓ Perfect match with expected intentional warnings${NC}"
elif [ "$BUFFER_USED" -le 10 ]; then
  echo -e "   ${GREEN}✓ Small buffer usage (likely acceptable)${NC}"
elif [ "$BUFFER_USED" -le 25 ]; then
  echo -e "   ${YELLOW}⚠️  Moderate buffer usage - review new warnings${NC}"
else
  echo -e "   ${YELLOW}⚠️  High buffer usage - consider fixing non-intentional warnings${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$PASSED" = true ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  echo ""
  echo "📖 Documentation:"
  echo "   • Quick Reference: docs/01_TYPESCRIPT_PATTERNS.md#eslint-warning-quick-reference"
  echo "   • Complete Guide: docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some checks failed - review warnings above${NC}"
  echo ""
  echo "📖 Next Steps:"
  echo "   1. Run 'npm run lint' to see specific warnings"
  echo "   2. Check if warnings are from interface compliance files (intentional)"
  echo "   3. If warnings are fixable, apply the 8 documented patterns"
  echo "   4. If adding new interface methods, update expected counts in this script"
  echo ""
  echo "📖 Documentation:"
  echo "   • Quick Reference: docs/01_TYPESCRIPT_PATTERNS.md#eslint-warning-quick-reference"
  echo "   • Complete Guide: docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md"
  exit 1
fi
