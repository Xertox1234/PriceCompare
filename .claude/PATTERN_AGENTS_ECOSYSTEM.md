# Pattern Agents Ecosystem

> **A complete system for pattern-driven development**

## Overview

The Pattern Agents Ecosystem transforms your codebase into a self-improving, knowledge-compounding system through three specialized agents that work together:

```
┌─────────────────────────────────────────────────────────────┐
│                   Pattern Lifecycle                          │
│                                                              │
│  DISCOVER          VALIDATE          EXTRACT                │
│  (Before)   ───►   (During)   ───►   (After)                │
│                                                              │
│  pattern-search    pattern-validator  pattern-codifier      │
│  Find patterns     Check compliance   Document learnings    │
│  to follow         against patterns   as new patterns       │
└─────────────────────────────────────────────────────────────┘
```

## The Three Agents

### 1. **pattern-search** - Pattern Discovery
**Model:** `haiku` (fast)
**Purpose:** Find relevant patterns when you need them

**Use When:**
- **Before implementing** - "How do I add CSRF protection?"
- **During debugging** - "Why am I getting N+1 queries?"
- **When learning** - "What are the security patterns?"

**Example:**
```bash
claude task pattern-search "Show me examples of transaction usage"
```

**Output:** Relevant patterns with code examples, ranked by relevance

---

### 2. **pattern-validator** - Code Validation
**Model:** `sonnet` (thorough)
**Purpose:** Validate code against documented patterns

**Use When:**
- **Before committing** - Catch anti-patterns early
- **During code review** - Systematic pattern check
- **After refactoring** - Ensure conventions followed

**Example:**
```bash
claude task pattern-validator "Validate server/routes/product-routes.ts"
```

**Output:** Validation report with Critical/Warning/Suggestion findings

---

### 3. **pattern-codifier** - Knowledge Extraction
**Model:** `sonnet` (comprehensive)
**Purpose:** Extract patterns from reviews and sessions

**Use When:**
- **After code review** - Document learnings
- **After bug fixes** - Capture solutions
- **After features** - Codify new patterns

**Example:**
```bash
claude task pattern-codifier "Codify patterns from this review session"
```

**Output:** Updated pattern files with new patterns

---

## Complete Development Workflow

### Phase 1: Planning & Discovery (pattern-search)

```bash
# 1. Search for relevant patterns BEFORE implementing
claude task pattern-search "How do I build an authenticated API endpoint with database access?"

# Output: Patterns for:
# - API route structure (withAuth, csrfProtection)
# - Database access (storage layer, transactions)
# - Error handling (sendSuccess/sendError)

# 2. Read the patterns, understand the conventions

# 3. Implement following the documented patterns
vim server/routes/my-new-endpoint.ts
```

### Phase 2: Validation (pattern-validator)

```bash
# 4. Validate your implementation BEFORE committing
claude task pattern-validator "Validate server/routes/my-new-endpoint.ts"

# Output: Validation report
# ✅ Patterns Followed: 8
# ⚠️ Warnings: 2 (missing transaction boundary)
# ❌ Critical: 1 (missing CSRF protection)

# 5. Fix critical issues and warnings
vim server/routes/my-new-endpoint.ts

# 6. Re-validate
claude task pattern-validator "Re-validate after fixes"
# Output: All patterns followed! ✅
```

### Phase 3: Code Review & Commit

```bash
# 7. Stage changes
git add server/routes/my-new-endpoint.ts

# 8. Commit (triggers pre-commit hook with code-review-specialist)
git commit -m "feat: add authenticated product endpoint"

# Pre-commit hook runs automatically:
# - Reviews code against all patterns
# - Checks pre-commit hook rules
# - Recommends pattern codification if learnings identified
```

### Phase 4: Pattern Extraction (pattern-codifier)

```bash
# 9. If review identified significant learnings, codify them
claude task pattern-codifier "Codify patterns from this review focusing on API security"

# Output: Pattern added to docs/04_SECURITY_PATTERNS.md
# - Pattern: "API Endpoint Security Checklist"
# - Source: Development session 2025-12-23

# 10. Commit pattern updates
git add docs/04_SECURITY_PATTERNS.md
git commit -m "docs: codify API security pattern from endpoint implementation"
```

---

## Agent Interactions

### Interaction 1: Search → Validate

```bash
# Find the pattern
claude task pattern-search "Transaction boundary patterns"

# Implement using the pattern

# Validate implementation
claude task pattern-validator "Check if I followed the transaction pattern"
```

### Interaction 2: Validate → Codify

```bash
# Validation finds recurring issue
claude task pattern-validator "Validate all route files"
# Output: 5 routes missing CSRF protection

# Fix all instances

# Codify the pattern
claude task pattern-codifier "Document CSRF protection pattern with examples from the 5 routes we fixed"
```

### Interaction 3: Search → Codify

```bash
# Search reveals gap
claude task pattern-search "WebSocket authentication patterns"
# Output: No patterns found

# Implement WebSocket auth

# Document the new pattern
claude task pattern-codifier "Document WebSocket authentication pattern we just implemented"
```

### Interaction 4: Complete Cycle

```bash
# 1. SEARCH: Find existing patterns
claude task pattern-search "Distributed locking patterns"

# 2. Implement using found patterns

# 3. VALIDATE: Check implementation
claude task pattern-validator "Validate server/services/job-lock-service.ts"

# 4. Fix issues from validation

# 5. CODIFY: Extract enhancements
claude task pattern-codifier "We improved the distributed locking pattern with retry logic - update the pattern"
```

---

## Quick Command Reference

### Pattern Search (Discovery)

| Use Case | Command |
|----------|---------|
| Find specific pattern | `claude task pattern-search "How do I [task]?"` |
| Get domain overview | `claude task pattern-search "Show all [domain] patterns"` |
| Find examples | `claude task pattern-search "Show examples of [concept]"` |
| Troubleshoot issue | `claude task pattern-search "I'm getting [error]"` |
| Anti-patterns | `claude task pattern-search "What NOT to do when [task]?"` |

### Pattern Validation

| Use Case | Command |
|----------|---------|
| Validate specific file | `claude task pattern-validator "Validate [file]"` |
| Validate staged changes | `claude task pattern-validator "Validate staged changes"` |
| Domain-specific check | `claude task pattern-validator "Validate [file] for [domain] patterns"` |
| Full audit | `claude task pattern-validator "Audit all [directory]/ files"` |
| Pre-commit check | `claude task pattern-validator "Pre-commit validation"` |

### Pattern Codification

| Use Case | Command |
|----------|---------|
| From current session | `claude task pattern-codifier "Codify patterns from this session"` |
| From specific PR | `claude task pattern-codifier "Extract patterns from PR #123"` |
| From recent work | `claude task pattern-codifier "Review last 7 days and extract patterns"` |
| Update existing | `claude task pattern-codifier "Update [pattern] with [addition]"` |
| Domain-specific | `claude task pattern-codifier "Codify [domain] patterns"` |

---

## Convenience Aliases

Source `.claude/pattern-codifier-aliases.sh` for quick commands:

```bash
source .claude/pattern-codifier-aliases.sh

# Now available:
search-pattern "CSRF protection"      # Quick pattern search
validate-code server/routes/file.ts   # Quick validation
codify                                 # Quick codification
codify-security                        # Domain-specific codification
```

---

## Integration with Existing Tools

### Pre-Commit Hook Integration

```json
// .claude/hooks.json
{
  "pre-commit": {
    "agent": "code-review-specialist",
    "prompt": "Review and recommend pattern-codifier if learnings found"
  }
}
```

**Workflow:**
1. `git commit` triggers `code-review-specialist`
2. Review recommends `pattern-codifier` if significant patterns found
3. You run `pattern-codifier` manually
4. Commit includes pattern updates

### Git Hooks Integration (Optional)

Add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
# Run pattern validation before push

echo "Running pattern validation..."
claude task pattern-validator "Validate all changed files" || {
  echo "❌ Pattern validation failed. Fix issues or use --no-verify to skip."
  exit 1
}
```

### CI/CD Integration

```yaml
# .github/workflows/pattern-validation.yml
- name: Validate Patterns
  run: |
    claude task pattern-validator "Validate all changed files in this PR" --format json
```

---

## Pattern File Ecosystem

All agents operate on these 8 pattern files:

| File | Domain | Lines | Patterns |
|------|--------|-------|----------|
| `docs/01_TYPESCRIPT_PATTERNS.md` | Type safety | ~300 | 15+ |
| `docs/02_DATABASE_PATTERNS.md` | Database | ~400 | 20+ |
| `docs/03_API_PATTERNS.md` | API/Routes | ~350 | 18+ |
| `docs/04_SECURITY_PATTERNS.md` | Security | ~500 | 25+ |
| `docs/05_FRONTEND_PATTERNS.md` | Frontend | ~250 | 12+ |
| `docs/06_ERROR_HANDLING_PATTERNS.md` | Error handling | ~300 | 10+ |
| `docs/07_BACKGROUND_JOBS_PATTERNS.md` | Background jobs | ~200 | 8+ |
| `docs/08_TESTING_PATTERNS.md` | Testing | ~3,500 | 30+ |

**Total:** ~5,800 lines of pattern documentation

---

## Success Metrics

Track the effectiveness of the pattern ecosystem:

### Pattern Discovery Metrics
- **Search frequency**: How often developers search patterns before implementing
- **Pattern references**: Patterns referenced in PRs/commits
- **Discovery time**: Time to find relevant pattern (target: <30 seconds)

### Pattern Compliance Metrics
- **Validation usage**: % of commits that run pattern-validator
- **Critical issues**: Critical pattern violations caught before commit
- **Pre-commit blocks**: Pattern violations caught by pre-commit hook (should decrease over time)

### Pattern Growth Metrics
- **Patterns added/month**: New patterns documented
- **Pattern updates**: Existing patterns enhanced with examples
- **Coverage**: % of codebase areas with documented patterns

### Impact Metrics
- **Bug prevention**: Issues prevented by following patterns
- **Review efficiency**: Time saved in code reviews (patterns handle basics)
- **Onboarding speed**: Time for new developers to be productive

---

## Best Practices

### For Developers

1. **Search First** - Before implementing, search for existing patterns
2. **Validate Early** - Run pattern-validator before requesting review
3. **Codify Learnings** - After reviews, extract patterns worth documenting
4. **Reference Patterns** - In PRs, reference pattern files you followed
5. **Update Patterns** - When you discover better approaches, update patterns

### For Teams

1. **Pattern-First Culture** - Make pattern search part of workflow
2. **Review Against Patterns** - Use pattern files as review checklist
3. **Codification Cadence** - Weekly pattern extraction sessions
4. **Pattern Ownership** - Assign domain owners for pattern quality
5. **Pattern Metrics** - Track pattern effectiveness monthly

---

## Troubleshooting

### "Pattern search returns no results"

```bash
# Try broader search terms
claude task pattern-search "authentication"  # Instead of "passport.js auth"

# Browse domain file
claude task pattern-search "Show all security patterns"

# Document if pattern is missing
claude task pattern-codifier "Document [new pattern]"
```

### "Validation finds too many false positives"

```bash
# Validate specific domains only
claude task pattern-validator "Validate [file] for security patterns only"

# Check pattern context applicability
# Validator should skip patterns that don't apply

# Report false positive pattern (fix pattern file)
vim docs/XX_PATTERNS.md  # Clarify pattern context
```

### "Codifier creates duplicate patterns"

```bash
# Search first to check for existing
claude task pattern-search "Is there a pattern for [topic]?"

# If exists, update instead of creating new
claude task pattern-codifier "Update existing [pattern] with [addition]"
```

---

## Future Enhancements

### Planned Features

1. **pattern-lint** - Real-time pattern checking in IDE
2. **pattern-diff** - Show pattern compliance diff for PRs
3. **pattern-suggest** - AI suggests patterns during coding
4. **pattern-metrics** - Dashboard for pattern effectiveness
5. **pattern-templates** - Code templates from patterns

### Integration Ideas

- **VSCode Extension** - Inline pattern suggestions
- **GitHub App** - Auto-comment pattern violations on PRs
- **Slack Bot** - Pattern search from Slack
- **Dashboard** - Pattern coverage and compliance visualization

---

## Summary

The Pattern Agents Ecosystem provides:

✅ **Discovery** (pattern-search) - Find patterns when you need them
✅ **Validation** (pattern-validator) - Catch anti-patterns early
✅ **Extraction** (pattern-codifier) - Document learnings permanently

**Together, they create a self-improving codebase where:**
- Knowledge compounds over time
- Best practices are discoverable
- Code quality improves systematically
- New developers onboard faster

---

## Quick Start

### 1. Install Agents (Already Done!)

All three agents are in `.claude/agents/`:
- ✅ `pattern-search.md`
- ✅ `pattern-validator.md`
- ✅ `pattern-codifier.md`

### 2. Try Each Agent

```bash
# Search for a pattern
claude task pattern-search "How do I add CSRF protection?"

# Validate a file
claude task pattern-validator "Validate server/routes/health-routes.ts"

# Codify this learning session
claude task pattern-codifier "Document the Pattern Agents Ecosystem setup as a custom agent pattern"
```

### 3. Integrate into Workflow

```bash
# Load aliases
source .claude/pattern-codifier-aliases.sh

# Add to your shell rc file for persistence
echo "source ~/projects/PriceCompare/.claude/pattern-codifier-aliases.sh" >> ~/.bashrc
```

### 4. Use in Next Development Session

**Before implementing:**
```bash
search-pattern "[what you're building]"
```

**Before committing:**
```bash
validate-code [files-you-changed]
```

**After review:**
```bash
codify
```

---

**The pattern ecosystem is now complete and ready to compound your knowledge!** 🚀
