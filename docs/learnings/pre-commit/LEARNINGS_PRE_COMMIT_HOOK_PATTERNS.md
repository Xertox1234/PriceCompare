# Pre-Commit Hook Patterns and Solutions

**Created:** 2025-12-03
**Context:** Learned while committing batch insert optimization (TODO #010)
**Related:** `.git/hooks/pre-commit`, `docs/04_SECURITY_PATTERNS.md`

## Overview

The pre-commit hook enforces code quality and security standards by scanning staged changes for common anti-patterns. This document codifies how to work **with** the hook rather than fighting it.

## Security Comment Patterns

### Pattern: Inline Security Markers

The hook detects security-sensitive code (like `passwordHash`) but **only recognizes exceptions when the marker is on the same line**.

#### ❌ WRONG - Separate Line Comment (Blocked by Hook)

```typescript
// SECURITY: passwordHash in test data only, never exposed in queries
await db.insert(users).values({
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hash',  // ❌ Hook triggers - no marker on this line
  role: 'user',
});
```

**Why it fails:** The hook uses `grep -E "^\+" | grep -i "passwordHash" | grep -v "SECURITY:"` which checks each added line independently. The comment on line N doesn't protect line N+3.

#### ✅ CORRECT - Inline Comment (Passes Hook)

```typescript
await db.insert(users).values({
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hash', // SECURITY: Test data only, never exposed in queries
  role: 'user',
});
```

**Why it works:** The `SECURITY:` marker appears on the same line as `passwordHash`, so `grep -v "SECURITY:"` filters it out.

### Pattern: Multiple Security Markers

The hook recognizes these markers (case-insensitive):

1. **`SECURITY:`** - General security marker
2. **`NEVER`** - Absolute prohibition marker (e.g., "// NEVER expose passwordHash")
3. **`//`** - Comment indicator (filters out documentation)

**Hook Detection Logic:**
```bash
# From .git/hooks/pre-commit line 214
if echo "$CODE_DIFF_OUTPUT" | grep -E "^\+" | grep -i "passwordHash" | grep -v "NEVER" | grep -v "SECURITY:" | grep -v "//" >/dev/null 2>&1; then
  # Trigger blocker
fi
```

#### Example: All Valid Marker Styles

```typescript
// Test fixture setup
const testUser = {
  email: 'test@example.com',
  passwordHash: 'hash123', // SECURITY: Test fixture only
};

// Never expose in production queries
const sensitiveFields = {
  passwordHash: users.passwordHash, // NEVER expose - documentation example only
};

/**
 * User schema
 * @property {string} passwordHash - SECURITY: Hashed password, never exposed in API responses
 */
```

## Common Pre-Commit Hook Failures

### 1. Unused Variables (ESLint)

#### ❌ WRONG - Variable Declared but Never Used

```typescript
describe('Test Suite', () => {
  let testUser: typeof users.$inferSelect;  // ❌ Declared but never referenced
  let testRetailer: typeof retailers.$inferSelect;

  beforeEach(async () => {
    [testUser] = await db.insert(users).values({...}).returning();
    [testRetailer] = await db.insert(retailers).values({...}).returning();
  });

  it('should test something', async () => {
    // Only uses testRetailer, not testUser
    expect(testRetailer.name).toBe('Test Retailer');
  });
});
```

**Error:**
```
41:7  error  'testUser' is assigned a value but never used.
             Allowed unused vars must match /^_/u
             @typescript-eslint/no-unused-vars
```

#### ✅ CORRECT - Solution 1: Remove Unused Variable

```typescript
describe('Test Suite', () => {
  let testRetailer: typeof retailers.$inferSelect;

  beforeEach(async () => {
    // Create user but don't store reference (not needed)
    await db.insert(users).values({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hash', // SECURITY: Test data only
      role: 'user',
    });

    [testRetailer] = await db.insert(retailers).values({...}).returning();
  });
});
```

#### ✅ CORRECT - Solution 2: Prefix with Underscore (Intentionally Unused)

```typescript
describe('Test Suite', () => {
  let _testUser: typeof users.$inferSelect;  // Prefix signals "intentionally unused"
  let testRetailer: typeof retailers.$inferSelect;

  beforeEach(async () => {
    // Stored for potential future use or debugging
    [_testUser] = await db.insert(users).values({...}).returning();
    [testRetailer] = await db.insert(retailers).values({...}).returning();
  });
});
```

**ESLint Rule:** `@typescript-eslint/no-unused-vars` with pattern `/^_/u` - variables starting with `_` are allowed to be unused.

### 2. passwordHash in Test Fixtures

**Context:** Test files need to create user records with password hashes for authentication testing.

#### ❌ WRONG - No Security Marker

```typescript
beforeEach(async () => {
  await db.insert(users).values({
    email: 'test@example.com',
    passwordHash: 'test_hash',  // ❌ Hook blocks this
  });
});
```

#### ✅ CORRECT - Inline Security Marker

```typescript
beforeEach(async () => {
  await db.insert(users).values({
    email: 'test@example.com',
    passwordHash: 'test_hash', // SECURITY: Test fixture only, never exposed
  });
});
```

#### ✅ ALSO CORRECT - Proper Test Pattern

```typescript
beforeEach(async () => {
  // Create test user for authentication tests
  [testUser] = await db.insert(users).values({
    email: 'test@example.com',
    // SECURITY: passwordHash only for test fixtures, production queries use explicit field selection
    passwordHash: await bcrypt.hash('testpass', 10),
  }).returning({
    id: users.id,
    email: users.email,
    role: users.role,
    // Note: passwordHash intentionally excluded from return
  });
});
```

## Pre-Commit Hook Warning vs Blocker Classification

### BLOCKERS (Commit Fails)

These violations **prevent commits**:

1. ❌ TypeScript errors
2. ❌ ESLint errors (unused vars, `any` types, unsafe operations)
3. ❌ `passwordHash` exposure (without security marker)
4. ❌ `console.log` in production code (use `logger` instead)
5. ❌ N+1 query patterns (queries inside loops)
6. ❌ Foreign keys without cascade rules
7. ❌ Hardcoded secrets/API keys
8. ❌ SQL injection vulnerabilities

### WARNINGS (Commit Allowed)

These violations **allow commits with warnings**:

1. ⚠️ Multiple DB operations without transactions
2. ⚠️ Missing CSRF protection on mutating routes
3. ⚠️ Direct `db` imports in routes (should use storage layer)
4. ⚠️ Hardcoded hex colors (should use design tokens)
5. ⚠️ Legacy error handling patterns
6. ⚠️ Missing input validation
7. ⚠️ Missing authentication checks
8. ⚠️ Background jobs without rate limiting
9. ⚠️ Unoptimized queries (N+1 warning)
10. ⚠️ Floating promises (async operations not awaited)
11. ⚠️ **Local timezone date methods in server code** (NEW - 2025-12-09)
    - Detects `new Date(year, month, day)` without `Date.UTC()`
    - Detects local getters/setters (`.getDate()`, `.setDate()`) without UTC prefix
    - See: `docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md`

**Philosophy:** Blockers are **correctness and security issues** that must be fixed immediately. Warnings are **quality and architecture issues** that should be addressed but don't break functionality.

## Pattern 7: UTC Timezone Detection (NEW - 2025-12-09)

Pattern 7 deserves special attention as it demonstrates the **proactive prevention pattern** - automating detection of issues that previously caused production bugs.

### What It Detects

| Detection Category | Pattern | Example |
|-------------------|---------|---------|
| Local Date Constructor | `new Date(year, month, day)` | `new Date(2024, 0, 1)` |
| Local Getters | `.getFullYear()`, `.getMonth()`, `.getDate()` | `date.getMonth()` |
| Local Setters | `.setDate()`, `.setHours()`, `.setMinutes()` | `date.setDate(1)` |

### Why It Matters

Server-side code using local timezone methods causes:
- Tests that pass in one timezone but fail in another (e.g., PST vs UTC)
- Date boundary mismatches in aggregation logic
- Inconsistent behavior across deployment environments

### The Fix

```typescript
// BEFORE - Local timezone (WRONG)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);

// AFTER - UTC (CORRECT)
const yesterday = new Date();
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
yesterday.setUTCHours(0, 0, 0, 0);
```

### Bypass Mechanism

Add `// UTC:` comment for intentional local timezone usage:

```typescript
// UTC: Intentional local timezone for user display formatting
const displayDate = new Date(year, month, day);
```

### The Reactive-to-Proactive Pattern

Pattern 7 completes a feedback loop:

```
Bug Discovery --> Fix --> Documentation --> Automated Detection
     |             |            |                    |
  TODO 179   Service UTC   LEARNINGS_179.md    Pattern 7
              methods                          pre-commit
```

This pattern should be followed for all significant bugs:
1. **Fix the bug** in code
2. **Document learnings** for humans
3. **Automate detection** to prevent recurrence
4. **Update docs** to reference automation

**Reference:** `docs/LEARNINGS_PATTERN7_UTC_TIMEZONE_HOOK_CODIFICATION.md`

## Working with the Hook

### Strategy 1: Address Issues During Development

The best approach is to follow patterns that pass the hook **before committing**:

1. **Type Safety:** Use proper TypeScript types, never `any`
2. **Logging:** Use `logger` from `utils/logger.ts`, not `console.log`
3. **Security Markers:** Add inline `SECURITY:` comments to sensitive code
4. **Clean Variables:** Remove unused variables or prefix with `_`
5. **Transaction Boundaries:** Wrap multi-step operations in `db.transaction()`

### Strategy 2: Use Hook Output as Learning Tool

When the hook blocks a commit, treat it as a **code review from an automated reviewer**:

```bash
# Example hook output with actionable guidance
✗ BLOCKER 1: Potential passwordHash exposure detected
  RISK: Exposing password hashes can lead to credential theft
  FIX: Use explicit field selection and exclude passwordHash
  EXAMPLE: db.select({ id: users.id, email: users.email })
```

**Hook provides:**
- **RISK:** Why this matters (security, correctness, performance)
- **FIX:** Specific action to take
- **EXAMPLE:** Code pattern to follow
- **DOCS:** Link to comprehensive documentation

### Strategy 3: Iterative Fix-and-Retry

The hook runs on **staged changes only**, so you can fix issues incrementally:

```bash
# 1. See what failed
git commit -m "message"
# Hook output shows specific issues

# 2. Fix the issues in your editor
# (e.g., add SECURITY comment, remove unused variable)

# 3. Stage the fixes
git add path/to/fixed-file.ts

# 4. Retry commit
git commit -m "message"
# Repeat until all issues resolved
```

## Hook Bypass (Emergency Only)

### When NOT to Bypass

- ❌ "I'll fix it later" - Fix it now, future you will forget
- ❌ "It's just a test file" - Test files must have same quality standards
- ❌ "The hook is wrong" - The hook enforces documented patterns
- ❌ "I'm in a hurry" - Quality issues slow down the entire team

### When Bypass is Acceptable

- ✅ **False positive:** Hook incorrectly flags valid code (rare)
- ✅ **Emergency hotfix:** Production down, will fix in follow-up PR
- ✅ **Hook bug:** Confirmed bug in hook logic (report to maintainers)
- ✅ **Documented exception:** Explicitly approved deviation from standards

### How to Bypass (Not Recommended)

```bash
# Skip pre-commit hook (NOT RECOMMENDED)
git commit --no-verify -m "message"
```

**Consequences:**
- Code review may reject the PR
- CI/CD may fail with same issues
- Technical debt accumulates
- Security vulnerabilities may be introduced

## Testing Pre-Commit Hook Patterns

### Quick Verification

Before committing, you can manually verify your code passes hook checks:

```bash
# Check TypeScript errors
npm run check

# Check ESLint errors
npm run lint

# Check for common patterns
git diff --staged | grep -i "passwordHash" | grep -v "SECURITY:"
git diff --staged | grep -E "^\+" | grep -i "console.log"
```

### Continuous Integration Alignment

The pre-commit hook mirrors CI/CD checks:

1. **Local (pre-commit):** Fast feedback, blocks bad commits
2. **CI (GitHub Actions):** Comprehensive checks, blocks PR merges
3. **Both enforce same standards** - no surprises in CI

## Common Questions

### Q: Why does the hook check every commit?

**A:** Early detection prevents technical debt. Fixing issues at commit time takes seconds; fixing them after PR review takes hours.

### Q: Why are test files held to the same standards?

**A:** Test code is production code. Bugs in tests hide real bugs. Security issues in tests can leak into production patterns.

### Q: Can I configure the hook to be less strict?

**A:** The hook enforces **project-wide standards** documented in `.claude/rules.md` and `CLAUDE.md`. Relaxing standards degrades code quality for everyone. Instead, follow the documented patterns.

### Q: What if I disagree with a hook rule?

**A:** Open a discussion with the team. If a rule doesn't make sense:
1. Document the use case
2. Propose pattern change
3. Update documentation + hook together
4. Never bypass without team consensus

## Related Documentation

- `.git/hooks/pre-commit` - Hook implementation
- `docs/04_SECURITY_PATTERNS.md` - Security standards enforced by hook
- `docs/01_TYPESCRIPT_PATTERNS.md` - Type safety patterns
- `docs/02_DATABASE_PATTERNS.md` - Database patterns (transactions, N+1)
- `.claude/rules.md` - Complete development standards
- `CLAUDE.md` - Project conventions

## Real-World Example: TODO #010 Commit

**Scenario:** Committing batch insert optimization with test suite.

**Initial Attempt:**
```bash
git commit -m "feat: implement batch insert"
# ❌ Hook blocked:
#   - 'testUser' variable unused (ESLint)
#   - passwordHash without security marker
```

**Fix 1 - Remove Unused Variable:**
```typescript
// Before (blocked)
let testUser: typeof users.$inferSelect;
[testUser] = await db.insert(users).values({...}).returning();

// After (passes)
await db.insert(users).values({...}); // Don't store if unused
```

**Fix 2 - Add Security Marker:**
```typescript
// Before (blocked)
passwordHash: 'hash',

// After (passes)
passwordHash: 'hash', // SECURITY: Test data only, never exposed in queries
```

**Result:** Commit succeeded, changes pushed to remote.

**Time Investment:**
- Initial commit attempt: Failed (~1 min)
- Understanding hook output: ~2 min
- Fixing issues: ~2 min
- Retry commit: Success (~1 min)
- **Total: ~6 minutes** vs hours debugging in production

## Key Takeaways

1. **Inline security markers** - `SECURITY:` must be on same line as sensitive code
2. **Remove unused variables** - Don't declare if you don't use, or prefix with `_`
3. **Hook output is helpful** - Read the guidance, it shows exact fixes
4. **Test files = production files** - Same quality standards apply
5. **Never bypass casually** - Bypassing creates technical debt for the team
6. **Fix during development** - Following patterns avoids hook failures entirely

---

**Maintenance Note:** This document should be updated when:
- New hook rules are added
- Common failure patterns emerge
- False positive patterns are identified
- Hook bypass policies change
