#!/bin/bash
#
# ESLint Validation Script
#
# Purpose: Validates that ESLint passes with zero warnings
# Usage: ./scripts/validate-eslint-count.sh
# Exit Codes:
#   0 - ESLint passes with 0 errors and 0 warnings
#   1 - ESLint has errors or warnings
#
# Background:
#   Interface compliance warnings (require-await) are suppressed at file level via
#   eslint-disable comments in:
#   - server/storage.ts (MemStorage class)
#   - server/config/redis.ts (InMemoryRedis class)
#   - server/middleware/redis-cache.ts (InMemoryCache class)
#
# Related Documentation:
#   - docs/01_TYPESCRIPT_PATTERNS.md#eslint-warning-quick-reference
#   - docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md

set -e  # Exit on error

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 ESLint Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run ESLint with zero-warning policy
echo "📊 Running ESLint..."
if npm run lint -- --max-warnings 0 2>&1; then
  echo ""
  echo -e "${GREEN}✅ ESLint passed with 0 errors and 0 warnings${NC}"
  echo ""
  echo "📋 Note: Interface compliance warnings are suppressed at file level."
  echo "   See .eslintrc.json overrides for: storage.ts, redis.ts, redis-cache.ts"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo ""
  echo -e "${RED}❌ ESLint check failed${NC}"
  echo ""
  echo "📖 Next Steps:"
  echo "   1. Review errors/warnings above"
  echo "   2. Fix any new issues introduced"
  echo "   3. If require-await warnings appear in interface files,"
  echo "      ensure eslint-disable comments are preserved"
  echo ""
  echo "📖 Documentation:"
  echo "   • Quick Reference: docs/01_TYPESCRIPT_PATTERNS.md"
  echo "   • Complete Guide: docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
