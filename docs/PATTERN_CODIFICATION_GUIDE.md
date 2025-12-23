# Pattern Codification Guide

> **Purpose**: Extract learnings from code reviews and development sessions into permanent, searchable pattern documentation.

## Overview

The `pattern-codifier` agent transforms ephemeral feedback (PR comments, review notes, bug fixes) into permanent organizational knowledge stored in `docs/*_PATTERNS.md` files.

## Quick Start

```bash
# After a code review session
claude task pattern-codifier "Codify patterns from this review session"

# From a specific PR
claude task pattern-codifier "Extract patterns from PR #145"

# From recent development
claude task pattern-codifier "Document the N+1 query fixes we just made"
```

## When to Run Pattern Codification

### ✅ Run After These Events:

1. **Code Review Completion**
   - Manual review where you identified issues
   - `code-review-specialist` agent found patterns worth documenting
   - Security vulnerabilities were fixed
   - Performance optimizations were applied

2. **Bug Fix with Learnings**
   - Bug revealed a gap in documentation
   - Root cause was a common anti-pattern
   - Fix introduces a new pattern worth sharing

3. **Feature Implementation**
   - New architectural pattern introduced
   - Novel solution to common problem
   - Integration pattern with external service

4. **Refactoring Session**
   - Anti-patterns replaced with better approaches
   - Code simplified using established patterns
   - Duplicate code consolidated into reusable pattern

### ❌ Don't Bother For:

- Trivial typo fixes
- Dependency updates (unless they introduce new patterns)
- One-off edge cases unlikely to recur
- Style changes handled by Prettier/ESLint

## Workflow Integration

### Pattern 1: Integrate with Code Review

```bash
# 1. Make code changes
vim server/routes/product-routes.ts

# 2. Run code review
claude task code-review-specialist "Review product-routes.ts changes"

# 3. Address review feedback
# ... make corrections based on feedback ...

# 4. Codify patterns from the review
claude task pattern-codifier "Extract patterns from this review session focusing on route security"

# 5. Commit everything together
git add .
git commit -m "feat: add product filtering endpoint

- Implemented filter validation with Zod
- Added CSRF protection per security patterns
- Codified route security pattern to API_PATTERNS.md"
```

### Pattern 2: Extract from Merged PRs

```bash
# After PR is merged, extract patterns for team learning
gh pr view 142 --comments
claude task pattern-codifier "Analyze PR #142 comments and codify any patterns about transaction boundaries"
```

### Pattern 3: Capture Real-Time Learnings

During a development session where Claude helps you fix issues:

```bash
# Session where you fixed N+1 queries
claude "Help me fix the N+1 queries in price history endpoint"
# ... Claude helps optimize queries ...

# Immediately codify while context is fresh
claude task pattern-codifier "Document the N+1 query patterns we just fixed, include the before/after examples from price-history-routes.ts"
```

## Pattern File Structure Reference

| File | Domain Coverage | Common Pattern Types |
|------|----------------|---------------------|
| `01_TYPESCRIPT_PATTERNS.md` | Type safety, async/await, generics | Floating promises, `any` avoidance, type guards |
| `02_DATABASE_PATTERNS.md` | Queries, transactions, schema | N+1 prevention, transaction boundaries, batch operations |
| `03_API_PATTERNS.md` | Routes, middleware, services | Route helpers, error handling, request validation |
| `04_SECURITY_PATTERNS.md` | Auth, CSRF, validation | Password handling, CSRF protection, input sanitization |
| `05_FRONTEND_PATTERNS.md` | React, state management, UI | Component patterns, React Query, form handling |
| `06_ERROR_HANDLING_PATTERNS.md` | Error responses, sanitization | sendError helpers, PostgreSQL errors, recovery strategies |
| `07_BACKGROUND_JOBS_PATTERNS.md` | Async processing, queues | Job locking, cron patterns, queue configuration |
| `08_TESTING_PATTERNS.md` | Test setup, assertions, mocks | Integration tests, test data, database testing |

## Pattern Quality Standards

### ✅ Good Pattern Documentation:

```markdown
### Prevent N+1 Queries with Batch Loading

**Context:** When fetching related data for multiple records (products with offers, users with watchlists)

**Problem:** Querying in a loop creates N+1 queries, killing performance at scale. Each iteration hits the database, multiplying latency.

**✅ Preferred Approach:**
```typescript
// Single query with JOIN - O(1) database calls
const productsWithOffers = await db
  .select({
    product: products,
    offer: productOffers,
  })
  .from(products)
  .leftJoin(productOffers, eq(products.id, productOffers.productId))
  .where(inArray(products.id, productIds));

// Group by product ID in application code
const grouped = productsWithOffers.reduce((acc, row) => {
  if (!acc[row.product.id]) acc[row.product.id] = { ...row.product, offers: [] };
  if (row.offer) acc[row.product.id].offers.push(row.offer);
  return acc;
}, {});
```

**❌ Anti-Pattern:**
```typescript
// N+1 query - O(N) database calls
const products = await db.select().from(products).where(inArray(products.id, productIds));

for (const product of products) {
  // N queries in loop!
  const offers = await db
    .select()
    .from(productOffers)
    .where(eq(productOffers.productId, product.id));
  product.offers = offers;
}
```

**Rationale:**
- Performance: N+1 queries take 100x longer at scale (100 products = 101 queries vs 1 query)
- Database load: Each query has network roundtrip overhead (~5-10ms)
- Pre-commit hook blocks this pattern automatically
- Use `array_agg()` for PostgreSQL-level grouping when appropriate

**Related Patterns:**
- Database transactions for multi-step operations (DATABASE_PATTERNS.md)
- Batch operations for bulk inserts (DATABASE_PATTERNS.md)

*Source: PR #67, Performance audit 2025-11-15*
*Added: 2025-11-15*
```

### Key Elements of Good Documentation:

1. **Clear Context**: When does this apply? What's the trigger?
2. **Problem Statement**: What breaks if you don't follow this?
3. **Working Code Examples**: Real, runnable code from the codebase
4. **Contrast**: Show BOTH the right way and wrong way
5. **Rationale**: Explain WHY with specifics (performance numbers, security risks)
6. **Cross-References**: Link to related patterns
7. **Attribution**: Source (PR, date, commit) for traceability

## Advanced Usage

### Codify from Git History

```bash
# Extract patterns from last week's work
claude task pattern-codifier "Review commits from the last week and extract any patterns about error handling that should be documented"
```

### Cross-Domain Patterns

Some patterns span multiple domains:

```bash
# Authentication touches security, API, and database
claude task pattern-codifier "Document the authentication flow pattern covering CSRF protection, session management, and password hashing. Include sections in SECURITY_PATTERNS.md and API_PATTERNS.md with cross-references."
```

### Update Existing Patterns

```bash
# Enhance existing pattern with new example
claude task pattern-codifier "The transaction boundary pattern in DATABASE_PATTERNS.md needs an example for the SERIALIZABLE isolation level case. Add the user registration race condition example we just implemented."
```

## Integration with Pre-Commit Hooks

Many patterns documented in `docs/*_PATTERNS.md` are enforced by the pre-commit hook (`.git/hooks/pre-commit`). When codifying:

1. **Note hook enforcement**: If a pattern has hook support, mention it
2. **Document bypass patterns**: When `// SECURITY:` comments are needed
3. **Update hook if needed**: Major patterns may warrant hook additions

Example:
```markdown
**Pre-commit Hook:** This pattern is enforced by the hook's N+1 query detection. The hook blocks commits with queries inside loops.

**Bypass (rare)**: If you have a legitimate reason (e.g., queries with dynamic conditions impossible to batch):
```typescript
for (const item of items) {
  // N+1 ALLOWED: Dynamic WHERE clause varies per item
  await db.select().from(table).where(complexDynamicCondition(item));
}
```
```

## Troubleshooting

### "Pattern Already Exists" False Positives

If the agent reports a duplicate but you want to add nuance:

```bash
claude task pattern-codifier "The floating promises pattern exists in TYPESCRIPT_PATTERNS.md, but add a new section specifically about floating promises in Express middleware since that's a common trap"
```

### Patterns That Don't Fit Categories

Some patterns are cross-cutting or don't fit existing files:

```bash
claude task pattern-codifier "This caching pattern affects both backend services and frontend. Document the server-side caching in BACKGROUND_JOBS_PATTERNS.md and the client-side caching in FRONTEND_PATTERNS.md with cross-references."
```

### Keeping CLAUDE.md Synchronized

Major patterns should be referenced in CLAUDE.md:

```bash
claude task pattern-codifier "After adding the new CSRF protection pattern to SECURITY_PATTERNS.md, add a brief reference to CLAUDE.md under the 'Security Patterns (MANDATORY)' section"
```

## Metrics and Success Criteria

Track pattern codification effectiveness:

- **Pattern Reuse**: Patterns referenced in code reviews
- **Pre-commit Hook Hits**: Reduced over time as patterns are learned
- **Onboarding Time**: New developers find answers in pattern files
- **Review Comments**: Fewer repeated comments about same issues

Example metrics to track:

```markdown
## Pattern Impact Tracking

| Pattern | Added | Times Referenced | Pre-commit Blocks Prevented |
|---------|-------|-----------------|---------------------------|
| N+1 Prevention | 2025-11-15 | 8 | 12 |
| CSRF Protection | 2025-11-20 | 15 | 0 (always manual) |
| Transaction Boundaries | 2025-11-22 | 6 | 5 |
```

## Pattern Lifecycle

Patterns evolve over time:

1. **Initial Codification**: Pattern documented after first occurrence
2. **Refinement**: Updated with additional examples, edge cases
3. **Enforcement**: Pre-commit hook added if pattern is critical
4. **Maturity**: Pattern becomes second nature, rarely referenced
5. **Deprecation**: Technology changes, pattern becomes obsolete (archive with date)

## Best Practices

1. **Codify While Context is Fresh**: Don't wait days after a review
2. **Include Real Examples**: Use actual code from the codebase, not generic examples
3. **Prioritize Security**: Security patterns always take precedence
4. **Cross-Reference Liberally**: Help developers discover related patterns
5. **Update Timestamps**: Always update "Last updated" in modified files
6. **Attribute Sources**: Include PR numbers, dates, commit hashes for traceability
7. **Quality Over Quantity**: One excellent pattern beats five rushed ones

## Example Sessions

### Example 1: Security Pattern from PR Review

```bash
User: "I just merged PR #156 that fixed a password hash exposure bug. Can you codify this?"

Claude (pattern-codifier): "I'll analyze PR #156 and extract the security pattern."

# Agent runs:
# 1. gh pr view 156 --comments
# 2. git show [commit from PR]
# 3. Analyzes the before/after code
# 4. Formats pattern for SECURITY_PATTERNS.md
# 5. Adds pattern with attribution

Claude: "Added 'Password Hash Exposure Prevention' pattern to docs/04_SECURITY_PATTERNS.md:

- Severity: CRITICAL
- Includes before/after code examples from your fix
- Rationale explains attack vectors
- Cross-referenced to API_PATTERNS.md (route security)
- Source: PR #156, 2025-12-23

Also added brief reference to CLAUDE.md under 'Security Patterns' section."
```

### Example 2: Performance Pattern from Development Session

```bash
User: "We just fixed those N+1 queries in the price history endpoint. Let's document this."

Claude (pattern-codifier): "I'll extract the N+1 prevention pattern from our session."

# Agent analyzes:
# 1. Recent conversation (price-history-routes.ts changes)
# 2. Before/after code from the session
# 3. Performance impact (101 queries → 1 query)

Claude: "Added 'N+1 Query Prevention with Batch Loading' to docs/02_DATABASE_PATTERNS.md:

- Includes the price history example (before: loop with queries, after: JOIN)
- Performance rationale (100x improvement at scale)
- Pre-commit hook enforcement noted
- Related patterns: array_agg() grouping, transaction boundaries
- Source: Development session 2025-12-23

This pattern complements the existing 'Transaction Boundaries' pattern in the same file."
```

### Example 3: API Pattern from Multiple PRs

```bash
User: "I've noticed we've had 3 PRs this month about CSRF protection. Can you create a comprehensive pattern from all of them?"

Claude (pattern-codifier): "I'll analyze PRs #145, #152, and #156 to extract a comprehensive CSRF pattern."

# Agent analyzes:
# 1. gh pr view 145 --comments
# 2. gh pr view 152 --comments
# 3. gh pr view 156 --comments
# 4. Identifies common themes and corrections
# 5. Synthesizes into comprehensive pattern

Claude: "Added comprehensive 'CSRF Protection for Mutating Endpoints' pattern to docs/04_SECURITY_PATTERNS.md:

Pattern covers:
- When CSRF is required (all POST/PUT/PATCH/DELETE)
- Middleware ordering (csrfProtection before withAuth)
- Auth endpoint requirements
- Token endpoint for clients
- Common mistakes (global middleware, missing on auth routes)

Includes 4 code examples from the 3 PRs:
- Correct: per-route application
- Incorrect: global middleware
- Auth endpoint pattern
- Token endpoint pattern

Also added reference to CLAUDE.md and cross-referenced API_PATTERNS.md.

Sources: PR #145, #152, #156 (Nov 2025)"
```

## Maintenance

### Monthly Pattern Review

Schedule monthly review of pattern files:

```bash
# Check for outdated patterns
claude task pattern-codifier "Review all patterns in docs/*_PATTERNS.md for accuracy. Flag any that reference deprecated APIs or outdated practices."

# Update patterns with new examples
claude task pattern-codifier "The React Query pattern in FRONTEND_PATTERNS.md could use the new suspense example from our latest work. Update it."
```

### Pattern Consolidation

If patterns overlap or become redundant:

```bash
claude task pattern-codifier "The error handling patterns in API_PATTERNS.md and ERROR_HANDLING_PATTERNS.md overlap. Consolidate them with ERROR_HANDLING_PATTERNS.md as the canonical source and add cross-reference in API_PATTERNS.md."
```

## Summary

The `pattern-codifier` agent transforms your development learnings into permanent organizational knowledge:

- **Automatic**: Extracts patterns from reviews, PRs, commits
- **Structured**: Organizes into domain-specific pattern files
- **Actionable**: Includes working code examples and anti-patterns
- **Traceable**: Always includes source attribution
- **Evolving**: Patterns updated as codebase matures

**Key Commands:**

```bash
# After code review
claude task pattern-codifier "Codify patterns from this review session"

# From specific PR
claude task pattern-codifier "Extract patterns from PR #XXX"

# From recent work
claude task pattern-codifier "Document the [specific pattern] we just implemented"

# Update existing pattern
claude task pattern-codifier "Add example to [pattern name] in [FILE]"
```

**Next Steps:**

1. Run pattern codification after your next code review
2. Update `.claude/hooks.json` to include pattern-codifier in review workflow
3. Schedule monthly pattern review sessions
4. Track pattern impact (reuse, pre-commit blocks prevented)

---

*For detailed agent behavior, see `.claude/agents/pattern-codifier.md`*