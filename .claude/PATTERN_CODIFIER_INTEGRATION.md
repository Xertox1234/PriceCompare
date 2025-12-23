# Pattern Codifier Integration Guide

## Your Existing Setup

You already have a `code-review-specialist` hook in `.claude/hooks.json` that reviews staged changes before commits. The pattern-codifier agent complements this by capturing learnings from those reviews.

## Recommended Integration Patterns

### Pattern 1: Manual After Reviews (Recommended for Start)

**Current workflow:**
```bash
git add .
# .claude/hooks.json triggers code-review-specialist automatically
git commit -m "feat: add feature"
```

**Enhanced workflow with pattern codification:**
```bash
git add .
# Hooks trigger code-review-specialist
# Review identifies issues...

# Address review feedback
# ... make corrections ...

# Before committing, capture the learnings
claude task pattern-codifier "Codify patterns from the pre-commit review focusing on [specific area]"

# Now commit with pattern updates
git add docs/*_PATTERNS.md  # Include updated patterns
git commit -m "feat: add feature

- Implemented X with Y approach
- Fixed Z issue identified in review
- Codified [pattern name] to [PATTERN_FILE]"
```

### Pattern 2: Optional Prompt After Reviews

Update `.claude/hooks.json` to remind you to codify patterns:

```json
{
  "pre-commit": {
    "agent": "code-review-specialist",
    "prompt": "Review the staged changes in this commit. Focus on the diff and highlight any issues before I commit."
  },
  "post-review-reminder": {
    "enabled": true,
    "blocking": false,
    "message": "💡 Reminder: If this review identified reusable patterns, run:\n   claude task pattern-codifier 'Codify patterns from this review'"
  }
}
```

### Pattern 3: Scheduled Pattern Extraction

Extract patterns from recent work periodically:

```bash
# Weekly pattern harvest (add to cron or run manually)
claude task pattern-codifier "Review last 7 days of commits and extract any patterns worth documenting. Focus on security and performance issues."
```

### Pattern 4: PR-Based Codification

After merging PRs, extract patterns for team learning:

```bash
# After PR merge
gh pr view 142 --comments | tee /tmp/pr_comments.txt
claude task pattern-codifier "Analyze PR #142 and codify any patterns about transaction boundaries"
```

## Integration with Existing Documentation

Your codebase already has comprehensive pattern files:

```
docs/
├── 01_TYPESCRIPT_PATTERNS.md      (~300 lines)
├── 02_DATABASE_PATTERNS.md        (~400 lines)
├── 03_API_PATTERNS.md             (~350 lines)
├── 04_SECURITY_PATTERNS.md        (~500 lines)
├── 05_FRONTEND_PATTERNS.md        (~250 lines)
├── 06_ERROR_HANDLING_PATTERNS.md  (~300 lines)
├── 07_BACKGROUND_JOBS_PATTERNS.md (~200 lines)
└── 08_TESTING_PATTERNS.md         (~350 lines)
```

The pattern-codifier agent:
- ✅ Preserves existing structure and formatting
- ✅ Adds patterns to appropriate sections
- ✅ Updates "Last updated" timestamps
- ✅ Avoids duplicates (checks before adding)
- ✅ Cross-references related patterns
- ✅ Maintains consistent markdown formatting

## Pre-Commit Hook Integration

Your pre-commit hook (`.git/hooks/pre-commit`) already enforces many patterns:

```bash
# Current blockers in your pre-commit hook
- TypeScript errors
- ESLint errors
- `any` types
- `console.log` in production code
- N+1 query patterns
- passwordHash exposure
- Floating promises
- Missing foreign key cascade rules
```

**Pattern codifier benefit**: When developers hit these pre-commit blocks, they can reference the pattern files for context and examples. Codifying patterns creates a feedback loop:

1. Pre-commit hook blocks issue
2. Developer fixes issue
3. Pattern-codifier documents the correct approach
4. Future developers reference pattern file
5. Fewer pre-commit blocks over time

## Workflow Examples

### Example 1: Security Fix

```bash
# Pre-commit hook blocks password hash exposure
git add server/routes/user-routes.ts
git commit -m "feat: add user profile endpoint"

# Pre-commit hook output:
# ❌ BLOCKER: Potential passwordHash exposure detected
# ❌ File: server/routes/user-routes.ts
# ❌ Pattern: db.select().from(users)

# Fix the issue
vim server/routes/user-routes.ts
# Change to explicit field selection

# Codify the pattern
claude task pattern-codifier "The passwordHash exposure fix in user-routes.ts should be documented as a CRITICAL security pattern with the before/after example"

# Commit with pattern documentation
git add server/routes/user-routes.ts docs/04_SECURITY_PATTERNS.md
git commit -m "feat: add user profile endpoint

- Implemented explicit field selection
- Codified password hash exposure prevention (CRITICAL) to SECURITY_PATTERNS.md
- Pattern includes pre-commit hook integration notes"
```

### Example 2: Performance Optimization

```bash
# During code review, N+1 query identified
claude task code-review-specialist "Review server/routes/price-history-routes.ts"

# Review output:
# ⚠️ WARNING: N+1 query pattern detected
# Issue: Querying in loop at line 42
# Recommendation: Use JOIN or batch query with inArray()

# Fix the issue
# ... refactor to use JOIN ...

# Codify while context is fresh
claude task pattern-codifier "Document the N+1 query fix in price-history-routes.ts. Include the before (loop with queries) and after (JOIN) examples with performance impact."

# Pattern added to DATABASE_PATTERNS.md with:
# - Before/after code examples
# - Performance rationale (100x improvement)
# - Pre-commit hook enforcement note
# - Cross-reference to transaction patterns
```

### Example 3: API Pattern from Multiple Reviews

```bash
# After several PRs with similar CSRF corrections
claude task pattern-codifier "I've noticed PRs #145, #152, and #156 all had CSRF protection issues. Synthesize a comprehensive CSRF pattern covering:
- When CSRF is required
- Middleware ordering (csrfProtection before withAuth)
- Auth endpoint requirements
- Common mistakes

Include examples from all three PRs with attribution."

# Pattern added to SECURITY_PATTERNS.md
# Cross-referenced in API_PATTERNS.md
# Brief reference added to CLAUDE.md
```

## Claude Code Ecosystem Integration

Your codebase has a rich agent ecosystem:

```
.claude/agents/
├── pattern-codifier.md (NEW!)
└── [future agents]

.claude/knowledge/
├── claude-code-subagent-setup-guide.md
└── subagent-quick-reference.md
```

**Suggested agent workflow:**

1. **code-review-specialist** (pre-commit hook) - Reviews code for issues
2. **pattern-codifier** (manual/scheduled) - Extracts patterns from reviews
3. **[Future] pattern-validator** - Validates code against documented patterns
4. **[Future] pattern-search** - Searches pattern files for relevant examples

## Testing the Pattern Codifier

### Quick Test: Codify from This Session

Let's verify the agent works by codifying a simple pattern from this setup session:

```bash
# Test the agent
claude task pattern-codifier "Document the 'Custom Subagent Creation' pattern for the PriceCompare codebase:

Context: When recreating or creating custom agents for project-specific workflows
Location: docs/08_TESTING_PATTERNS.md (or create new AGENT_PATTERNS.md)

Pattern should cover:
- Agent definition format (YAML frontmatter + markdown)
- Required fields (name, description, tools, model)
- Where to place agents (.claude/agents/)
- How to invoke (claude task [agent-name] 'prompt')

Include the pattern-codifier.md file creation as the example.

Source: Pattern codifier setup session 2025-12-23"
```

### Expected Output

The agent should:
1. ✅ Read existing pattern files to understand format
2. ✅ Determine best location (likely new section in relevant file)
3. ✅ Format the pattern with ✅ Preferred and ❌ Avoid examples
4. ✅ Include attribution (this session, date)
5. ✅ Update file timestamp
6. ✅ Provide summary of changes

### Validation

After running, check:

```bash
# Verify pattern was added
git diff docs/08_TESTING_PATTERNS.md

# Should show:
# + ### Custom Subagent Creation
# + **Context:** When recreating or creating custom agents...
# + **✅ Preferred Approach:**
# + ```markdown
# + ---
# + name: agent-name
# + ...
```

## Maintenance

### Weekly Pattern Review

```bash
# Every Monday, extract patterns from last week
claude task pattern-codifier "Review commits from last 7 days. Extract any patterns about:
- Security issues fixed
- Performance optimizations
- Common review feedback
- Pre-commit hook hits

Focus on patterns that recurred 2+ times."
```

### Monthly Pattern Consolidation

```bash
# First Monday of month
claude task pattern-codifier "Review all pattern files for:
- Duplicate or overlapping patterns (consolidate)
- Outdated patterns (flag for update/removal)
- Missing cross-references (add links)
- Examples that need updating

Generate report of recommended changes."
```

### Quarterly Pattern Audit

```bash
# Every quarter
claude task pattern-codifier "Analyze pattern effectiveness:
- Which patterns are most referenced? (add more examples)
- Which patterns have prevented pre-commit blocks? (quantify impact)
- Which patterns are never referenced? (consider removing)
- What new patterns emerged this quarter?

Generate metrics report and recommendations."
```

## Advanced: Pattern-Driven Development

As your pattern documentation grows, consider:

### 1. Pattern-First Development

Before implementing features, search patterns:

```bash
# Before implementing auth endpoint
grep -r "CSRF" docs/04_SECURITY_PATTERNS.md
# Read the CSRF pattern, then implement following the documented approach
```

### 2. Pattern Validation in CI/CD

Extend your GitHub Actions to validate code against documented patterns:

```yaml
# .github/workflows/pattern-validation.yml
name: Pattern Validation

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Check for anti-patterns
        run: |
          # Check for passwordHash exposure
          if grep -r "db.select().from(users)" server/; then
            echo "❌ Anti-pattern detected: passwordHash exposure"
            echo "See docs/04_SECURITY_PATTERNS.md for correct approach"
            exit 1
          fi

          # Check for N+1 queries (simplified)
          if grep -A5 "for.*of.*await.*db\." server/; then
            echo "❌ Anti-pattern detected: Potential N+1 query"
            echo "See docs/02_DATABASE_PATTERNS.md for batch query patterns"
            exit 1
          fi
```

### 3. Pattern-Powered Code Reviews

Reference patterns in PR reviews:

```markdown
## Review Comments

**Issue**: Route missing CSRF protection

**Pattern Reference**: See "CSRF Protection for Mutating Endpoints" in `docs/04_SECURITY_PATTERNS.md`

**Fix**:
```typescript
// Add csrfProtection middleware
app.post('/api/products', csrfProtection, withAuth(async (req, res) => {
  // handler
}));
```

**Why**: All POST/PUT/PATCH/DELETE endpoints require CSRF protection to prevent cross-site request forgery attacks.
```

## Summary

The pattern-codifier agent transforms your codebase into a learning organization:

**Before:**
- Review feedback is ephemeral
- Same mistakes repeated across PRs
- New developers learn by trial and error
- Pre-commit hook blocks are cryptic

**After:**
- Review feedback becomes permanent knowledge
- Patterns documented with examples
- New developers reference pattern files
- Pre-commit blocks link to pattern documentation

**Integration Points:**

1. **Pre-commit hook** → Blocks issues → Pattern file provides solution
2. **Code reviews** → Identify patterns → Codifier documents patterns
3. **Development sessions** → Fix issues → Codify learnings immediately
4. **PR comments** → Recurring feedback → Synthesize comprehensive patterns
5. **Monthly reviews** → Audit patterns → Keep documentation current

**Next Steps:**

1. ✅ Pattern-codifier agent created (`.claude/agents/pattern-codifier.md`)
2. ✅ Documentation written (this file + PATTERN_CODIFICATION_GUIDE.md)
3. ✅ Quick reference created (`.claude/PATTERN_CODIFIER_QUICKREF.md`)
4. ⏭️ Test the agent (run the test command above)
5. ⏭️ Integrate into your workflow (choose Pattern 1 or 2 above)
6. ⏭️ Schedule weekly pattern extraction
7. ⏭️ Add pattern references to CLAUDE.md for critical patterns

---

*Ready to transform your code reviews into compounding knowledge!*