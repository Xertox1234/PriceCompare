#!/bin/bash
# Security checks script - Enhanced Version 2.1
# Run this before committing code
#
# Phase 1 (P0) Checks - BLOCKERS:
#   - CSRF protection on mutations
#   - N+1 query detection
#   - Foreign key cascade rules
#   - Console.log in server code
#   - Global CSRF middleware anti-pattern
#
# E2E Testing Pattern Checks - BLOCKERS:
#   - Attach-Before-Trigger pattern (race condition prevention)
#   - Promise.race() in auth helpers (incomplete state verification)
#
# E2E Testing Pattern Checks - WARNINGS:
#   - Hardcoded timeout values (should use TIMEOUTS constant)
#   - UI state checks without API wait (race condition risk)
#
# See: docs/planning/PRE_COMMIT_ENHANCEMENT_PLAN.md
# See: docs/08_TESTING_PATTERNS.md#e2e-race-condition-prevention

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

# Check for forbidden scraping libraries (axios, cheerio, puppeteer)
echo "   🌐 Checking for forbidden scraping libraries (PLAYWRIGHT ONLY)..."
FORBIDDEN_SCRAPING=$(grep -rn "from ['\"]axios['\"]\|import.*cheerio\|from ['\"]puppeteer['\"]\|import.*puppeteer" server/agents/ --include="*.ts" 2>/dev/null | \
  grep -v "__tests__" | \
  grep -v "\.test\." | \
  grep -v "backup\|old" | \
  grep -v "// Playwright migration exception" || true)

if [ -n "$FORBIDDEN_SCRAPING" ]; then
  echo -e "${RED}   ❌ BLOCKER: Forbidden scraping libraries detected (use Playwright):${NC}"
  echo "$FORBIDDEN_SCRAPING" | head -5 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Use Playwright for all browser automation and scraping${NC}"
  echo "   FORBIDDEN: axios, cheerio, puppeteer (cannot handle JavaScript-rendered sites)"
  echo "   REQUIRED: import { chromium } from 'playwright'"
  echo "   DOCS: CLAUDE.md#browser-automation---mandatory-requirement"
  echo "   EVIDENCE: docs/SCRAPING_AXIOS_CHEERIO_FAILURES.md (0% success rate on modern sites)"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ All scraping code uses Playwright${NC}"
fi

# Check for dependency freeze violations (Architecture Freeze Policy)
echo "   🔒 Checking Architecture Freeze Policy (dependency/architecture changes)..."

# Check 1: package.json modifications (dependencies or devDependencies)
PACKAGE_JSON_CHANGES=$(git diff --cached package.json 2>/dev/null | grep -E '^\+.*"(dependencies|devDependencies)"' -A 50 | grep -E '^\+\s+"' || true)

if [ -n "$PACKAGE_JSON_CHANGES" ]; then
  # Check if there's an approval bypass comment in the staged diff
  APPROVAL_BYPASS=$(git diff --cached package.json 2>/dev/null | grep "// DEPENDENCY APPROVED:" || true)

  if [ -z "$APPROVAL_BYPASS" ]; then
    echo -e "${RED}   ❌ BLOCKER: package.json dependencies modified (Architecture Freeze active):${NC}"
    echo "      Modified dependencies detected in package.json"
    echo ""
    echo -e "${YELLOW}   FIX: Obtain approval before adding/changing dependencies${NC}"
    echo "   REQUIRED:"
    echo "   1. Document justification in docs/architecture/DEPENDENCY_PROPOSALS.md"
    echo "   2. Get written approval from project owner"
    echo "   3. Add approval reference to package.json as comment"
    echo ""
    echo "   DOCS: CLAUDE.md#architecture-freeze--dependency-policy"
    echo "   POLICY EFFECTIVE: 2026-01-13 (After axios+cheerio violation)"
    echo ""
    echo "   ALLOWED WITHOUT APPROVAL:"
    echo "   - Security patches: npm audit fix"
    echo "   - Patch version updates: 1.2.3 → 1.2.4"
    echo "   - Removing dependencies"
    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
    echo ""
  else
    echo -e "${GREEN}   ✅ package.json changes have approval bypass${NC}"
  fi
else
  # Check for package.json deletion/addition of dependencies (not just modifications)
  PACKAGE_DEPENDENCY_CHANGES=$(git diff --cached --unified=0 package.json 2>/dev/null | grep -E '^\+\s+"[^"]+": ' | grep -v '^\+\+\+' || true)

  if [ -n "$PACKAGE_DEPENDENCY_CHANGES" ]; then
    APPROVAL_BYPASS=$(git diff --cached package.json 2>/dev/null | grep "// DEPENDENCY APPROVED:" || true)

    if [ -z "$APPROVAL_BYPASS" ]; then
      echo -e "${RED}   ❌ BLOCKER: New dependencies added to package.json:${NC}"
      echo "$PACKAGE_DEPENDENCY_CHANGES" | head -5 | while read -r line; do
        echo "      $line"
      done
      echo ""
      echo -e "${YELLOW}   FIX: Follow Architecture Freeze approval process${NC}"
      echo "   DOCS: CLAUDE.md#architecture-freeze--dependency-policy"
      SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
      echo ""
    else
      echo -e "${GREEN}   ✅ Dependency changes have approval${NC}"
    fi
  else
    echo -e "${GREEN}   ✅ No dependency changes detected${NC}"
  fi
fi

# Check 2: Protected architecture file modifications
echo "   🏗️  Checking for protected architecture file modifications..."

PROTECTED_FILES=(
  "server/index.ts"
  "server/storage.ts"
  "server/utils/api-response.ts"
  "server/middleware/security.ts"
  "server/middleware/flexible-auth.ts"
  "shared/schema.ts"
)

PROTECTED_VIOLATIONS=""
for file in "${PROTECTED_FILES[@]}"; do
  # Check if file has meaningful changes (not just whitespace/comments)
  FILE_CHANGES=$(git diff --cached "$file" 2>/dev/null | grep -E '^[+-]' | grep -v '^[+-]{3}' | grep -v '^\+\s*$' | grep -v '^\+\s*//' || true)

  if [ -n "$FILE_CHANGES" ]; then
    # Check for architecture change approval bypass
    ARCH_BYPASS=$(git diff --cached "$file" 2>/dev/null | grep "// ARCHITECTURE CHANGE APPROVED:" || true)

    if [ -z "$ARCH_BYPASS" ]; then
      PROTECTED_VIOLATIONS="${PROTECTED_VIOLATIONS}      ${file}\n"
    fi
  fi
done

if [ -n "$PROTECTED_VIOLATIONS" ]; then
  echo -e "${RED}   ❌ BLOCKER: Protected architecture files modified without approval:${NC}"
  echo -e "$PROTECTED_VIOLATIONS"
  echo ""
  echo -e "${YELLOW}   FIX: Protected architecture files require explicit approval${NC}"
  echo "   PROTECTED FILES:"
  echo "   - server/index.ts (middleware pipeline order)"
  echo "   - server/storage.ts (storage layer pattern)"
  echo "   - server/utils/api-response.ts (API response standardization)"
  echo "   - server/middleware/security.ts (CSRF protection)"
  echo "   - server/middleware/flexible-auth.ts (authentication)"
  echo "   - shared/schema.ts (database schema)"
  echo ""
  echo "   ALLOWED WITHOUT APPROVAL:"
  echo "   - Bug fixes preserving existing patterns"
  echo "   - Adding routes/queries following existing patterns"
  echo ""
  echo "   DOCS: CLAUDE.md#architectural-changes---strictly-forbidden"
  echo "   POLICY: No architectural changes without explicit approval"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No protected architecture file modifications${NC}"
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

# Check for rollback files in migrations/ directory (alphabetical execution hazard)
echo "   📂 Checking for misplaced rollback files..."
MISPLACED_ROLLBACKS=$(ls migrations/*rollback*.sql 2>/dev/null || true)

if [ -n "$MISPLACED_ROLLBACKS" ]; then
  echo -e "${RED}   ❌ BLOCKER: Rollback files found in migrations/ directory:${NC}"
  echo "      $MISPLACED_ROLLBACKS"
  echo ""
  echo -e "${YELLOW}   FIX: Move rollback files to migrations/rollbacks/${NC}"
  echo "   mv migrations/*rollback*.sql migrations/rollbacks/"
  echo "   DOCS: migrations/README.md"
  echo "   INCIDENT: docs/learnings/database/LEARNINGS_TODO_009_MIGRATION_ROLLBACK_INCIDENT.md"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No misplaced rollback files${NC}"
fi

echo ""

# =============================================================================
# SECTION 7: E2E TESTING PATTERN CHECKS
# =============================================================================
echo -e "${BLUE}🧪 [7/8] Running E2E Testing Pattern Checks...${NC}"
echo ""

# -----------------------------------------------------------------------------
# E2E CHECK 1: Attach-Before-Trigger Pattern
# Pattern: docs/08_TESTING_PATTERNS.md#attach-before-trigger-pattern
# -----------------------------------------------------------------------------
echo "   ⏱️  Checking for Attach-Before-Trigger violations..."

# Look for waitForResponse() calls that come AFTER triggering actions
# This is a race condition where fast responses arrive before the listener is attached
ATTACH_AFTER_TRIGGER=$(grep -rn -B5 "waitForResponse" e2e/ --include="*.ts" 2>/dev/null | \
  grep -E "(await page\.(reload|goto|click)|await.*\.click\(\))" | \
  grep -v "const.*Promise = page.waitForResponse" | \
  grep -v "// Race condition safe" | \
  grep -v "__tests__" || true)

if [ -n "$ATTACH_AFTER_TRIGGER" ]; then
  echo -e "${RED}   ❌ BLOCKER: waitForResponse() called AFTER triggering action (race condition):${NC}"
  echo "$ATTACH_AFTER_TRIGGER" | head -5 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Attach listener BEFORE triggering action${NC}"
  echo "   WRONG:  await page.reload(); await page.waitForResponse(...);"
  echo "   RIGHT:  const promise = page.waitForResponse(...); await page.reload(); await promise;"
  echo "   DOCS: docs/08_TESTING_PATTERNS.md#attach-before-trigger-pattern"
  echo "   BYPASS: Add '// Race condition safe: <reason>' comment if intentional"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ All waitForResponse() calls use attach-before-trigger pattern${NC}"
fi

# -----------------------------------------------------------------------------
# E2E CHECK 2: Promise.race() in Auth/Logout Helpers
# Pattern: docs/08_TESTING_PATTERNS.md#comprehensive-state-verification-pattern
# -----------------------------------------------------------------------------
echo "   🏁 Checking for Promise.race() in auth/logout helpers..."

# Promise.race() passes when EITHER condition is met, masking incomplete state
# Use Promise.all() to verify ALL expected state changes
PROMISE_RACE_AUTH=$(grep -rn "Promise\.race" e2e/helpers.ts 2>/dev/null | \
  grep -v "// Promise.race justified" | \
  grep -v "//.*Promise\.race" | \
  grep -v "\* Promise\.race" || true)

if [ -n "$PROMISE_RACE_AUTH" ]; then
  echo -e "${RED}   ❌ BLOCKER: Promise.race() found in auth helpers (incomplete verification):${NC}"
  echo "$PROMISE_RACE_AUTH" | head -3 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo -e "${YELLOW}   FIX: Use Promise.all() to verify ALL state changes${NC}"
  echo "   WRONG:  Promise.race([userMenuHidden, signInVisible])"
  echo "   RIGHT:  Promise.all([userMenuHidden, signInVisible])"
  echo "   DOCS: docs/08_TESTING_PATTERNS.md#comprehensive-state-verification-pattern"
  echo "   BYPASS: Add '// Promise.race justified: <reason>' comment if mutually exclusive"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ No Promise.race() in auth helpers${NC}"
fi

# -----------------------------------------------------------------------------
# E2E CHECK 3: Hardcoded Timeout Values
# Pattern: docs/08_TESTING_PATTERNS.md#centralized-timeout-constants-pattern
# -----------------------------------------------------------------------------
echo "   🕐 Checking for hardcoded timeout values..."

# Look for hardcoded timeouts instead of TIMEOUTS constant
HARDCODED_TIMEOUTS=$(grep -rn "timeout:\s*[0-9]" e2e/helpers.ts 2>/dev/null | \
  grep -v "TIMEOUTS\." | \
  grep -v "// Hardcoded timeout justified" || true)

if [ -n "$HARDCODED_TIMEOUTS" ]; then
  echo -e "${YELLOW}   ⚠️  WARNING: Hardcoded timeout values found (should use TIMEOUTS constant):${NC}"
  echo "$HARDCODED_TIMEOUTS" | head -5 | while read -r line; do
    echo "      $line"
  done
  echo ""
  echo "   FIX: Use TIMEOUTS.BUTTON_VISIBLE, TIMEOUTS.API_RESPONSE, etc."
  echo "   DOCS: docs/08_TESTING_PATTERNS.md#centralized-timeout-constants-pattern"
  WARNINGS=$((WARNINGS + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ All timeouts use TIMEOUTS constant${NC}"
fi

# -----------------------------------------------------------------------------
# E2E CHECK 4: UI State Checks Without API Wait
# Pattern: docs/08_TESTING_PATTERNS.md#api-first-verification-pattern
# -----------------------------------------------------------------------------
echo "   🔄 Checking for UI state checks without API wait..."

# Look for UI state checks (waitFor) that come before API completion waits
# This creates race conditions where UI might not be updated yet
UI_BEFORE_API=$(grep -rn -A3 "\.click\(" e2e/helpers.ts 2>/dev/null | \
  grep -B1 "waitFor.*state.*visible\|waitFor.*state.*hidden" | \
  grep -v "waitForResponse\|logoutPromise\|csrfTokenPromise" | \
  grep -v "// UI check before API justified" | \
  head -10 || true)

if [ -n "$UI_BEFORE_API" ]; then
  echo -e "${YELLOW}   ⚠️  WARNING: UI state checks without preceding API wait:${NC}"
  echo "$UI_BEFORE_API" | head -5 | while read -r line; do
    [ -n "$line" ] && echo "      $line"
  done
  echo ""
  echo "   REVIEW: Ensure API response is awaited before checking UI state"
  echo "   PATTERN: await apiPromise; await page.waitFor({ state: ... })"
  echo "   DOCS: docs/08_TESTING_PATTERNS.md#api-first-verification-pattern"
  WARNINGS=$((WARNINGS + 1))
  echo ""
else
  echo -e "${GREEN}   ✅ UI state checks follow API-first pattern${NC}"
fi

echo ""

# =============================================================================
# SECTION 8: SUMMARY
# =============================================================================
echo -e "${BLUE}📊 [8/8] Security Check Summary${NC}"
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