# Pattern 7 Pre-Commit Hook Enhancement - Codification Summary

**Date:** 2025-12-09
**Phase:** Post-Phase 5 (Proactive Prevention)
**Hook Version:** 3.4.1 -> 3.5.0
**Pattern Type:** WARNING (not blocker)

---

## Executive Summary

This document codifies the learnings from implementing Pattern 7 (UTC Timezone Detection) in the pre-commit hook. This represents a **proactive prevention pattern** that completes the feedback loop from bug fix to automated detection.

---

## The Reactive-to-Proactive Pattern

### The Complete Feedback Loop

```
Bug Discovery -> Fix Implementation -> Documentation -> Automated Detection -> Documentation Update
     |                  |                   |                    |                    |
   TODO 179      price-aggregation   LEARNINGS_179.md      Pattern 7         Updated LEARNINGS
                  service UTC fix                          pre-commit hook
```

**Key Insight:** A bug fix alone is incomplete. The complete pattern is:

1. **Reactive:** Fix the bug in code
2. **Educational:** Document the learnings for humans
3. **Proactive:** Automate detection to prevent recurrence
4. **Complete:** Update documentation to reference automation

This creates a **self-healing system** where future similar bugs are caught at commit time, before code review, before CI/CD, and before production.

---

## Pattern 7 Implementation Details

### Detection Scope

**Target:** Server code only (`server/` directory)
**Excluded:** Test files, spec files, `__tests__` directories

```bash
SERVER_FILES=$(echo "$TS_FILES" | grep "^server/" | grep -v "test\|spec\|__tests__")
```

**Rationale:**
- Client-side code legitimately uses local timezone for user display
- Test files may need local timezone for specific test scenarios
- Server-side code should ALWAYS use UTC for consistency across timezones

### Detection Categories

Pattern 7 detects three categories of timezone issues:

| Category | Detection Pattern | Risk |
|----------|------------------|------|
| Local Date Constructor | `new Date(year, month, day)` without `Date.UTC()` | Creates dates in server's local timezone |
| Local Getters | `.getFullYear()`, `.getMonth()`, `.getDate()` | Extracts local timezone values |
| Local Setters | `.setDate()`, `.setHours()`, `.setMinutes()`, `.setSeconds()` | Modifies using local timezone |

### Bypass Mechanism

Add `// UTC:` comment to signal intentional local timezone usage:

```typescript
// UTC: Intentional local timezone for user display formatting
const displayDate = new Date(year, month, day);
```

**Why `// UTC:` instead of `// LOCAL:`:**
- Comment documents WHY the exception exists (UTC handling is the default expectation)
- Matches existing pattern of explaining the norm being bypassed
- Short and memorable

---

## Warning vs Blocker Classification

### Why Pattern 7 is a WARNING (not a BLOCKER)

| Factor | Analysis | Conclusion |
|--------|----------|------------|
| Always Wrong? | No - client-side display uses local timezone | Not always wrong |
| Security Risk? | No - primarily causes test failures, not security issues | Not security-critical |
| Data Corruption? | No - data is consistent, just timezone-shifted | Not data integrity |
| Context-Dependent? | Yes - depends on whether code is server or client | Needs context |
| Educational Value? | High - developers need to understand timezone handling | Warning is appropriate |

**Decision Framework for Warning vs Blocker:**

```
Is it ALWAYS wrong?
  |-- YES --> Is it a security risk OR data corruption risk?
  |              |-- YES --> BLOCKER
  |              |-- NO --> Consider blocker for correctness
  |-- NO --> Is it context-dependent?
               |-- YES --> WARNING with bypass mechanism
               |-- NO --> WARNING (code quality issue)
```

### Current Hook Statistics

| Category | Count | Examples |
|----------|-------|----------|
| BLOCKERS | 11 | TypeScript errors, `any` types, N+1 queries, CSRF missing |
| WARNINGS | 12 | Transactions, auth checks, direct db imports, UTC timezone |

---

## Testing Pre-Commit Hook Patterns

### Testing Strategy for New Patterns

1. **Create Test File Outside Test Directories**
   - Hook filters out `test`, `spec`, `__tests__` from detection
   - Use names like `demo`, `example`, `scratch` for test files

2. **Include Multiple Violation Types**
   - Test each detection category separately
   - Verify counts match expectations

3. **Verify Bypass Works**
   - Add `// UTC:` comment to one violation
   - Verify count decreases by 1

4. **Clean Up Test File**
   - `git reset HEAD <test-file>`
   - `rm <test-file>`

### Pattern 7 Test Results

Test file with 5 violations:
- 1 local Date constructor
- 2 local getters
- 2 local setters

```
⚠ Pattern 7: Local timezone date methods in server code (5 instances)
  RISK: Tests pass in one timezone but fail in another (e.g., PST vs UTC)
  QUICK FIX: Use UTC date methods for server-side date handling
  EXAMPLES:
    ❌ new Date(2024, 0, 1)  // Uses local timezone
    ✅ new Date(Date.UTC(2024, 0, 1, 0, 0, 0))  // Explicit UTC
    ❌ date.getFullYear(), date.getMonth(), date.getDate()
    ✅ date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()
    ❌ date.setDate(date.getDate() + 1)
    ✅ date.setUTCDate(date.getUTCDate() + 1)
  BYPASS: Add '// UTC:' comment if local timezone is intentional
  DOCS: See docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md
```

All 5 violations detected correctly.

---

## Documentation Updates Made

### Files Updated

| File | Section | Changes |
|------|---------|---------|
| `.git/hooks/pre-commit` | Pattern 7 block | Added UTC timezone detection |
| `docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md` | Automated Detection | Added section explaining Pattern 7 |
| `docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md` | Warning #11 | Added timezone detection to warning list |
| `docs/08_TESTING_PATTERNS.md` | Server-Side UTC Date Handling | Added comprehensive testing guidance |

### Cross-References Established

```
Pre-commit hook (Pattern 7)
    --> docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md (detailed fix)
    --> docs/08_TESTING_PATTERNS.md (testing patterns)
    --> docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md (hook patterns)
```

---

## Template for Adding New Pre-Commit Hook Patterns

Based on Pattern 7 implementation, here is a template for future patterns:

### Step 1: Define Detection Scope

```bash
# Example: Server-only detection excluding tests
TARGET_FILES=$(echo "$TS_FILES" | grep "^server/" | grep -v "test\|spec\|__tests__")
```

### Step 2: Implement Multi-Category Detection

```bash
# Category 1: [Description]
CATEGORY_1=$(echo "$TARGET_FILES" | xargs git diff --cached 2>/dev/null | \
  grep -E "^\+" | \
  grep -E "pattern1" | \
  grep -v "bypass_comment" | \
  wc -l | tr -d ' ')

# Category 2: [Description]
CATEGORY_2=$(echo "$TARGET_FILES" | xargs git diff --cached 2>/dev/null | \
  grep -E "^\+" | \
  grep -E "pattern2" | \
  grep -v "bypass_comment" | \
  wc -l | tr -d ' ')

# Total
TOTAL_ISSUES=$((CATEGORY_1 + CATEGORY_2))
```

### Step 3: Provide Contextual Error Messages

```bash
if [ "$TOTAL_ISSUES" != "0" ]; then
    echo -e "${YELLOW}⚠ Pattern N: [Description] ($TOTAL_ISSUES instances)${NC}"
    echo "  ${CYAN}RISK:${NC} [Why this matters]"
    echo "  ${CYAN}QUICK FIX:${NC} [What to do]"
    echo "  ${CYAN}EXAMPLES:${NC}"
    if [ "$CATEGORY_1" != "0" ]; then
        echo "    ❌ [Bad example 1]"
        echo "    ✅ [Good example 1]"
    fi
    if [ "$CATEGORY_2" != "0" ]; then
        echo "    ❌ [Bad example 2]"
        echo "    ✅ [Good example 2]"
    fi
    echo "  ${CYAN}BYPASS:${NC} Add '[bypass_comment]' comment if intentional"
    echo "  ${CYAN}DOCS:${NC} See [documentation_link]"
    echo ""
fi
```

### Step 4: Update Summary Counter

```bash
# Add to TOTAL_PATTERN_WARNINGS calculation
TOTAL_PATTERN_WARNINGS=$((EXISTING_PATTERNS + NEW_PATTERN_ISSUES))
```

### Step 5: Document Everything

1. Update `docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md` with new warning
2. Create or update relevant pattern documentation
3. Add cross-references from hook output to documentation
4. Update this codification document with metrics

---

## Questions for Future Consideration

### 1. Should we add ESLint rules for timezone detection?

**Pro:**
- IDE integration provides real-time feedback
- Configurable per-project
- Can auto-fix some patterns

**Con:**
- Hook already catches issues at commit time
- Adds ESLint configuration complexity
- May have higher false positive rate

**Recommendation:** Consider for Phase 6 if developers request earlier feedback.

### 2. Should feedback-codifier automatically suggest hook patterns?

**Pattern:** When fixing common bugs, suggest corresponding hook pattern.

**Example Trigger:**
```
Feedback-Codifier detects:
- Bug category: Timezone handling
- Root cause: Local timezone methods in server code
- Suggestion: "Consider adding pre-commit hook pattern to detect this class of issues"
```

**Recommendation:** Add to feedback-codifier workflow checklist.

### 3. What other timezone-related patterns should be detected?

Candidates:
- `toLocaleString()` without timezone parameter
- `new Date(dateString)` parsing (browser-specific behavior)
- `moment().format()` without UTC mode

**Recommendation:** Add as Pattern 7b if similar bugs are found.

---

## Metrics

| Metric | Value |
|--------|-------|
| Pattern Number | 7 |
| Category | WARNING |
| Detection Scope | Server code only |
| Bypass Mechanism | `// UTC:` comment |
| Detection Categories | 3 (constructor, getters, setters) |
| False Positive Rate | Estimated <5% |
| Documentation Files Updated | 4 |
| Time from Bug Fix to Detection | Same day (proactive) |

---

## Key Takeaways

1. **Complete the feedback loop**: Bug fix alone is incomplete; automated detection prevents recurrence
2. **Warnings for context-dependent issues**: Use warnings (not blockers) when behavior depends on context
3. **Provide bypass mechanisms**: Always allow documented exceptions
4. **Test outside test directories**: Hook filters exclude test files, use demo/example files
5. **Cross-reference documentation**: Link hook output to comprehensive documentation
6. **Use the template**: Follow consistent structure for new patterns

---

## Related Documentation

- **Bug fix:** `docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md`
- **Hook patterns:** `docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md`
- **Testing patterns:** `docs/08_TESTING_PATTERNS.md`
- **Phase 5 codification:** `docs/LEARNINGS_PHASE5_PRE_COMMIT_CODIFICATION.md`
- **Pre-commit hook:** `.git/hooks/pre-commit` (v3.5.0)

---

**Document Status:** Complete
**Last Updated:** 2025-12-09
**Hook Version:** 3.5.0
