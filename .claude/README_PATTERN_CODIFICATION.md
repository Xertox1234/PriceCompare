# Pattern Codification Integration

> **Transform code reviews into permanent organizational knowledge**

## Quick Start

### Option 1: Manual Mode (Recommended)

After code reviews, manually run pattern codification when you identify learnings:

```bash
# Quick codification
claude task pattern-codifier "Codify patterns from this review session"

# OR use convenience alias (source .claude/pattern-codifier-aliases.sh first)
codify
```

### Option 2: Automatic Mode (Advanced)

Enable automatic pattern codification after every code review:

```bash
# Load aliases
source .claude/pattern-codifier-aliases.sh

# Enable automatic mode
enable-auto-codify

# Check status
codify-status
```

## How It Works

### Two-Stage Hook System

1. **Pre-Commit Hook** (`.claude/hooks.json`)
   - Runs `code-review-specialist` when you commit
   - Reviews staged changes for issues
   - **Recommends** running `pattern-codifier` if significant patterns found
   - You address review feedback

2. **Pattern Codification** (Manual or Automatic)
   - **Manual**: Run `codify` command when ready
   - **Automatic**: Enable `post-code-review` hook to run after every review
   - Extracts patterns and adds to `docs/*_PATTERNS.md`
   - You commit updated pattern files

### Workflow Example

```bash
# 1. Make changes
vim server/routes/product-routes.ts

# 2. Stage changes
git add server/routes/product-routes.ts

# 3. Commit (triggers code-review-specialist)
git commit -m "feat: add product filtering"

# Code review runs automatically via pre-commit hook
# Review identifies: CSRF missing, N+1 query pattern

# 4. Fix issues based on review
vim server/routes/product-routes.ts
git add server/routes/product-routes.ts

# 5. Run pattern codification (if review identified significant patterns)
claude task pattern-codifier "Codify CSRF and N+1 patterns from this review to SECURITY_PATTERNS.md and DATABASE_PATTERNS.md"

# 6. Commit everything together
git add docs/04_SECURITY_PATTERNS.md docs/02_DATABASE_PATTERNS.md
git commit -m "feat: add product filtering with CSRF protection

- Implemented product filter with Zod validation
- Added CSRF protection per security patterns
- Optimized query to prevent N+1
- Codified CSRF and N+1 patterns from review"
```

## Convenience Aliases

Source `.claude/pattern-codifier-aliases.sh` to get quick commands:

```bash
source .claude/pattern-codifier-aliases.sh
```

### Available Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `codify` | Quick codification from current session | `codify` |
| `codify-security` | Codify security patterns | `codify-security` |
| `codify-database` | Codify database patterns | `codify-database` |
| `codify-api` | Codify API patterns | `codify-api` |
| `codify-typescript` | Codify TypeScript patterns | `codify-typescript` |
| `codify-testing` | Codify testing patterns | `codify-testing` |
| `codify-recent` | Codify from last 7 days | `codify-recent` |
| `codify-pr <NUMBER>` | Codify from specific PR | `codify-pr 123` |
| `codify-update <FILE> <desc>` | Update existing pattern | `codify-update DATABASE_PATTERNS 'Add example'` |
| `enable-auto-codify` | Enable automatic codification | `enable-auto-codify` |
| `disable-auto-codify` | Disable automatic codification | `disable-auto-codify` |
| `codify-status` | Show codification status | `codify-status` |

## When to Run Pattern Codification

### ✅ Run After These Events:

1. **Security fixes** (ALWAYS) - Password exposure, CSRF missing, SQL injection
2. **Performance optimizations** - N+1 queries fixed, caching added, batch operations
3. **Pre-commit hook blocks** - Hook blocked commit, you fixed the issue
4. **Recurring feedback** - Same issue mentioned in 2+ reviews
5. **Architectural decisions** - New pattern introduced, design choice made

### ⏭️ Skip For These:

- Trivial typo fixes
- Dependency version bumps
- One-off edge cases
- Style changes (Prettier handles it)

## Hook Configuration

### Current Setup (`.claude/hooks.json`)

```json
{
  "pre-commit": {
    "agent": "code-review-specialist",
    "prompt": "Review staged changes and recommend pattern-codifier if significant learnings identified"
  },
  "post-code-review": {
    "enabled": false,  // Manual mode by default
    "agent": "pattern-codifier",
    "prompt": "Extract patterns from recent code review session"
  }
}
```

### Enable Automatic Mode

**Option 1: Use alias (recommended)**

```bash
source .claude/pattern-codifier-aliases.sh
enable-auto-codify
```

**Option 2: Manual edit**

Edit `.claude/hooks.json` and set `"enabled": true`:

```json
{
  "post-code-review": {
    "enabled": true  // Changed from false
  }
}
```

### Disable Automatic Mode

```bash
disable-auto-codify
```

## Pattern File Structure

Patterns are automatically categorized into domain-specific files:

| Domain | File | Common Patterns |
|--------|------|----------------|
| TypeScript | `docs/01_TYPESCRIPT_PATTERNS.md` | Type safety, async/await, floating promises |
| Database | `docs/02_DATABASE_PATTERNS.md` | N+1 prevention, transactions, query optimization |
| API | `docs/03_API_PATTERNS.md` | Route handlers, middleware, request validation |
| Security | `docs/04_SECURITY_PATTERNS.md` | Auth, CSRF, password handling, input sanitization |
| Frontend | `docs/05_FRONTEND_PATTERNS.md` | React components, state management, forms |
| Error Handling | `docs/06_ERROR_HANDLING_PATTERNS.md` | Error responses, sanitization, recovery |
| Background Jobs | `docs/07_BACKGROUND_JOBS_PATTERNS.md` | Bull queues, cron jobs, distributed locking |
| Testing | `docs/08_TESTING_PATTERNS.md` | Vitest, integration tests, test data |

## Integration with CLAUDE.md

Pattern codification is now documented in `CLAUDE.md` under:

- **Pattern Documentation (CRITICAL)** - References to pattern files and codification guide
- **Code Review Workflow** - Step-by-step integration with code reviews

All Claude Code sessions will be aware of pattern codification as a standard practice.

## Troubleshooting

### "Pattern Already Exists"

The agent found a similar pattern. Update instead of creating new:

```bash
codify-update DATABASE_PATTERNS "Add SERIALIZABLE isolation example to Transaction Boundaries pattern"
```

### Hooks Not Working

Verify hooks.json syntax:

```bash
cat .claude/hooks.json | jq .
```

If errors, check JSON formatting (commas, quotes, braces).

### Want to See Pattern Codifier Behavior

The agent is defined in `.claude/agents/pattern-codifier.md`. You can:

- Read the full workflow documentation in the agent definition
- Modify the agent's behavior by editing the markdown file
- See pattern quality standards and formatting requirements

## Resources

- **Agent Definition**: `.claude/agents/pattern-codifier.md` - Full agent workflow
- **Comprehensive Guide**: `docs/PATTERN_CODIFICATION_GUIDE.md` - Complete documentation
- **Quick Reference**: `.claude/PATTERN_CODIFIER_QUICKREF.md` - Cheat sheet
- **Integration Guide**: `.claude/PATTERN_CODIFIER_INTEGRATION.md` - Workflow integration
- **CLAUDE.md**: Main project instructions with pattern codification workflow

## Examples

### Example 1: Security Pattern from Review

```bash
# Code review identified password hash exposure
git commit -m "feat: add user profile endpoint"
# Pre-commit hook: ❌ Potential passwordHash exposure detected

# Fix the issue
vim server/routes/user-routes.ts

# Codify the learning
codify-security

# Result: Pattern added to SECURITY_PATTERNS.md with:
# - Before/after code examples
# - Security rationale (attack vectors)
# - Pre-commit hook integration note
# - Cross-references to API patterns
```

### Example 2: Performance Pattern from Session

```bash
# During development, fixed N+1 queries
claude "Help me optimize the price history endpoint"
# ... Claude helps refactor loop queries to JOIN ...

# Immediately codify while context is fresh
codify-database

# Result: Pattern added to DATABASE_PATTERNS.md with:
# - Before: loop with queries (101 queries)
# - After: JOIN (1 query)
# - Performance rationale (100x improvement)
# - Related patterns (transactions, array_agg)
```

### Example 3: Multiple PRs Synthesis

```bash
# After noticing CSRF issues in multiple PRs
codify-pr 145
codify-pr 152
codify-pr 156

# OR synthesize all at once
claude task pattern-codifier "Analyze PRs #145, #152, and #156 and create comprehensive CSRF pattern covering all common mistakes"

# Result: Comprehensive pattern with:
# - When CSRF is required
# - Middleware ordering
# - Auth endpoint requirements
# - Common mistakes from all 3 PRs
# - Cross-references to API and security docs
```

## Metrics to Track

Monitor pattern codification effectiveness:

1. **Pattern Reuse**: How often patterns referenced in reviews
2. **Pre-commit Blocks**: Should decrease over time
3. **Onboarding Time**: New devs find answers faster
4. **Review Comments**: Fewer repeated comments

Example tracking:

```markdown
| Pattern | Added | References | Blocks Prevented |
|---------|-------|------------|------------------|
| N+1 Prevention | 2025-11-15 | 8 | 12 |
| CSRF Protection | 2025-11-20 | 15 | 0 |
| Transaction Boundaries | 2025-11-22 | 6 | 5 |
```

## Best Practices

1. **Codify while context is fresh** - Don't wait days after review
2. **Use real code from codebase** - Not generic examples
3. **Prioritize security patterns** - Always highest priority
4. **Cross-reference liberally** - Help pattern discovery
5. **Include attribution** - PR numbers, dates, commits
6. **Update timestamps** - "Last updated" in pattern files
7. **Quality over quantity** - One good pattern > five rushed ones

---

**Remember**: Patterns only compound if they're used. Make codification part of your regular workflow!
