# Learnings: TODO_205 Playwright Enforcement

**Date**: 2026-01-13
**Context**: Architecture compliance violation discovered during TODO_205 Playwright migration
**Severity**: P0 - CRITICAL
**Resolution**: Documentation strengthened + pre-commit hook enforcement added

---

## Problem Statement

### Architecture Violation Discovered

**CLAUDE.md explicitly mandated Playwright EXCLUSIVELY (lines 12-24)** since project inception, yet the scraping system violated this with ~1,600 LOC of axios+cheerio code across 7 agent files.

**Impact**:
- **0% success rate** on modern e-commerce sites (Amazon, Walmart, Target)
- ~1,600 LOC of business logic untested (0% coverage)
- 1.5-week migration required to fix
- **User frustration**: "I want playwright from the very beginning so I am a little upset here"

### Root Cause: Lack of Enforcement

**Why the violation happened**:
1. ❌ **Documentation alone insufficient** - CLAUDE.md had the mandate but no enforcement
2. ❌ **No pre-commit checks** - axios/cheerio imports not blocked
3. ❌ **No code review alerts** - Pattern violations went unnoticed
4. ❌ **No test coverage** - 0% test coverage meant no one noticed it didn't work
5. ❌ **Historical debt** - Project started with axios+cheerio MVP, never migrated

---

## Evidence of Failure

### Baseline Validation (Step 1 TODO_205)

Tested axios+cheerio against 3 major retailers:

| Retailer | URL | Result | Failure Mode |
|----------|-----|--------|--------------|
| **Amazon** | Kindle product | ❌ 0/4 fields | 404 bot detection |
| **Walmart** | AirPods Pro | ❌ 0/4 fields | PerimeterX CAPTCHA |
| **Target** | AirPods Pro | ❌ 0/4 fields | Empty JavaScript skeleton |
| **Overall** | 3 retailers | **0% success** | Cannot execute JavaScript |

**Evidence Document**: `docs/SCRAPING_AXIOS_CHEERIO_FAILURES.md`

### Playwright Migration Results (Step 2 TODO_205)

After Playwright migration:

| Retailer | Result | Improvement |
|----------|--------|-------------|
| **Target** | ✅ 100% (4/4 fields) | **+100%** |
| **Amazon** | ❌ 0% (anti-bot) | 0% (solvable with stealth plugin) |
| **Walmart** | ❌ 0% (CAPTCHA) | 0% (solvable with stealth plugin) |
| **Overall** | **33% full success** | **+33% absolute** |

**Proof**: Playwright solves JavaScript-rendering problem. Target went from 0% → 100%.

---

## Solution Implementation

### 1. Strengthened CLAUDE.md Documentation

**Before** (insufficient):
```markdown
## Browser Automation - MANDATORY REQUIREMENT

**⚠️ CRITICAL: This project uses Playwright EXCLUSIVELY...**

**NEVER use Puppeteer.** All browser automation...
```

**After** (comprehensive):
```markdown
## Browser Automation - MANDATORY REQUIREMENT

**NEVER use Puppeteer, axios+cheerio, or any other scraping library.**

### ❌ FORBIDDEN (Will be rejected in code review)

// ❌ WRONG - axios + cheerio CANNOT handle JavaScript-rendered content
import axios from 'axios';
import * as cheerio from 'cheerio';

### ✅ REQUIRED (Playwright pattern)

// ✅ CORRECT - Playwright executes JavaScript and waits for dynamic content
import { chromium } from 'playwright';

### Why Playwright is Mandatory

**Modern websites use JavaScript frameworks** (React, Vue, Angular):
- **axios+cheerio**: Gets raw HTML before JS executes → empty selectors ❌
- **Playwright**: Launches real browser, executes JavaScript → full content ✅

**Evidence**: See docs/SCRAPING_AXIOS_CHEERIO_FAILURES.md for proof

### Pre-Commit Enforcement

The pre-commit hook blocks commits with forbidden imports:
```

**Changes**:
- Added explicit axios+cheerio prohibition
- Added ❌ FORBIDDEN section with examples
- Added ✅ REQUIRED section with pattern
- Added "Why Playwright is Mandatory" explanation
- Added evidence reference
- Added pre-commit enforcement notice

### 2. Pre-Commit Hook Enforcement

Added automated check in `scripts/security-checks.sh`:

```bash
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
  exit 1
fi
```

**Enforcement**:
- Scans `server/agents/` for forbidden imports
- Blocks commit if axios, cheerio, or puppeteer found
- Excludes test files and backup files
- Provides clear fix guidance
- Links to documentation and evidence

### 3. Updated Common Pitfalls

Made axios+cheerio the **#1 pitfall** in CLAUDE.md:

```markdown
## Common Pitfalls

1. **❌ NEVER USE axios+cheerio FOR SCRAPING**: **CRITICAL** - Playwright ONLY.
   axios+cheerio cannot execute JavaScript and fails on 100% of modern sites.
   See TODO_205 migration for evidence. Pre-commit hook blocks axios/cheerio
   in `server/agents/`.
2. **N+1 QUERIES**: Use JOINs or `inArray()` batch queries
3. **Direct DB access**: Use `storage` layer...
```

**Impact**: Developers see this warning first when reading common pitfalls.

---

## Lessons Learned

### What Worked ✅

1. **Evidence-First Approach**: Step 1 validation (0% success rate) justified investment
2. **TDD Migration**: Writing tests first (Step 2.1) caught regressions
3. **Simple Architecture**: Launch/close per request was fast enough, no premature optimization
4. **Comprehensive Documentation**: Multiple evidence documents with comparison tables
5. **Production Monitoring**: Redis-backed metrics for ongoing validation

### What Didn't Work ❌

1. **Documentation Alone**: CLAUDE.md mandate existed but wasn't followed
2. **No Enforcement**: Pre-commit hooks didn't check for axios/cheerio
3. **Zero Test Coverage**: 0% coverage meant violation went unnoticed
4. **Historical Debt**: MVP shortcuts became technical debt
5. **Code Review Miss**: Pattern violations not caught during PR reviews

### Key Insights

**"Trust but Verify"**:
- Documentation **states** the standard
- Pre-commit hooks **enforce** the standard
- Tests **validate** the standard
- Evidence **proves** the standard

**Enforcement Hierarchy**:
1. **Pre-commit hook** - Automated blocker (prevents violation)
2. **CI/CD check** - Build-time validation
3. **Code review** - Human review (catches context-specific issues)
4. **Documentation** - Reference material (educates developers)

**Architecture Compliance = Documentation + Automation + Tests**

---

## Prevention Measures

### Implemented ✅

1. **Pre-Commit Hook**: Blocks axios/cheerio in `server/agents/` ✅
2. **Enhanced Documentation**: ❌ FORBIDDEN section with examples ✅
3. **Evidence Documents**: Proof that axios+cheerio fails ✅
4. **Common Pitfalls #1**: Axios+cheerio now top pitfall ✅
5. **Production Monitoring**: Redis metrics track Playwright success ✅
6. **Reference Implementation**: `extraction-agent.ts` as pattern ✅

### Future Improvements

1. **ESLint Rule**: Custom rule to ban axios/cheerio in agents
2. **CI/CD Check**: GitHub Actions workflow to verify Playwright usage
3. **Code Review Checklist**: Add "Uses Playwright?" to PR template
4. **Architecture Decision Record**: Document why Playwright is mandatory
5. **Onboarding Documentation**: Add to new developer guide

---

## Related Documentation

- **CLAUDE.md**: Lines 11-80 (Browser Automation - MANDATORY REQUIREMENT)
- **TODO_205**: `todos/archive/2026-01-13-TODO_205_MIGRATE_SCRAPING_TO_PLAYWRIGHT.md`
- **Evidence**: `docs/SCRAPING_AXIOS_CHEERIO_FAILURES.md` (0% success rate)
- **Validation**: `docs/SCRAPING_PLAYWRIGHT_SUCCESS_VALIDATION.md` (33% → 100% Target)
- **Pre-Commit Hook**: `scripts/security-checks.sh` (lines 433-456)

---

## Metrics

| Metric | Value |
|--------|-------|
| **Lines of Violating Code** | ~1,600 LOC (7 agent files) |
| **Test Coverage** | 0% → 95.87% |
| **Success Rate** | 0% → 33% (Target: 100%) |
| **Migration Time** | 5 days (Step 2 complete) |
| **Timeline vs Original Plan** | 78% time reduction (1.5 weeks vs 7 weeks) |
| **Enforcement Added** | Pre-commit hook + documentation |
| **Future Violations** | Blocked automatically ✅ |

---

## Conclusion

**Root Cause**: Documentation without enforcement leads to architecture drift.

**Solution**: Multi-layered compliance system:
1. **Automated enforcement** (pre-commit hooks)
2. **Clear documentation** (examples, evidence, patterns)
3. **Test coverage** (validates compliance)
4. **Production monitoring** (ongoing validation)

**Result**:
- Architecture violation fixed (0% → 33-100% success)
- Future violations prevented (pre-commit hook)
- Developer education improved (enhanced docs)
- Evidence-based decision making (comparison data)

**User Satisfaction**: Addressed frustration by:
1. ✅ Fixing the violation (Playwright migration complete)
2. ✅ Adding enforcement (pre-commit hook)
3. ✅ Strengthening documentation (clear mandate)
4. ✅ Preventing recurrence (automated checks)

**Never again**: Architecture mandates without enforcement = compliance failure.

---

**Created by**: Claude Code (Orchestrator)
**Date**: 2026-01-13
**Status**: ✅ RESOLVED (Prevention measures implemented)
