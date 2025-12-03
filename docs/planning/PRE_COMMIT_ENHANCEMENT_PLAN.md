# Pre-Commit Hook Enhancement Plan

**Created:** 2025-12-02
**Status:** Phase 1 Complete ✅
**Priority:** High - Security & Code Quality Enforcement

---

## Executive Summary

This plan details enhancements to the pre-commit hook system to automatically enforce patterns documented in `/docs/0*_PATTERNS.md` files. The goal is to close the gap between documented best practices and automated enforcement.

### Current State vs Target State

| Metric | Before | After Phase 1 | Target |
|--------|--------|---------------|--------|
| Automated pattern checks | 5 | 12 | 15+ |
| Security violations caught | ~60% | ~85% | ~95% |
| N+1 query prevention | Manual review | Automated ✅ | Automated |
| CSRF coverage validation | Manual review | Automated ✅ | Automated |

---

## Phase 1: Critical Security Enhancements (Priority: P0) ✅ COMPLETE

**Completed:** 2025-12-02
**Impact:** Prevents security vulnerabilities from entering codebase

### Implemented Checks

| Check | Status | Detection Method |
|-------|--------|------------------|
| CSRF Protection Validation | ✅ Implemented | Grep for mutations without csrfProtection |
| Global CSRF Anti-Pattern | ✅ Implemented | Check server/index.ts for app.use(csrfProtection) |
| N+1 Query Detection | ✅ Implemented | Grep for db calls within loop bodies |
| Foreign Key Cascades | ✅ Implemented | Check schema.ts for .references without onDelete |
| Console.log Blocker | ✅ Implemented | Grep for console.log/debug excluding exemptions |

### Additional Enhancements Made

- Enhanced password hash exposure detection (excludes interface definitions)
- Enhanced 'as any' detection (excludes JSDoc comments)  
- Added transaction boundary warnings
- Added middleware order validation
- Added hardcoded password constant detection
- Added storage layer architecture check
- Color-coded output with clear sections
- Improved error messages with FIX/DOCS/BYPASS guidance
- Summary statistics at end

### 1.1 CSRF Protection Validation

**Pattern Source:** `docs/04_SECURITY_PATTERNS.md` - CSRF Protection section

**Current Gap:** No automated check for missing CSRF on mutations

**Implementation:**
```bash
# Add to scripts/security-checks.sh

# Check for POST/PUT/PATCH/DELETE routes without csrfProtection
echo "🔐 Checking CSRF protection on mutations..."
CSRF_MISSING=$(grep -rn "app\.\(post\|put\|patch\|delete\)\|router\.\(post\|put\|patch\|delete\)" server/ --include="*.ts" | \
  grep -v "csrfProtection" | \
  grep -v "// CSRF exempt" | \
  grep -v "__tests__" | \
  grep -v "\.test\." | \
  grep -v "health\|webhook\|track-click")

if [ -n "$CSRF_MISSING" ]; then
  echo "❌ BLOCKER: Mutations found without csrfProtection middleware:"
  echo "$CSRF_MISSING"
  echo ""
  echo "   FIX: Add csrfProtection middleware before route handler"
  echo "   EXAMPLE: app.post('/api/resource', csrfProtection, withAuth(handler))"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#csrf-protection"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi
```

**Exclusions:**
- Health check endpoints
- Webhook endpoints (with signature verification)
- Analytics tracking endpoints
- Test files

**False Positive Handling:**
- Add `// CSRF exempt: <reason>` comment pattern for legitimate exemptions

---

### 1.2 N+1 Query Detection

**Pattern Source:** `docs/02_DATABASE_PATTERNS.md` - N+1 Query Pattern section

**Current Gap:** Not checked at all

**Implementation:**
```bash
# Check for database queries inside loops (N+1 pattern)
echo "🔄 Checking for N+1 query patterns..."
N1_PATTERNS=$(grep -rn -B5 "await db\.\|await this\.db\.\|await tx\." server/ --include="*.ts" | \
  grep -E "for\s*\(|\.forEach\(|\.map\(async|while\s*\(" | \
  grep -v "__tests__" | \
  grep -v "\.test\.")

if [ -n "$N1_PATTERNS" ]; then
  echo "❌ BLOCKER: Potential N+1 query patterns detected:"
  echo "$N1_PATTERNS"
  echo ""
  echo "   FIX: Use JOINs, inArray(), or batch fetching"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#n1-query-pattern"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi
```

**Detection Logic:**
1. Find all `await db.` or `await this.db.` calls
2. Check if within 5 lines of a loop construct
3. Flag for manual review

**Known Limitations:**
- May have false positives for legitimate batch processing
- Add `// N+1 safe: <reason>` comment for exceptions

---

### 1.3 Foreign Key Cascade Validation

**Pattern Source:** `docs/02_DATABASE_PATTERNS.md` - Foreign Key Cascade Rules section

**Current Gap:** Not checked

**Implementation:**
```bash
# Check for foreign keys without cascade rules
echo "🔗 Checking foreign key cascade rules..."
FK_NO_CASCADE=$(grep -rn "\.references(" shared/schema.ts | \
  grep -v "onDelete:" | \
  grep -v "// CASCADE handled")

if [ -n "$FK_NO_CASCADE" ]; then
  echo "❌ BLOCKER: Foreign keys found without onDelete cascade rules:"
  echo "$FK_NO_CASCADE"
  echo ""
  echo "   FIX: Add { onDelete: 'cascade' | 'set null' | 'restrict' }"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#foreign-key-cascade-rules"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi
```

---

### 1.4 Console.log Blocker (Upgrade from Warning)

**Pattern Source:** `docs/04_SECURITY_PATTERNS.md` - Console.log in Production section

**Current State:** Warning only

**Change:** Upgrade to blocker for server code

```bash
# Upgrade console.log to blocker for server code
echo "📝 Checking for console.log in server code..."
CONSOLE_LOGS=$(grep -rn "console\.log\|console\.debug" server/ --include="*.ts" | \
  grep -v "__tests__" | \
  grep -v "\.test\." | \
  grep -v "// DEBUG:" | \
  grep -v "utils/logger")

if [ -n "$CONSOLE_LOGS" ]; then
  echo "❌ BLOCKER: console.log found in server code:"
  echo "$CONSOLE_LOGS" | head -10
  echo ""
  echo "   FIX: Use structured logger from utils/logger"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#consolelog-in-production"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi
```

---

## Phase 2: Data Integrity Enhancements (Priority: P1)

**Timeline:** 2-3 days
**Impact:** Prevents data corruption and integrity issues

### 2.1 Transaction Boundary Detection

**Pattern Source:** `docs/02_DATABASE_PATTERNS.md` - Transaction Patterns section

**Detection Cases:**
1. Multiple related inserts without transaction
2. Check-then-act without SERIALIZABLE isolation

```bash
# Check for multiple inserts without transaction
echo "💾 Checking transaction boundaries..."

# Find files with multiple insert statements
for file in $(find server/ -name "*.ts" -not -path "*__tests__*" -not -name "*.test.ts"); do
  INSERT_COUNT=$(grep -c "\.insert(" "$file" 2>/dev/null || echo 0)
  HAS_TRANSACTION=$(grep -c "db\.transaction\|tx\." "$file" 2>/dev/null || echo 0)
  
  if [ "$INSERT_COUNT" -gt 1 ] && [ "$HAS_TRANSACTION" -eq 0 ]; then
    echo "⚠️  WARNING: $file has $INSERT_COUNT inserts but no transaction"
  fi
done
```

### 2.2 SERIALIZABLE Isolation Check

**Pattern Source:** `docs/02_DATABASE_PATTERNS.md` - Transaction Isolation Levels section

```bash
# Check for check-then-act patterns without SERIALIZABLE
echo "🔒 Checking for race condition patterns..."
CHECK_THEN_ACT=$(grep -rn -A10 "\.select\(" server/ --include="*.ts" | \
  grep -B5 "\.insert\|\.update\|\.delete" | \
  grep "count\|length\|>=" | \
  grep -v "serializable" | \
  grep -v "__tests__")

if [ -n "$CHECK_THEN_ACT" ]; then
  echo "⚠️  WARNING: Potential check-then-act without SERIALIZABLE isolation:"
  echo "$CHECK_THEN_ACT" | head -10
  echo ""
  echo "   REVIEW: Consider { isolationLevel: 'serializable' }"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#serializable-isolation"
fi
```

### 2.3 Password Constant Usage

**Pattern Source:** `docs/04_SECURITY_PATTERNS.md` - Password Security section

```bash
# Check for hardcoded password lengths (should use PASSWORD constants)
echo "🔑 Checking password constant usage..."
HARDCODED_PW=$(grep -rn "\.min(8)\|\.min(12)" server/ --include="*.ts" | \
  grep -i "password" | \
  grep -v "PASSWORD\.")

if [ -n "$HARDCODED_PW" ]; then
  echo "⚠️  WARNING: Hardcoded password lengths found:"
  echo "$HARDCODED_PW"
  echo ""
  echo "   FIX: Use PASSWORD.MIN_LENGTH from utils/constants"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#password-security"
fi

# Check for hardcoded bcrypt rounds
HARDCODED_BCRYPT=$(grep -rn "bcrypt\.hash.*[0-9]\+)" server/ --include="*.ts" | \
  grep -v "PASSWORD\.BCRYPT_ROUNDS")

if [ -n "$HARDCODED_BCRYPT" ]; then
  echo "⚠️  WARNING: Hardcoded bcrypt rounds found:"
  echo "$HARDCODED_BCRYPT"
  echo ""
  echo "   FIX: Use PASSWORD.BCRYPT_ROUNDS from utils/constants"
fi
```

---

## Phase 3: Type Safety Enhancements (Priority: P1)

**Timeline:** 2-3 days
**Impact:** Prevents runtime type errors

### 3.1 Type Assertion Comment Requirement

**Pattern Source:** `docs/02_DATABASE_PATTERNS.md` - Type Assertion Documentation section

```bash
# Check for type assertions without comments
echo "📋 Checking type assertion documentation..."
TYPE_ASSERTIONS=$(grep -rn " as [A-Z]" server/ --include="*.ts" | \
  grep -v "as const" | \
  grep -v "// Type assertion:" | \
  grep -v "// Cast" | \
  grep -v "__tests__" | \
  head -10)

if [ -n "$TYPE_ASSERTIONS" ]; then
  echo "⚠️  WARNING: Type assertions without documentation:"
  echo "$TYPE_ASSERTIONS"
  echo ""
  echo "   FIX: Add '// Type assertion: <reason>' comment above"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#type-assertion-documentation"
fi
```

### 3.2 Unsafe parseInt Enhancement

**Current State:** Basic grep check

**Enhancement:** Check for parseInt on request params specifically

```bash
# Enhanced parseInt check - focus on route params
echo "🔢 Checking for unsafe parseInt on request params..."
UNSAFE_PARSE=$(grep -rn "parseInt(req\.\|Number(req\." server/ --include="*.ts" | \
  grep -v "parseIntSafe\|parseIntOptional")

if [ -n "$UNSAFE_PARSE" ]; then
  echo "❌ BLOCKER: Unsafe parseInt on request params:"
  echo "$UNSAFE_PARSE"
  echo ""
  echo "   FIX: Use parseIntSafe(req.params.id, 'fieldName', { min: 1 })"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#safe-integer-parsing"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi
```

### 3.3 Return Type Consistency

**Pattern Source:** `docs/02_DATABASE_PATTERNS.md` - Null vs Undefined Consistency section

```bash
# Check for inconsistent return types in storage layer
echo "📦 Checking storage return type consistency..."
UNDEFINED_RETURNS=$(grep -rn "| undefined" server/storage*.ts server/storage/ --include="*.ts" | \
  grep "Promise<" | \
  grep -v "options\|config\|params")

if [ -n "$UNDEFINED_RETURNS" ]; then
  echo "⚠️  WARNING: Storage methods returning | undefined (should use | null):"
  echo "$UNDEFINED_RETURNS"
  echo ""
  echo "   FIX: Use | null for database 'not found' scenarios"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#null-vs-undefined-consistency"
fi
```

---

## Phase 4: Architecture Enforcement (Priority: P2)

**Timeline:** 3-5 days
**Impact:** Enforces architectural patterns

### 4.1 Storage Layer Pattern Enforcement

**Pattern Source:** `docs/02_DATABASE_PATTERNS.md` - Storage Layer Architecture section

```bash
# Check for direct db imports in services (should use storage)
echo "🏗️  Checking storage layer architecture..."
DIRECT_DB=$(grep -rn "from ['\"]\.\.\/db['\"]" server/services/ --include="*.ts" | \
  grep -v "price-aggregation-service" | \  # Documented exception
  grep -v "__tests__")

if [ -n "$DIRECT_DB" ]; then
  echo "❌ BLOCKER: Services importing db directly (use storage layer):"
  echo "$DIRECT_DB"
  echo ""
  echo "   FIX: Import { storage } from '../storage' instead"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#storage-layer-architecture"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi
```

### 4.2 Middleware Order Validation

**Pattern Source:** `CLAUDE.md` - Middleware Pipeline Order section

```bash
# Check for common middleware order mistakes
echo "🔧 Checking middleware order patterns..."

# Auth before CSRF is wrong
AUTH_BEFORE_CSRF=$(grep -rn "requireAuth.*csrfProtection\|withAuth.*csrfProtection" server/ --include="*.ts")

if [ -n "$AUTH_BEFORE_CSRF" ]; then
  echo "⚠️  WARNING: Auth middleware before CSRF (should be CSRF first):"
  echo "$AUTH_BEFORE_CSRF"
  echo ""
  echo "   FIX: Order should be: csrfProtection, withAuth(handler)"
  echo "   DOCS: CLAUDE.md#middleware-pipeline-order"
fi
```

### 4.3 Global CSRF Detection

**Pattern Source:** `docs/04_SECURITY_PATTERNS.md` - CRITICAL ANTI-PATTERN section

```bash
# Check for global CSRF application (anti-pattern)
echo "🌐 Checking for global CSRF middleware..."
GLOBAL_CSRF=$(grep -rn "app\.use(csrfProtection)" server/index.ts)

if [ -n "$GLOBAL_CSRF" ]; then
  echo "❌ BLOCKER: Global CSRF middleware detected (causes double-protection):"
  echo "$GLOBAL_CSRF"
  echo ""
  echo "   FIX: Apply csrfProtection per-route, not globally"
  echo "   DOCS: docs/04_SECURITY_PATTERNS.md#global-csrf-protection"
  SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi
```

---

## Phase 5: Test Quality Enforcement (Priority: P2)

**Timeline:** 2-3 days
**Impact:** Improves test reliability

### 5.1 Test Cleanup Pattern

**Pattern Source:** `docs/02_DATABASE_PATTERNS.md` - Test Database Cleanup section

```bash
# Check for db.delete in test files (should use TRUNCATE CASCADE)
echo "🧹 Checking test cleanup patterns..."
TEST_DELETE=$(grep -rn "await db\.delete\|db\.delete(" server/ --include="*.test.ts" | \
  grep "beforeEach\|afterEach\|beforeAll\|afterAll" -A5 -B5 | \
  grep "delete")

if [ -n "$TEST_DELETE" ]; then
  echo "⚠️  WARNING: Test cleanup using db.delete (use TRUNCATE CASCADE):"
  echo "$TEST_DELETE" | head -5
  echo ""
  echo "   FIX: Use TRUNCATE TABLE ... RESTART IDENTITY CASCADE"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#test-database-cleanup"
fi
```

### 5.2 Test Data Type Safety

**Pattern Source:** `docs/02_DATABASE_PATTERNS.md` - Test Data Type Safety section

```bash
# Check for string numbers in test data
echo "📊 Checking test data types..."
STRING_NUMBERS=$(grep -rn "targetPrice.*['\"][0-9]\|price.*['\"][0-9]" server/ --include="*.test.ts")

if [ -n "$STRING_NUMBERS" ]; then
  echo "⚠️  WARNING: String numbers in test data (Zod requires proper types):"
  echo "$STRING_NUMBERS" | head -5
  echo ""
  echo "   FIX: Use numbers not strings: targetPrice: 249.99"
  echo "   DOCS: docs/02_DATABASE_PATTERNS.md#test-data-type-safety"
fi
```

---

## Implementation Priority Matrix

| Phase | Check | Impact | Effort | Priority |
|-------|-------|--------|--------|----------|
| 1.1 | CSRF Protection | 🔴 Critical | Low | P0 |
| 1.2 | N+1 Query Detection | 🔴 Critical | Medium | P0 |
| 1.3 | FK Cascade Rules | 🟠 High | Low | P0 |
| 1.4 | Console.log Blocker | 🟠 High | Low | P0 |
| 2.1 | Transaction Boundaries | 🟠 High | Medium | P1 |
| 2.2 | SERIALIZABLE Check | 🟡 Medium | Medium | P1 |
| 2.3 | Password Constants | 🟡 Medium | Low | P1 |
| 3.1 | Type Assertion Comments | 🟡 Medium | Low | P1 |
| 3.2 | parseInt Enhancement | 🟠 High | Low | P1 |
| 3.3 | Return Type Consistency | 🟢 Low | Low | P2 |
| 4.1 | Storage Layer Pattern | 🟠 High | Medium | P2 |
| 4.2 | Middleware Order | 🟡 Medium | Medium | P2 |
| 4.3 | Global CSRF Detection | 🔴 Critical | Low | P0 |
| 5.1 | Test Cleanup Pattern | 🟢 Low | Low | P2 |
| 5.2 | Test Data Types | 🟢 Low | Low | P2 |

---

## Implementation Approach

### Option A: Single Enhanced Script (Recommended)

Update `scripts/security-checks.sh` with all new checks organized by phase.

**Pros:**
- Single file to maintain
- Easy to add/remove checks
- Consistent error output format

**Cons:**
- Script becomes longer
- All checks run every time

### Option B: Modular Check Scripts

Create separate scripts per phase:
- `scripts/checks/security.sh`
- `scripts/checks/database.sh`
- `scripts/checks/types.sh`
- `scripts/checks/architecture.sh`

**Pros:**
- Easier to maintain individual checks
- Can run subsets of checks

**Cons:**
- More files to manage
- Need orchestration script

### Option C: ESLint Custom Rules

Create custom ESLint rules for pattern detection.

**Pros:**
- Better AST-based detection
- IDE integration
- Standard tooling

**Cons:**
- Higher implementation effort
- Requires ESLint plugin development
- Some patterns hard to express as ESLint rules

### Recommendation

**Start with Option A** (enhanced single script) for Phase 1, then evaluate modularization if the script becomes unwieldy.

---

## Rollout Plan

### Week 1: P0 Checks (Blockers)
1. Implement CSRF protection check
2. Implement N+1 query detection
3. Implement FK cascade check
4. Upgrade console.log to blocker
5. Add global CSRF detection
6. **Test on current codebase** - fix any issues found
7. **Deploy to team**

### Week 2: P1 Checks (Warnings → Blockers)
1. Implement transaction boundary check
2. Implement SERIALIZABLE detection
3. Implement password constant check
4. Implement type assertion check
5. Enhanced parseInt check
6. **Run as warnings first** - collect false positive data
7. **Refine patterns** based on feedback

### Week 3: P2 Checks (Warnings)
1. Implement architecture checks
2. Implement test quality checks
3. **Document exception patterns**
4. **Update pattern docs** with pre-commit references

### Week 4: Stabilization
1. Address false positives
2. Add missing exception patterns
3. **Convert stable P1 warnings to blockers**
4. Document final check coverage

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Security violations caught pre-commit | 95% | Compare to code review findings |
| False positive rate | < 5% | Track `--no-verify` usage |
| Developer friction | Minimal | Survey + commit times |
| Pattern doc compliance | 90%+ | Automated check coverage |

---

## Maintenance Plan

### Monthly Review
- Review false positive reports
- Add new patterns from code reviews
- Update exception lists

### Quarterly Audit
- Compare pre-commit catches vs production bugs
- Evaluate new check candidates
- Performance optimization if needed

---

## Appendix A: Exception Comment Patterns

Standard comments to bypass specific checks:

```typescript
// CSRF exempt: Public analytics endpoint, no user data modified
// N+1 safe: Intentional sequential processing for rate limiting
// CASCADE handled: Soft delete pattern, no hard cascades
// DEBUG: Temporary logging for issue investigation (remove before merge)
// Type assertion: Drizzle returns unknown for JSON fields
```

---

## Appendix B: Current Check Coverage Map

```
docs/01_TYPESCRIPT_PATTERNS.md
├── any types .......................... ✅ ESLint + grep
├── Type assertions .................... 🟡 Phase 3.1
├── Async/Promise patterns ............. ❌ Not automated
└── Error type handling ................ ❌ Not automated

docs/02_DATABASE_PATTERNS.md
├── Storage layer architecture ......... 🟡 Phase 4.1
├── N+1 queries ....................... 🟡 Phase 1.2
├── Password hash exposure ............. ✅ grep
├── Foreign key cascades ............... 🟡 Phase 1.3
├── Transaction boundaries ............. 🟡 Phase 2.1
├── SERIALIZABLE isolation ............. 🟡 Phase 2.2
└── Test cleanup patterns .............. 🟡 Phase 5.1

docs/03_API_PATTERNS.md
├── Route middleware order ............. 🟡 Phase 4.2
├── Input validation ................... ⚠️ Partial
└── Error response format .............. ❌ Not automated

docs/04_SECURITY_PATTERNS.md
├── CSRF protection .................... 🟡 Phase 1.1
├── Global CSRF anti-pattern ........... 🟡 Phase 4.3
├── Safe parseInt ...................... 🟡 Phase 3.2
├── Password constants ................. 🟡 Phase 2.3
├── Console.log ....................... 🟡 Phase 1.4 (upgrade)
└── Error sanitization ................. ✅ grep

Legend: ✅ Implemented | 🟡 Planned | ⚠️ Partial | ❌ Not planned
```

---

## Next Steps

1. **Review this plan** with team
2. **Prioritize** based on recent bug patterns
3. **Implement Phase 1** checks (1-2 days)
4. **Test on current codebase** before enforcing
5. **Gradual rollout** with warning period
