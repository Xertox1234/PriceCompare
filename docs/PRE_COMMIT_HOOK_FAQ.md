# Pre-Commit Hook FAQ

**Version:** 3.1
**Last Updated:** 2025-12-04
**Hook Location:** `.git/hooks/pre-commit`

---

## Quick Links

- [Common Issues](#common-issues)
- [Exemption Patterns](#exemption-patterns)
- [How to Bypass](#how-to-bypass-not-recommended)
- [False Positives](#false-positives)
- [Performance Issues](#performance-issues)
- [Pattern Documentation](#pattern-documentation)

---

## Common Issues

### Q: My commit was blocked with "BLOCKER 11: Missing CSRF protection". What do I do?

**Answer:** You added a POST/PUT/PATCH/DELETE route without CSRF protection.

**Fix:**
```typescript
// ❌ WRONG - Will be blocked
router.post('/api/users', async (req, res) => {
  // ...
});

// ✅ CORRECT - Add csrfProtection middleware
import { csrfProtection } from '../middleware/security';

router.post('/api/users', csrfProtection, async (req, res) => {
  // ...
});
```

**If this is a legitimate exemption** (webhook, public API, etc.):
```typescript
// CSRF exempt: Public webhook with signature verification
router.post('/api/webhook', async (req, res) => {
  // ...
});
```

---

### Q: I'm getting "BLOCKER 4: N+1 query pattern detected". How do I fix it?

**Answer:** You have a database query inside a loop.

**Fix Options:**

**Option 1: Use JOINs**
```typescript
// ❌ WRONG - N+1 pattern
for (const product of products) {
  const offers = await db.select()
    .from(productOffers)
    .where(eq(productOffers.productId, product.id));
}

// ✅ CORRECT - Single query with JOIN
const productsWithOffers = await db
  .select({
    product: products,
    offer: productOffers,
  })
  .from(products)
  .leftJoin(productOffers, eq(products.id, productOffers.productId));
```

**Option 2: Use inArray() for batch query**
```typescript
// ✅ CORRECT - Batch fetch
const productIds = products.map(p => p.id);
const allOffers = await db.select()
  .from(productOffers)
  .where(inArray(productOffers.productId, productIds));
```

**If this is intentional** (rate-limited API calls, etc.):
```typescript
// N+1 safe: Rate-limited external API calls, must be sequential
for (const product of products) {
  await externalAPI.updateProduct(product);
}
```

---

### Q: I get "WARNING 13: Hardcoded bcrypt rounds". What's wrong?

**Answer:** You're using a hardcoded number for bcrypt rounds instead of the centralized constant.

**Fix:**
```typescript
// ❌ WRONG
await bcrypt.hash(password, 10);
await bcrypt.hash(password, 12);

// ✅ CORRECT
import { PASSWORD } from './utils/constants';
await bcrypt.hash(password, PASSWORD.BCRYPT_ROUNDS);
```

**Why this matters:** Security parameters should be centralized so they can be updated globally when security recommendations change.

---

### Q: The hook says "console.log in production code". I need it for debugging!

**Answer:** Use the structured logger instead.

**Fix:**
```typescript
// ❌ WRONG - Will be blocked
console.log('User created:', user);

// ✅ CORRECT - Use structured logger
import { createLogger } from './utils/logger';
const log = createLogger('UserService');

log.info('User created', { userId: user.id, username: user.username });
```

**Why this matters:**
- `console.log` can leak sensitive data in production
- Structured logs are queryable and filterable
- Logs include timestamps, context, and severity

**For quick debugging** (remove before committing):
```typescript
// DEBUG: Investigating user creation flow - REMOVE BEFORE COMMIT
console.log('Debug data:', data);
```

---

### Q: I'm getting "WARNING 11: Check-then-act without SERIALIZABLE isolation". Should I fix it?

**Answer:** Maybe. This warning catches potential race conditions in concurrent operations.

**When to use SERIALIZABLE:**
- Counter increments (post numbers, order IDs)
- First-user checks (making first user admin)
- Daily limit enforcement (notification limits)
- Any "check count then insert" pattern

**Example:**
```typescript
// ⚠️ WARNING - Race condition possible
await db.transaction(async (tx) => {
  const userCount = await tx.select({ count: sql`count(*)` }).from(users);
  const isFirstUser = parseInt(userCount[0].count as string) === 0;

  // Between these lines, another transaction could create a user!
  await tx.insert(users).values({
    role: isFirstUser ? 'admin' : 'user'
  });
});

// ✅ FIXED - SERIALIZABLE prevents concurrent execution
await db.transaction(async (tx) => {
  const userCount = await tx.select({ count: sql`count(*)` }).from(users);
  const isFirstUser = parseInt(userCount[0].count as string) === 0;

  await tx.insert(users).values({
    role: isFirstUser ? 'admin' : 'user'
  });
}, {
  isolationLevel: 'serializable'  // Prevents race condition
});
```

**When NOT to use SERIALIZABLE:**
- Simple CRUD operations
- Operations already locked by primary key
- No conditional logic based on reads

**Performance note:** SERIALIZABLE has higher overhead, use only when needed.

---

## Exemption Patterns

### CSRF Exemption

```typescript
// CSRF exempt: <detailed reason>
router.post('/api/endpoint', handler);
```

**Valid reasons:**
- Public webhook with signature verification
- OAuth callback endpoint (external service)
- Health check endpoint (no state mutation)
- Analytics tracking (no user data)

**Invalid reasons:**
- "It's annoying" (not acceptable)
- "I'll add it later" (add it now)
- "It's internal only" (still needs CSRF)

---

### N+1 Query Exemption

```typescript
// N+1 safe: <detailed reason>
for (const item of items) {
  await processOne(item);
}
```

**Valid reasons:**
- Rate-limited external API calls (must be sequential)
- Intentional batch processing with checkpoints
- Redis distributed lock per item (can't batch)

**Invalid reasons:**
- "The array is small" (use batch anyway, it's future-proof)
- "Performance isn't critical here" (it will be eventually)

---

### Password Hash Exposure Exemption

```typescript
// SECURITY: Test data only, passwordHash is fake
const testUser = await db.select({
  id: users.id,
  passwordHash: users.passwordHash,  // Only in tests!
}).from(users).where(eq(users.id, testUserId));
```

**Valid only in:**
- Test files (`*.test.ts`, `__tests__/`)
- Test fixture creation
- Password verification functions (auth.ts)

**Never in:**
- API routes
- Frontend queries
- User-facing endpoints

---

## How to Bypass (NOT RECOMMENDED)

### Bypass the Hook Entirely

```bash
git commit --no-verify -m "message"
```

**⚠️ WARNING:** This bypasses ALL checks, including:
- TypeScript errors
- ESLint errors
- Security checks
- CSRF protection checks

**When to use:**
- Emergency hotfix (fix the issues in next commit!)
- Hook is malfunctioning (report to team)
- **NEVER for convenience** - fix the issues instead

---

### Temporary Bypass for Specific Check

If a specific check is giving false positives, use exemption comments (see [Exemption Patterns](#exemption-patterns)) rather than bypassing the entire hook.

---

## False Positives

### False Positive: "N+1 query" but it's actually fine

**Scenario:** You're using a transaction context and the query is legitimately needed in a loop.

**Solution:**
```typescript
// N+1 safe: Transaction-scoped lock acquisition per user
for (const userId of userIds) {
  await tx.update(users)
    .set({ locked: true })
    .where(eq(users.id, userId));
}
```

---

### False Positive: "Missing CSRF" on a GET endpoint

**Scenario:** Hook is incorrectly flagging a GET request.

**Diagnosis:** Check that your route actually uses `.get()` not `.post()`. The hook only checks mutations.

**If it's legitimately wrong:**
1. Report the issue (https://github.com/anthropics/claude-code/issues)
2. Use `--no-verify` temporarily
3. Add exemption comment if appropriate

---

### False Positive: "Hardcoded password length" in a comment

**Scenario:**
```typescript
// Password must be at least 8 characters  ← Flagged incorrectly
const schema = z.string().min(PASSWORD.MIN_LENGTH);
```

**Solution:** The pattern is looking for `.min(8)` OR `.min(12)` with "password" on the same line. This is a known limitation.

**Workaround:**
```typescript
// Minimum length requirement: PASSWORD.MIN_LENGTH
const schema = z.string().min(PASSWORD.MIN_LENGTH);
```

Or just ignore the warning (it's not a blocker).

---

## Performance Issues

### Q: The hook is taking 10+ seconds. Is this normal?

**Answer:** No. The hook should complete in <5 seconds typically.

**Diagnosis:**

1. **Check if you have many staged files:**
```bash
git diff --cached --name-only | wc -l
```
If >100 files, that's the issue.

2. **Check if WARNING 11 (SERIALIZABLE check) is slow:**
WARNING 11 scans the entire `server/` directory, which can be slow on large codebases.

**Workarounds:**
- Stage files in smaller batches
- Skip hook temporarily: `git commit --no-verify`
- Report performance issue to team

**Future improvement:** WARNING 11 should be optimized to only check staged files.

---

### Q: Can I disable specific checks to speed up the hook?

**Answer:** Not recommended, but yes.

**Process:**
1. Open `.git/hooks/pre-commit`
2. Find the check you want to disable
3. Comment it out:
```bash
# WARNING 11: Check-then-act patterns without SERIALIZABLE isolation (Race conditions)
# echo "🔒 Checking for race condition patterns..."
# ... rest of check ...
```

**⚠️ WARNING:** You're disabling security/quality checks. Only do this if absolutely necessary.

---

## Pattern Documentation

### Where can I learn more about these patterns?

**CSRF Protection:**
- `docs/04_SECURITY_PATTERNS.md#csrf-protection`
- OWASP: https://owasp.org/www-community/attacks/csrf

**N+1 Queries:**
- `docs/02_DATABASE_PATTERNS.md#n1-query-pattern`
- Understanding N+1: https://stackoverflow.com/questions/97197/what-is-the-n1-selects-problem

**Transaction Isolation:**
- `docs/02_DATABASE_PATTERNS.md#serializable-isolation`
- PostgreSQL docs: https://www.postgresql.org/docs/current/transaction-iso.html

**Password Security:**
- `docs/04_SECURITY_PATTERNS.md#password-security`
- OWASP Password Storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

---

## Hook Internals

### Q: How does the hook detect violations?

**Answer:** The hook uses `git diff --cached` to check only the changes you're committing, not the entire codebase.

**Process:**
1. Get list of staged files (`git diff --cached --name-only`)
2. Filter to TypeScript/JavaScript files
3. Run pattern detection on the diff (new lines start with `+`)
4. Exclude test files, exemption comments
5. Report violations

**Key insight:** Only NEW or MODIFIED code triggers checks. Existing code is not checked.

---

### Q: Why do some checks scan the entire server/ directory?

**Answer:** WARNING 11 (SERIALIZABLE check) currently scans all server files because it needs context beyond the staged changes to detect check-then-act patterns.

**Known issue:** This can be slow on large codebases.

**Future improvement:** Optimize to only check staged files or recently modified files.

---

### Q: Can I add my own checks to the hook?

**Answer:** Yes! The hook is a bash script in `.git/hooks/pre-commit`.

**Process:**
1. Read the current hook to understand the structure
2. Add your check in the appropriate section (BLOCKERS or WARNINGS)
3. Follow the existing pattern format
4. Test thoroughly before committing

**Contribution:** If you add a useful check, consider contributing it back to the team!

---

## Troubleshooting

### Q: The hook isn't running at all

**Possible causes:**
1. Hook file isn't executable
2. Hook was disabled
3. You're using `git commit --no-verify`

**Fix:**
```bash
# Check if hook exists and is executable
ls -l .git/hooks/pre-commit

# Make it executable if needed
chmod +x .git/hooks/pre-commit

# Verify it works
git commit --dry-run
```

---

### Q: I see "grep: parentheses not balanced" warnings

**Answer:** This is a known cosmetic issue in some grep patterns. It doesn't affect functionality.

**Impact:** None - the checks still work correctly.

**Status:** Non-critical, will be fixed in future version.

---

### Q: Hook crashed with "bash: line X: syntax error"

**Answer:** The hook script has a syntax error. This usually happens after manual editing.

**Fix:**
```bash
# Test the hook script
bash -n .git/hooks/pre-commit

# If error found, compare with the original from the repo
# Or restore from backup
```

**Prevention:** Don't manually edit the hook unless you're familiar with bash scripting.

---

## Getting Help

### Q: Where do I report issues with the hook?

**Options:**
1. **Team chat** - Quick questions and common issues
2. **GitHub Issues** - https://github.com/[your-org]/[your-repo]/issues
3. **Code review** - Tag `@security-team` for CSRF/security questions
4. **Documentation** - Check pattern docs first (linked above)

---

### Q: Can I suggest improvements to the hook?

**Answer:** Yes! The hook is part of the enhancement plan and continuously evolving.

**Process:**
1. Check if the enhancement is in Phase 3-5 of the plan (`docs/planning/PRE_COMMIT_ENHANCEMENT_PLAN.md`)
2. If not, create a GitHub issue with:
   - Pattern you want to enforce
   - Example of what should be caught
   - Documentation link (if pattern is documented)
3. Tag `@code-quality-team` for review

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.1 | 2025-12-04 | Phase 2 complete: SERIALIZABLE, password constants |
| 3.0 | 2025-12-04 | Phase 1 complete: CSRF, enhanced N+1 |
| 2.1 | 2025-12-02 | Added TypeScript check, basic patterns |
| 1.0 | 2025-11-XX | Initial hook |

---

## Quick Reference Card

### Most Common Fixes

```typescript
// CSRF missing → Add csrfProtection
router.post('/api/endpoint', csrfProtection, withAuth(handler));

// N+1 query → Use inArray()
const ids = items.map(i => i.id);
const results = await db.select().where(inArray(table.id, ids));

// Hardcoded bcrypt → Use constant
import { PASSWORD } from './utils/constants';
await bcrypt.hash(pwd, PASSWORD.BCRYPT_ROUNDS);

// console.log → Use logger
import { createLogger } from './utils/logger';
const log = createLogger('Module');
log.info('message', { context });
```

### Emergency Bypass

```bash
# Use ONLY in emergencies
git commit --no-verify -m "message"
```

### Check Hook Version

```bash
head -10 .git/hooks/pre-commit | grep Version
```

---

**Still stuck? Ask the team!** 💬
