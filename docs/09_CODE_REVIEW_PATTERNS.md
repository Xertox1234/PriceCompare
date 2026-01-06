# Code Review Patterns

**Version:** 1.0
**Last Updated:** 2026-01-06
**Domain:** Code Review, Quality Assurance, Pattern Extraction
**Changelog:**
- 1.0 (2026-01-06): Initial version - Two-Phase Code Review Pattern (from TODO_012 implementation)

---

This document codifies code review patterns to ensure comprehensive quality validation beyond what automated testing can catch.

## Table of Contents
- [Overview](#overview)
- [Two-Phase Code Review Pattern (Critical)](#two-phase-code-review-pattern-critical)
- [Code Review Checklist](#code-review-checklist)
- [Related Documentation](#related-documentation)

---

## Overview

**Core Principles:**
- **Testing validates behavior, code review validates correctness**
- **Data completeness issues may not surface in tests**
- **Type safety ≠ Data completeness**
- **Plan reviews and implementation reviews serve different purposes**

**Key Technologies:**
- `code-review-specialist` agent (implementation review)
- Parallel specialist agents (plan review): `@kieran-typescript-reviewer`, `@performance-oracle`, `@code-simplicity-reviewer`

---

## Two-Phase Code Review Pattern (Critical)

**Context:** When implementing complex features (especially schema validation, data synchronization, or reference list management), comprehensive review requires both plan validation AND implementation validation.

**Problem:**
Code can be technically perfect (type safety ✅, performance ✅, error handling ✅) but have data completeness issues that only code review catches. Testing validates behavior ("does validation work?") but not correctness ("is the validation complete?").

**Real-World Example (TODO_012):**

We reviewed the TODO_012 plan with 3 parallel specialists, implemented it with excellent type safety and performance, but **forgot to review the actual implementation**. When we finally called `code-review-specialist`, it caught a CRITICAL issue:

- **Implementation had:** 27 tables in `EXPECTED_TABLES`
- **Schema actually defined:** 41 tables (via `grep "pgTable" shared/schema.ts | wc -l`)
- **Coverage gap:** 34% of tables NOT validated
- **Testing showed:** "✅ Schema validated - all 27 tables present" (passing!)
- **Code review revealed:** "You're only validating 66% of tables!"

**Missing Tables Found by Review:**
```typescript
// 14 tables NOT in original EXPECTED_TABLES list:
'badges', 'deal_spottings', 'post_mentions', 'price_alerts',
'retailer_configs', 'retailer_monitoring', 'trending_products',
'user_activity_logs', 'user_badges', 'user_followers',
'user_preferences', 'user_sessions', 'votes', 'watchlist_collaborators'
```

### ✅ Preferred Approach: Two-Phase Review

```typescript
/**
 * PHASE 1: Plan Review (Before Implementation)
 * Purpose: Validate design, architecture, approach
 */

// Step 1: Create detailed implementation plan
// TODO_012_plan.md:
// - Define validation approach
// - Specify data structures
// - Document trade-offs

// Step 2: Review plan with parallel specialists
// Call multiple agents simultaneously for diverse perspectives:
claude task @kieran-typescript-reviewer "Review TODO_012_plan.md for type safety"
claude task @performance-oracle "Review TODO_012_plan.md for performance"
claude task @code-simplicity-reviewer "Review TODO_012_plan.md for simplicity"

// Step 3: Synthesize feedback and create corrected plan
// Produces: TODO_012_plan_corrected.md
// Benefits: Catches design issues before writing code

/**
 * PHASE 2: Implementation Review (After Implementation) ← CRITICAL, EASY TO FORGET
 * Purpose: Validate data completeness, implementation correctness
 */

// Step 4: Implement based on corrected plan
// Write the actual code following the approved design

// Step 5: Review ACTUAL implementation ← THIS STEP WAS FORGOTTEN
claude task code-review-specialist "Review e2e/helpers.ts validateTestSchema implementation"

// Step 6: Address code review findings
// Example findings from TODO_012:
// - EXPECTED_TABLES only has 27/41 tables (66% coverage)
// - Missing: badges, deal_spottings, post_mentions, etc.
// - Recommendation: Audit schema.ts and add missing tables

// Step 7: Re-review if significant changes made
// After adding 14 missing tables, verify completeness again
```

### ❌ Anti-Pattern (Avoid):

```typescript
// ❌ WRONG - Skipped Phase 2 (Implementation Review)

// Phase 1: Plan Review
✅ Plan reviewed by 3 specialists
✅ Corrected plan created with trade-offs documented
✅ Type safety validated
✅ Performance validated

// Implementation
✅ Code written following plan
✅ Type-safe (TypeScript ✅)
✅ Performant (0.57ms overhead ✅)
✅ Tests pass (✅ all 27 tables present)

// ❌ SKIPPED Phase 2: Implementation Review
// Committed without calling code-review-specialist
// RESULT: Shipped incomplete validation (27/41 tables = 66% coverage)

// What we shipped:
const EXPECTED_TABLES = [
  'users', 'products', 'retailers', // ... 27 total
]; // But schema.ts defines 41 tables!

// Tests said: "✅ all 27 tables present"
// But review would have said: "❌ 14 tables missing from validation"
```

### Rationale:

**Why Two Phases Are Needed:**

1. **Plan Review (Phase 1):**
   - Validates **design** and **approach**
   - Catches architectural issues early
   - Prevents wasted implementation effort
   - Provides multiple expert perspectives
   - Example: Kieran caught type safety violations in TODO_012 design

2. **Implementation Review (Phase 2):**
   - Validates **data completeness** and **correctness**
   - Catches issues testing won't reveal
   - Verifies plan was correctly implemented
   - Reviews actual code, not theoretical design
   - Example: Found 14 missing tables in TODO_012 implementation

**What Testing Can't Catch:**

```typescript
// Test validates: "Does validation work?"
✅ validateTestSchema() throws error if table missing
✅ validateTestSchema() passes if all EXPECTED_TABLES present

// Test CANNOT validate: "Is validation complete?"
❌ Are all 41 schema.ts tables in EXPECTED_TABLES?
❌ Are we validating 100% or only 66%?
❌ Which tables are we NOT validating?

// Only code review catches:
"EXPECTED_TABLES only lists 27 tables, but schema.ts defines 41.
Missing: badges, deal_spottings, post_mentions, ..."
```

**Consequences of Skipping Phase 2:**

- ✅ Code is type-safe
- ✅ Code is performant
- ✅ Tests pass
- ❌ **But implementation is incomplete**
- ❌ **Future schema additions might go unvalidated**
- ❌ **Silent failures (tests don't fail, but coverage degrades)**

### Two-Phase Review Checklist:

**Phase 1: Plan Review (Before Implementation)**
- [ ] Implementation plan created (detailed design doc)
- [ ] Plan reviewed by `@kieran-typescript-reviewer` (type safety)
- [ ] Plan reviewed by `@performance-oracle` (performance implications)
- [ ] Plan reviewed by `@code-simplicity-reviewer` (simplicity, maintainability)
- [ ] Feedback synthesized into corrected plan
- [ ] Trade-offs documented in corrected plan
- [ ] Ready to implement

**Phase 2: Implementation Review (After Implementation) ← DON'T SKIP THIS**
- [ ] Code implemented following corrected plan
- [ ] Tests written and passing
- [ ] **Implementation reviewed by `code-review-specialist`** ← CRITICAL STEP
- [ ] Code review findings documented
- [ ] Data completeness verified (e.g., all tables/enums/configs present)
- [ ] Critical issues addressed
- [ ] Re-reviewed if significant changes made
- [ ] Ready to commit

**Red Flags (When You Might Skip Phase 2):**
- ⚠️ "Tests are passing, must be correct"
- ⚠️ "Plan was reviewed, implementation should be fine"
- ⚠️ "Type safety is enforced, no issues possible"
- ⚠️ "Simple implementation, doesn't need review"

**When to ALWAYS Do Phase 2:**
- ✅ Schema validation implementations
- ✅ Data synchronization logic
- ✅ Reference list management (enums, configs, expected values)
- ✅ Complex aggregations or calculations
- ✅ Security-critical code
- ✅ Performance-critical code
- ✅ Any code with "expected" data lists

### Pattern Workflow Diagram:

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: PLAN REVIEW (Design Validation)                       │
└─────────────────────────────────────────────────────────────────┘
          │
          ├─→ Create implementation plan
          │
          ├─→ Review with @kieran-typescript-reviewer  ──┐
          ├─→ Review with @performance-oracle           ├─→ Parallel
          ├─→ Review with @code-simplicity-reviewer     ──┘
          │
          ├─→ Synthesize feedback
          │
          └─→ Create corrected plan
                    │
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ IMPLEMENTATION (Write Code)                                     │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: IMPLEMENTATION REVIEW (Data Completeness) ← CRITICAL   │
└─────────────────────────────────────────────────────────────────┘
          │
          ├─→ Review with code-review-specialist
          │
          ├─→ ❓ Data completeness issues found?
          │       │
          │       ├─→ YES: Fix issues
          │       │         │
          │       │         └─→ Re-review implementation
          │       │
          │       └─→ NO: Proceed to commit
          │
          └─→ COMMIT
```

### Integration with Existing Workflow:

This pattern integrates with the existing code review workflow documented in CLAUDE.md:

```bash
# PHASE 1: Plan Review (Before Implementation)
# Review plan with parallel specialists
claude task @kieran-typescript-reviewer "Review plan"
claude task @performance-oracle "Review plan"
claude task @code-simplicity-reviewer "Review plan"

# Create corrected plan based on feedback

# PHASE 2: Implementation
# Implement based on corrected plan
# Write tests

# PHASE 2: Implementation Review ← DON'T SKIP THIS
claude task code-review-specialist "Review implementation in e2e/helpers.ts"

# Address review findings
# Make corrections

# Pattern Codification (if new patterns emerged)
claude task pattern-codifier "Codify patterns from this review session"

# Commit everything together
git add .
git commit -m "feat: implement feature X with comprehensive review

- Phase 1: Plan reviewed by 3 specialists
- Phase 2: Implementation reviewed by code-review-specialist
- Addressed data completeness findings
- Codified review patterns to docs/"
```

### Success Metrics:

**Before Pattern (TODO_012 Initial Implementation):**
- ❌ Shipped incomplete validation (27/41 tables = 66% coverage)
- ❌ 14 tables not validated
- ❌ Tests showed false positive ("✅ all tables present")
- ❌ Would have degraded silently as schema evolved

**After Pattern (TODO_012 After Review):**
- ✅ Code review caught issue before merge
- ✅ All 41 tables now validated (100% coverage)
- ✅ Documentation added for maintenance
- ✅ Future schema additions have clear process

**Prevention Value:**
- Prevents shipping code with data completeness bugs
- Catches issues testing can't reveal
- Validates implementation correctness, not just behavior
- Ensures reference lists stay synchronized with sources

### Related Patterns:

- [Data Completeness Validation Pattern](#) (08_TESTING_PATTERNS.md) - How to document reference lists
- [Maintenance Documentation Pattern](#) (01_TYPESCRIPT_PATTERNS.md) - How to structure maintenance instructions
- [Pattern Codification Guide](PATTERN_CODIFICATION_GUIDE.md) - When and how to extract patterns

*Source: TODO_012 implementation - Code review by agent abacedd caught 34% coverage gap*
*Added: 2026-01-06*

---

## Code Review Checklist

**Before Requesting Implementation Review:**
- [ ] Plan reviewed (if applicable)
- [ ] Code implemented
- [ ] Tests written and passing
- [ ] Type safety validated (TypeScript compiles)
- [ ] Linter passing (ESLint)
- [ ] Pre-commit hooks passing

**During Implementation Review:**
- [ ] Data completeness verified
- [ ] Reference lists audited against source of truth
- [ ] Coverage gaps identified
- [ ] Maintenance documentation included
- [ ] Edge cases considered
- [ ] Security implications reviewed

**After Implementation Review:**
- [ ] Critical findings addressed
- [ ] Medium/low findings documented (if deferred)
- [ ] Re-review completed (if significant changes)
- [ ] Pattern codification completed (if applicable)
- [ ] Ready to commit

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Code Review Workflow section
- [PATTERN_CODIFICATION_GUIDE.md](PATTERN_CODIFICATION_GUIDE.md) - Pattern extraction workflow
- [08_TESTING_PATTERNS.md](08_TESTING_PATTERNS.md) - Testing patterns
- [01_TYPESCRIPT_PATTERNS.md](01_TYPESCRIPT_PATTERNS.md) - TypeScript patterns

---

**Maintained By:** PriceCompare Development Team
**Next Review:** 2026-02-06
