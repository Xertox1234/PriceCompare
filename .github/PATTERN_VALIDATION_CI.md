# Pattern Validation in CI/CD

> **Automated pattern compliance checking in GitHub Actions**

## Overview

The `pattern-validation.yml` workflow automatically validates code changes against documented patterns in `docs/*_PATTERNS.md` files. This ensures pattern compliance before code is merged.

## Workflow Triggers

**Runs on:** Pull requests to `main`, `develop`, or `add_scraping` branches

**Triggers when:**
- PR is opened, synchronized, or reopened
- TypeScript files changed (`server/**/*.ts`, `client/**/*.tsx`, `shared/**/*.ts`)
- Pattern files modified (`docs/*_PATTERNS.md`)

**Skips when:**
- Only markdown files changed (except pattern files)
- Only documentation changed

## Validation Checks

### Job 1: Pattern Validation

Automated checks for common pattern violations:

#### Check 1: CSRF Protection ⚠️ WARNING
**Pattern:** `docs/04_SECURITY_PATTERNS.md`

Validates that mutating endpoints (POST/PUT/PATCH/DELETE) include `csrfProtection` middleware.

```typescript
// ✅ Correct
app.post('/api/endpoint', csrfProtection, withAuth(async (req, res) => { ... }));

// ❌ Flagged
app.post('/api/endpoint', withAuth(async (req, res) => { ... }));  // Missing csrfProtection
```

#### Check 2: Storage Layer Usage ❌ CRITICAL
**Pattern:** `docs/02_DATABASE_PATTERNS.md`

Ensures routes use the storage layer abstraction instead of direct `db` imports.

```typescript
// ❌ Critical violation
import { db } from '../db';  // Direct db import in route file

// ✅ Correct
import { storage } from '../storage';
```

#### Check 3: API Response Standardization ⚠️ WARNING
**Pattern:** `docs/03_API_PATTERNS.md`

Validates use of `sendSuccess/sendError` helpers instead of manual JSON responses.

```typescript
// ❌ Flagged
res.json({ success: true, data: product });

// ✅ Correct
sendSuccess(res, product);
```

#### Check 4: Type Safety ❌ CRITICAL
**Pattern:** `docs/01_TYPESCRIPT_PATTERNS.md`

Blocks `any` types from being introduced into the codebase.

```typescript
// ❌ Critical violation
const data: any = await fetch(...);
function process(item: any) { ... }

// ✅ Correct
const data: unknown = await fetch(...);
function process<T>(item: T) { ... }
```

#### Check 5: N+1 Query Prevention ❌ CRITICAL
**Pattern:** `docs/02_DATABASE_PATTERNS.md`

Detects potential N+1 query patterns (database queries inside loops).

```typescript
// ❌ Critical violation
for (const product of products) {
  await db.select().from(offers).where(eq(offers.productId, product.id));
}

// ✅ Correct
const allOffers = await db.select().from(offers)
  .where(inArray(offers.productId, productIds));
```

### Job 2: Pattern File Synchronization

Validates that pattern file modifications include proper metadata updates:

- **Version increment** - Version number must be bumped (e.g., 2.1 → 2.2)
- **Timestamp update** - "Last Updated" date must reflect current date

**Purpose:** Tracks pattern evolution and ensures documentation stays current.

## Severity Levels

| Severity | Action | Examples |
|----------|--------|----------|
| **CRITICAL** ❌ | **Blocks PR merge** | `any` types, direct db imports, N+1 queries |
| **WARNING** ⚠️ | **Allows merge** with notification | Missing CSRF, manual response envelopes |

## Workflow Behavior

### On Success (No Critical Issues)

```
✅ No critical pattern violations detected

💡 Note: This is a basic automated check. For comprehensive validation:
   Run: claude task pattern-validator 'Validate changed files'
```

PR can be merged.

### On Failure (Critical Issues Found)

```
❌ Found 2 critical pattern violation(s)

📖 Next Steps:
  1. Review the pattern files referenced above
  2. Fix the critical violations
  3. For comprehensive validation, run:
     claude task pattern-validator 'Validate changed files'
```

**Automatic PR comment posted** with:
- Critical issues found
- Next steps to fix
- Links to pattern files
- Command to run comprehensive validation locally

PR is **blocked** until violations are fixed.

## Limitations of Automated Checks

The CI workflow performs **basic pattern detection** using grep and regex. It can catch common violations but is not as comprehensive as the `pattern-validator` agent.

### What CI Catches

- ✅ Direct `db` imports (exact string match)
- ✅ `any` types (regex pattern)
- ✅ Missing CSRF middleware (route declaration check)
- ✅ Manual response envelopes (regex pattern)
- ✅ Simple N+1 patterns (loop with await)

### What CI Misses

- ❌ Context-aware validation (pattern applicability)
- ❌ Complex N+1 patterns (nested, conditional)
- ❌ Transaction boundary analysis
- ❌ Cross-file pattern violations
- ❌ Rationale and "why" analysis

**For comprehensive validation, use the `pattern-validator` agent locally:**

```bash
claude task pattern-validator "Validate all changed files in this PR"
```

## Local Development Workflow

### Before Creating PR

1. **Make your changes**
   ```bash
   vim server/routes/my-endpoint.ts
   ```

2. **Search for relevant patterns**
   ```bash
   claude task pattern-search "How do I add CSRF protection?"
   ```

3. **Validate against patterns**
   ```bash
   claude task pattern-validator "Validate server/routes/my-endpoint.ts"
   ```

4. **Fix any violations**, then re-validate

5. **Create PR** - CI validation will run automatically

### If CI Fails

1. **Check workflow logs** for specific violations
2. **Review referenced pattern files** in `docs/*_PATTERNS.md`
3. **Run comprehensive validation locally:**
   ```bash
   claude task pattern-validator "Validate changed files"
   ```
4. **Fix violations** following documented patterns
5. **Push changes** - CI will re-run automatically

## Integration with Existing CI

This workflow complements existing CI checks:

| Workflow | Focus | Pattern Validation |
|----------|-------|-------------------|
| `pr-validation.yml` | ESLint, TypeScript, Prettier | ❌ No pattern checks |
| `pattern-validation.yml` | Pattern compliance | ✅ **Pattern-focused** |
| `security-scan.yml` | Security vulnerabilities | ⚠️ Some pattern overlap |
| `e2e-tests.yml` | End-to-end functionality | ❌ No pattern checks |

**Pattern validation runs in parallel** with other CI checks for fast feedback.

## Future Enhancements

### Phase 1: Current (Basic Grep Checks)
- ✅ Direct db imports
- ✅ any types
- ✅ Missing CSRF
- ✅ Manual response envelopes
- ✅ Simple N+1 patterns

### Phase 2: Planned (AST Analysis)
- 🔄 Parse TypeScript AST for accurate detection
- 🔄 Context-aware validation (pattern applicability)
- 🔄 Cross-file analysis (imports, dependencies)
- 🔄 Complexity metrics (cyclomatic complexity)

### Phase 3: Planned (AI Agent Integration)
- 🔄 Run `pattern-validator` agent in CI when Claude Code CLI available
- 🔄 Generate validation reports as PR comments
- 🔄 Auto-suggest fixes based on patterns
- 🔄 Pattern learning from approved PRs

### Phase 4: Planned (Metrics & Insights)
- 🔄 Pattern violation trends over time
- 🔄 Most commonly violated patterns
- 🔄 Pattern compliance score per PR
- 🔄 Developer pattern adherence metrics

## Bypassing Validation (Not Recommended)

**Workflow can be skipped** with admin override, but this is strongly discouraged:

```bash
# Emergency bypass (requires admin approval)
# Use only for hotfixes or documented exceptions
```

**Instead, if you believe a pattern doesn't apply:**
1. Document the exception in code comments
2. Update the pattern file to clarify when it doesn't apply
3. Create an issue to discuss the pattern

## Metrics

Track pattern validation effectiveness:

```markdown
### Pattern Compliance Metrics (Example)

| Metric | Value | Trend |
|--------|-------|-------|
| PRs passing first validation | 85% | ↗️ +5% |
| Critical violations/week | 3 | ↘️ -2 |
| Pattern file updates/month | 8 | ↗️ +3 |
| Average fix time | 15 min | ↘️ -5 min |
```

## Resources

- **Pattern Files:** `docs/01-08_PATTERNS.md`
- **Pattern Agents:** `.claude/agents/pattern-*.md`
- **Local Validation:** `claude task pattern-validator`
- **Pattern Search:** `claude task pattern-search`
- **CI Workflow:** `.github/workflows/pattern-validation.yml`

---

**The pattern validation workflow ensures code quality compounds over time by preventing anti-patterns from reaching production.**
