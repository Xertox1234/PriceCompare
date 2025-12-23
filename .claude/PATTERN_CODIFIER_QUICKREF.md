# Pattern Codifier - Quick Reference

> **TL;DR**: Turn code review feedback into permanent, searchable documentation

## Basic Usage

```bash
# After any code review or development session
claude task pattern-codifier "Codify patterns from this session"

# From specific PR
claude task pattern-codifier "Extract patterns from PR #123"

# Update existing pattern
claude task pattern-codifier "Add example to N+1 prevention pattern in DATABASE_PATTERNS.md"
```

## When to Use

| ✅ Run Codifier | ❌ Skip It |
|----------------|-----------|
| After code review (manual or automated) | Trivial typo fixes |
| Fixed security vulnerability | Dependency version bumps |
| Optimized performance issue | One-off edge cases |
| Refactored anti-pattern | Style changes (Prettier handles it) |
| Introduced new architectural pattern | |

## Pattern File Mapping

| Pattern Type | Target File | Line Count ↓ |
|-------------|-------------|--------------|
| Types, async/await, `any` avoidance | `docs/01_TYPESCRIPT_PATTERNS.md` | ~300 |
| N+1, transactions, queries | `docs/02_DATABASE_PATTERNS.md` | ~400 |
| Routes, middleware, services | `docs/03_API_PATTERNS.md` | ~350 |
| Auth, CSRF, validation | `docs/04_SECURITY_PATTERNS.md` | ~500 |
| React, forms, state | `docs/05_FRONTEND_PATTERNS.md` | ~250 |
| Error responses, sanitization | `docs/06_ERROR_HANDLING_PATTERNS.md` | ~300 |
| Bull queues, cron, locks | `docs/07_BACKGROUND_JOBS_PATTERNS.md` | ~200 |
| Vitest, integration tests | `docs/08_TESTING_PATTERNS.md` | ~350 |

## Pattern Quality Checklist

Every pattern MUST have:

- [ ] **Context**: When does this apply?
- [ ] **Problem**: What breaks without it?
- [ ] **✅ Preferred**: Working code example
- [ ] **❌ Anti-Pattern**: What NOT to do
- [ ] **Rationale**: WHY (with specifics)
- [ ] **Source**: PR #, date, or commit hash
- [ ] **Cross-refs**: Links to related patterns

## Pattern Priority (High → Low)

1. 🔴 **Security vulnerabilities** fixed
2. 🟠 **Performance anti-patterns** corrected
3. 🟡 **Recurring mistakes** (seen 2+ times)
4. 🟢 **Pre-commit hook patterns** (developers hit frequently)
5. 🔵 **Type safety** improvements (`any` → proper types)
6. ⚪ **Architecture** decisions affecting multiple components

## Integration with Code Review

```bash
# Standard workflow
git checkout -b feature/new-endpoint
# ... make changes ...

# 1. Review
claude task code-review-specialist "Review server/routes/product-routes.ts"

# 2. Fix issues
# ... address feedback ...

# 3. Codify (IMPORTANT!)
claude task pattern-codifier "Extract patterns from this review focusing on route security"

# 4. Commit together
git add .
git commit -m "feat: add product filtering endpoint

- Implemented filter validation with Zod
- Added CSRF protection per security patterns
- Codified route security pattern to API_PATTERNS.md"
```

## Common Commands

```bash
# After development session
claude task pattern-codifier "Document the N+1 fixes we made in price-history-routes.ts"

# From recent commits
claude task pattern-codifier "Review last 5 commits and extract any patterns worth documenting"

# Cross-domain pattern
claude task pattern-codifier "Document the caching pattern spanning both backend (BACKGROUND_JOBS) and frontend (FRONTEND) with cross-refs"

# Update existing
claude task pattern-codifier "Add SERIALIZABLE isolation example to Transaction Boundaries pattern"

# From multiple sources
claude task pattern-codifier "Synthesize CSRF patterns from PRs #145, #152, and #156"
```

## Workflow Hooks Integration

### Option 1: Manual Invocation

Run codifier manually when needed (current setup):

```bash
claude task pattern-codifier "Codify patterns from this session"
```

### Option 2: Automated After Reviews

Add to `.claude/hooks.json` to run automatically after code reviews:

```json
{
  "prompt-submit": {
    "enabled": true,
    "command": ".claude/hooks/prompt-submit.sh"
  },
  "post-code-review": {
    "enabled": true,
    "command": ".claude/hooks/post-code-review.sh"
  }
}
```

Create `.claude/hooks/post-code-review.sh`:

```bash
#!/bin/bash
# Automatically run pattern-codifier after code-review-specialist

if grep -q "code-review-specialist" .claude/session_log.txt 2>/dev/null; then
  echo "🔍 Code review completed. Run pattern codifier? (y/n)"
  read -r response
  if [[ "$response" == "y" ]]; then
    claude task pattern-codifier "Extract patterns from the recent code review session"
  fi
fi
```

## Pattern Format Template (Copy-Paste)

```markdown
### [Pattern Name]

**Context:** [When does this apply?]

**Problem:** [What breaks without this?]

**✅ Preferred Approach:**
```typescript
// Working code example with comments
const correct = await goodPattern();
```

**❌ Anti-Pattern (Avoid):**
```typescript
// Bad code showing what NOT to do
const wrong = badPattern();
```

**Rationale:**
- [Why this matters]
- [Benefits of preferred approach]
- [Consequences of anti-pattern]

**Related Patterns:**
- [Cross-reference related patterns]

*Source: [PR #XXX | Session YYYY-MM-DD | Commit hash]*
*Added: YYYY-MM-DD*
```

## Troubleshooting

### "Pattern Already Exists"

The agent found a similar pattern. Options:

```bash
# Add nuance to existing pattern
claude task pattern-codifier "Update the floating promises pattern in TYPESCRIPT to include Express middleware examples"

# Create specialized version
claude task pattern-codifier "Create specialized CSRF pattern for WebSocket connections, distinct from HTTP endpoint pattern"
```

### Pattern Spans Multiple Files

Some patterns affect multiple domains:

```bash
claude task pattern-codifier "This auth pattern touches SECURITY (password hashing), API (route guards), and DATABASE (user queries). Document in all three with cross-references."
```

### Need to Update CLAUDE.md Too

Major patterns should reference CLAUDE.md:

```bash
claude task pattern-codifier "After adding CSRF pattern to SECURITY_PATTERNS, add brief reference to CLAUDE.md 'Security Patterns (MANDATORY)' section"
```

## Metrics to Track

Monitor pattern effectiveness:

- **Reuse Rate**: How often patterns are referenced in reviews
- **Pre-commit Blocks**: Reduced over time as team learns patterns
- **Onboarding Time**: New devs find answers faster
- **Review Comments**: Fewer repeated comments about same issues

Example tracking:

```markdown
| Pattern | Added | References | Blocks Prevented |
|---------|-------|------------|------------------|
| N+1 Prevention | 2025-11-15 | 8 | 12 |
| CSRF Protection | 2025-11-20 | 15 | 0 |
| Transaction Boundaries | 2025-11-22 | 6 | 5 |
```

## Examples

**Security Pattern:**
```bash
claude task pattern-codifier "PR #156 fixed password hash exposure. Document this CRITICAL security pattern."
```

**Performance Pattern:**
```bash
claude task pattern-codifier "We optimized the N+1 queries in price-history-routes.ts. Codify this with before/after examples."
```

**API Pattern:**
```bash
claude task pattern-codifier "The CSRF middleware ordering from today's session should be documented in both API_PATTERNS and SECURITY_PATTERNS."
```

## Quick Tips

1. **Codify while context is fresh** - Don't wait days
2. **Use real code from codebase** - Not generic examples
3. **Prioritize security patterns** - Always highest priority
4. **Cross-reference liberally** - Help discovery
5. **Include attribution** - PR numbers, dates, commits
6. **Update timestamps** - "Last updated" in modified files

## Further Reading

- Full guide: `docs/PATTERN_CODIFICATION_GUIDE.md`
- Agent definition: `.claude/agents/pattern-codifier.md`
- Existing patterns: `docs/0*_PATTERNS.md`
- Project instructions: `CLAUDE.md`

---

**Remember**: Patterns only have value if they're used. Make codification part of your regular workflow!