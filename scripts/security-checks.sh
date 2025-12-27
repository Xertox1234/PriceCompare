#!/bin/bash
# Security checks script - Enhanced Version 2.0
# Run this before committing code
#
# Phase 1 (P0) Checks - BLOCKERS:
#   - CSRF protection on mutations
#   - N+1 query detection
#   - Foreign key cascade rules
#   - Console.log in server code
#   - Global CSRF middleware anti-pattern
#
# See: docs/planning/PRE_COMMIT_ENHANCEMENT_PLAN.md

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counter for blocking issues
SECURITY_ISSUES=0
WARNINGS=0

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           🔒 SECURITY & PATTERN CHECKS v2.0                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# SECTION 1: DEPENDENCY AUDIT
# =============================================================================
echo -e "${BLUE}📦 [1/7] Checking for vulnerable dependencies...${NC}"
npm audit --audit-level=moderate 2>/dev/null || {
  echo -e "${YELLOW}⚠️  Warning: Vulnerabilities found in dependencies${NC}"
  echo "   Run 'npm audit fix' to resolve"
  WARNINGS=$((WARNINGS + 1))
}
echo ""

# =============================================================================
# SECTION 2: TYPESCRIPT TYPE CHECKING
# =============================================================================
echo -e "${BLUE}📝 [2/7] Running TypeScript type checking...${NC}"
npm run check || {
  echo -e "${RED}❌ TypeScript errors found${NC}"
  exit 1
}
echo -e "${GREEN}✅ Type checking passed${NC}"
echo ""

# =============================================================================
# SECTION 3: P0 BLOCKERS - Critical Security Checks
# =============================================================================
echo -e "${BLUE}🛡️  [3/7] Running P0 Security Blockers...${NC}"
echo ""

# -----------------------------------------------------------------------------
# BLOCKER 1: CSRF Protection on Mutations
# Pattern: docs/04_SECURITY_PATTERNS.md#csrf-protection
# -----------------------------------------------------------------------------
echo "   🔐 Checking CSRF protection on mutations..."

# Find POST/PUT/PATCH/DELETE routes without csrfProtection.
# NOTE: Route middleware is often multi-line, so we inspect a small window of lines
# after the route definition to look for csrfProtection.
CSRF_MISSING_LINES=()
while IFS=: read -r file line rest; do
  # Skip tests
  if [[ "$file" == *"__tests__"* ]] || [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]]; then
    continue
  fi

  snippet=$(sed -n "${line},$((line+8))p" "$file" 2>/dev/null || true)

  # Skip known exemptions
  if echo "$snippet" | grep -q "// CSRF exempt"; then
    continue
  fi

  # Skip known public endpoints
  if echo "$snippet" | grep -qiE "health|webhook|track-click|csrf-token"; then
    continue
  fi

  if echo "$snippet" | grep -q "csrfProtection"; then
    continue
  fi

  CSRF_MISSING_LINES+=("$file:$line:  $rest")
done < <(grep -rnE "(app|router)\.(post|put|patch|delete)\(" server/ --include="*.ts" 2>/dev/null || true)

CSRF_MISSING=$(printf "%s\n" "${CSRF_MISSING_LINES[@]}")

if [ -n "$CSRF_MISSING" ]; then
  echo -e "${RED}   ❌ BLOCKER: Mutations found without csrfProtection middleware:${NC}"
  echo "$CSRF_MISSING" | head -10 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Add csrfProtection middleware before route handler${NC}"
  echo "   EXAMPLE: app.post('/api/resource', csrfProtection, withAuth(handler))"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#csrf-protection"
  echo "   BYPASS: Add '// CSRF exempt: <reason>' comment if intentionally public"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ All mutations have CSRF protection${NC}"
fi

# -----------------------------------------------------------------------------
# BLOCKER 2: Global CSRF Middleware Anti-Pattern
# Pattern: docs/04_SECURITY_PATTERNS.md#global-csrf-protection
# -----------------------------------------------------------------------------
echo "   🌐 Checking for global CSRF middleware anti-pattern..."

GLOBAL_CSRF=$(grep -n "app\.use(csrfProtection)" server/index.ts 2>/dev/null || true)

if [ -n "$GLOBAL_CSRF" ]; then
  echo -e "${RED}   ❌ BLOCKER: Global CSRF middleware detected (causes double-protection):${NC}"
  echo "      $GLOBAL_CSRF"
  echo ""
  echo -e "${YELLOW}   FIX: Apply csrfProtection per-route, not globally${NC}"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#critical-anti-pattern-global-csrf-protection"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No global CSRF middleware found${NC}"
fi

# -----------------------------------------------------------------------------
# BLOCKER 3: N+1 Query Detection
# Pattern: docs/02_DATABASE_PATTERNS.md#n1-query-pattern
# -----------------------------------------------------------------------------
echo "   🔄 Checking for N+1 query patterns..."

# Look for direct db calls (not storage layer) inside loop bodies
# The storage layer already optimizes queries, so focus on raw db access
N1_ISSUES=$(grep -rn -A10 "for\s*(\|\.forEach(\|while\s*(" server/ --include="*.ts" 2>/dev/null | \
  grep -E "await db\.|await this\.db\.|await tx\." | \
  grep -v "__tests__" | \
  grep -v "\.test\." | \
  grep -v "\.spec\." | \
  grep -v "scripts/" | \
  grep -v "// N+1 safe" | \
  head -10 || true)

if [ -n "$N1_ISSUES" ]; then
  echo -e "${RED}   ❌ BLOCKER: Potential N+1 query patterns detected:${NC}"
  echo "$N1_ISSUES" | head -5 | while read -r line; do
    [ -n "$line" ] && echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Use JOINs, inArray(), or batch fetching instead${NC}"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#n1-query-pattern"
  echo "   BYPASS: Add '// N+1 safe: <reason>' comment if intentional"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No N+1 query patterns detected${NC}"
fi

# -----------------------------------------------------------------------------
# BLOCKER 4: Foreign Key Cascade Rules
# Pattern: docs/02_DATABASE_PATTERNS.md#foreign-key-cascade-rules
# -----------------------------------------------------------------------------
echo "   🔗 Checking foreign key cascade rules..."

# NOTE: references() options are often multi-line; check a small window for onDelete.
FK_NO_CASCADE_LINES=()
while IFS=: read -r line rest; do
  snippet=$(sed -n "${line},$((line+8))p" shared/schema.ts 2>/dev/null || true)

  if echo "$snippet" | grep -q "// CASCADE handled"; then
    continue
  fi

  if echo "$snippet" | grep -q "onDelete:"; then
    continue
  fi

  FK_NO_CASCADE_LINES+=("$line:  $rest")
done < <(grep -n "\.references(" shared/schema.ts 2>/dev/null || true)

FK_NO_CASCADE=$(printf "%s\n" "${FK_NO_CASCADE_LINES[@]}")

if [ -n "$FK_NO_CASCADE" ]; then
  echo -e "${RED}   ❌ BLOCKER: Foreign keys found without onDelete cascade rules:${NC}"
  echo "$FK_NO_CASCADE" | head -10 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Add { onDelete: 'cascade' | 'set null' | 'restrict' }${NC}"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#foreign-key-cascade-rules"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ All foreign keys have cascade rules${NC}"
fi

# -----------------------------------------------------------------------------
# BLOCKER 5: Console.log in Server Code
# Pattern: docs/04_SECURITY_PATTERNS.md#consolelog-in-production
# -----------------------------------------------------------------------------
echo "   📝 Checking for console.log in server code..."

CONSOLE_LOGS=$(grep -rn "console\.log\|console\.debug" server/ --include="*.ts" 2>/dev/null | \
  grep -v "__tests__" | \
  grep -v "\.test\." | \
  grep -v "\.spec\." | \
  grep -v "// DEBUG:" | \
  grep -v "utils/logger" | \
  grep -v "\* " | \
  grep -v "BUILD-TIME ONLY" | \
  grep -v "scripts/" | \
  grep -v "node -e" || true)

if [ -n "$CONSOLE_LOGS" ]; then
  echo -e "${RED}   ❌ BLOCKER: console.log found in server code:${NC}"
  echo "$CONSOLE_LOGS" | head -10 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Use structured logger from utils/logger${NC}"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#consolelog-in-production"
  echo "   BYPASS: Add '// DEBUG: <reason>' comment for temporary debugging"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No console.log in server code${NC}"
fi

echo ""

# =============================================================================
# SECTION 4: EXISTING SECURITY PATTERN CHECKS (Enhanced)
# =============================================================================
echo -e "${BLUE}🔍 [4/7] Scanning for security anti-patterns...${NC}"
echo ""

# Check for password hash exposure
echo "   🔑 Checking for password hash exposure..."
PW_EXPOSURE=$(grep -rn "passwordHash:" server/ --include="*.ts" 2>/dev/null | \
  grep -v "SECURITY:" | \
  grep -v "// " | \
  grep -v "__tests__" | \
  grep -v "\.test\." | \
  grep -v "interface " | \
  grep -v "type " | \
  grep -v ": string" | \
  grep -v "scripts/" || true)

if [ -n "$PW_EXPOSURE" ]; then
  echo -e "${RED}   ❌ BLOCKER: Potential password hash exposure detected:${NC}"
  echo "$PW_EXPOSURE" | head -5 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Use explicit field selection, exclude passwordHash${NC}"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#password-hash-exposure"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No password hash exposure detected${NC}"
fi

# Check for 'as any' type casts
echo "   🎯 Checking for 'as any' type casts..."
AS_ANY=$(grep -rn "as any" server/ --include="*.ts" 2>/dev/null | \
  grep -v "SECURITY:" | \
  grep -v "// " | \
  grep -v "\* " | \
  grep -v "__tests__" | \
  grep -v "\.test\." || true)

if [ -n "$AS_ANY" ]; then
  echo -e "${RED}   ❌ BLOCKER: Unsafe 'as any' type casts found:${NC}"
  echo "$AS_ANY" | head -5 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Use proper types or type guards instead${NC}"
  echo "   DOCS: docs/01_TYPESCRIPT_PATTERNS.md#using-any-type"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No 'as any' type casts found${NC}"
fi

# Check for unsafe parseInt on request params
echo "   🔢 Checking for unsafe parseInt on request params..."
UNSAFE_PARSE=$(grep -rn "parseInt(req\.\|Number(req\." server/ --include="*.ts" 2>/dev/null | \
  grep -v "parseIntSafe\|parseIntOptional" | \
  grep -v "__tests__" | \
  grep -v "\.test\." || true)

if [ -n "$UNSAFE_PARSE" ]; then
  echo -e "${RED}   ❌ BLOCKER: Unsafe parseInt on request params:${NC}"
  echo "$UNSAFE_PARSE" | head -5 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Use parseIntSafe(req.params.id, 'fieldName', { min: 1 })${NC}"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#safe-integer-parsing"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No unsafe parseInt on request params${NC}"
fi

echo ""

# =============================================================================
# SECTION 5: P1 WARNINGS (Non-blocking)
# =============================================================================
echo -e "${BLUE}⚠️  [5/7] Running P1 Warning Checks...${NC}"
echo ""

# Check for raw error message exposure
echo "   📨 Checking for raw error message exposure..."
ERROR_EXPOSURE=$(grep -rn "error\.message" server/ --include="*.ts" 2>/dev/null | \
  grep -v "sanitizeErrorMessage\|createErrorResponse\|sendErrorFromException\|console\|SECURITY:\|logger\|log\." | \
  grep -v "__tests__" | \
  grep -v "\.test\." || true)

if [ -n "$ERROR_EXPOSURE" ]; then
  echo -e "${YELLOW}   ⚠️  WARNING: Potential raw error message exposure:${NC}"
  echo "$ERROR_EXPOSURE" | head -5 | while read -r line; do
    echo "      $line"
  done
  echo "   FIX: Use sendErrorFromException() or createErrorResponse()"
  WARNINGS=$((WARNINGS + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No raw error message exposure detected${NC}"
fi

# Check for missing transaction boundaries
echo "   💾 Checking for potential missing transaction boundaries..."
# Find files with multiple insert statements but no transaction
MULTI_INSERT_FILES=""
for file in $(find server/ -name "*.ts" -not -path "*__tests__*" -not -name "*.test.ts" -not -name "*.spec.ts" 2>/dev/null); do
  if [ -f "$file" ]; then
    INSERT_COUNT=$(grep -c "\.insert(" "$file" 2>/dev/null || echo "0")
    HAS_TRANSACTION=$(grep -c "db\.transaction\|\.transaction(" "$file" 2>/dev/null || echo "0")
    
    # Ensure we have valid integers
    INSERT_COUNT=$(echo "$INSERT_COUNT" | tr -d '[:space:]')
    HAS_TRANSACTION=$(echo "$HAS_TRANSACTION" | tr -d '[:space:]')
    
    # Default to 0 if empty
    INSERT_COUNT=${INSERT_COUNT:-0}
    HAS_TRANSACTION=${HAS_TRANSACTION:-0}
    
    if [ "$INSERT_COUNT" -gt 1 ] 2>/dev/null && [ "$HAS_TRANSACTION" -eq 0 ] 2>/dev/null; then
      MULTI_INSERT_FILES="${MULTI_INSERT_FILES}${file} (${INSERT_COUNT} inserts)\n"
    fi
  fi
done

if [ -n "$MULTI_INSERT_FILES" ]; then
  echo -e "${YELLOW}   ⚠️  WARNING: Files with multiple inserts but no transaction:${NC}"
  echo -e "$MULTI_INSERT_FILES" | head -5 | while read -r line; do
    [ -n "$line" ] && echo "      $line"
  done
  echo "   REVIEW: Consider wrapping in db.transaction() for atomicity"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#transaction-patterns"
  WARNINGS=$((WARNINGS + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No missing transaction boundaries detected${NC}"
fi

# Check for hardcoded password constants
echo "   🔑 Checking for hardcoded password constants..."
HARDCODED_PW=$(grep -rn "\.min(8)\|\.min(12)" server/ --include="*.ts" 2>/dev/null | \
  grep -i "password" | \
  grep -v "PASSWORD\." | \
  grep -v "__tests__" || true)

if [ -n "$HARDCODED_PW" ]; then
  echo -e "${YELLOW}   ⚠️  WARNING: Hardcoded password lengths found:${NC}"
  echo "$HARDCODED_PW" | head -3 | while read -r line; do
    echo "      $line"
  done
  echo "   FIX: Use PASSWORD.MIN_LENGTH from utils/constants"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#password-security"
  WARNINGS=$((WARNINGS + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No hardcoded password constants found${NC}"
fi

echo ""

# =============================================================================
# SECTION 6: ARCHITECTURE CHECKS
# =============================================================================
echo -e "${BLUE}🏗️  [6/7] Running Architecture Checks...${NC}"
echo ""

# Check for direct db imports in services (should use storage)
echo "   📦 Checking storage layer architecture..."
DIRECT_DB=$(grep -rn "from ['\"]\.\.\/db['\"]" server/services/ --include="*.ts" 2>/dev/null | \
  grep -v "price-aggregation-service" | \
  grep -v "__tests__" || true)

if [ -n "$DIRECT_DB" ]; then
  echo -e "${YELLOW}   ⚠️  WARNING: Services importing db directly (should use storage):${NC}"
  echo "$DIRECT_DB" | head -5 | while read -r line; do
    echo "      $line"
  done
  echo "   FIX: Import { storage } from '../storage' instead"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#storage-layer-architecture"
  WARNINGS=$((WARNINGS + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ Services properly use storage layer${NC}"
fi

# Check for auth before CSRF (wrong order)
echo "   🔧 Checking middleware order patterns..."
AUTH_BEFORE_CSRF=$(grep -rn "requireAuth.*csrfProtection\|withAuth.*csrfProtection" server/ --include="*.ts" 2>/dev/null | \
  grep -v "__tests__" || true)

if [ -n "$AUTH_BEFORE_CSRF" ]; then
  echo -e "${YELLOW}   ⚠️  WARNING: Auth middleware before CSRF (should be CSRF first):${NC}"
  echo "$AUTH_BEFORE_CSRF" | head -3 | while read -r line; do
    echo "      $line"
  done
  echo "   FIX: Order should be: csrfProtection, withAuth(handler)"
  echo "   DOCS: CLAUDE.md#middleware-pipeline-order"
  WARNINGS=$((WARNINGS + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ Middleware order is correct${NC}"
fi

echo ""

# =============================================================================
# SECTION 7: SUMMARY
# =============================================================================
echo -e "${BLUE}📊 [7/7] Security Check Summary${NC}"
echo "╔════════════════════════════════════════════════════════════════╗"

if [ $SECURITY_ISSUES -gt 0 ]; then
  echo -e "║  ${RED}❌ BLOCKING ISSUES: $SECURITY_ISSUES${NC}                                        ║"
else
  echo -e "║  ${GREEN}✅ BLOCKING ISSUES: 0${NC}                                          ║"
fi

if [ $WARNINGS -gt 0 ]; then
  echo -e "║  ${YELLOW}⚠️  WARNINGS: $WARNINGS${NC}                                                  ║"
else
  echo -e "║  ${GREEN}✅ WARNINGS: 0${NC}                                                 ║"
fi

echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Exit with error if blocking issues found
if [ $SECURITY_ISSUES -gt 0 ]; then
  echo -e "${RED}❌ Pre-commit check FAILED - $SECURITY_ISSUES blocking issue(s) found${NC}"
  echo ""
  echo "To bypass (NOT RECOMMENDED): git commit --no-verify"
  echo "For pattern documentation: docs/planning/PRE_COMMIT_ENHANCEMENT_PLAN.md"
  exit 1
else
  echo -e "${GREEN}✅ All security checks passed!${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}   (with $WARNINGS non-blocking warnings - consider addressing)${NC}"
  fi
  exit 0
fi