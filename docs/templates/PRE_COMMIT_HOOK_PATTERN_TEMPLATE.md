# Pre-Commit Hook Pattern Template

**Purpose:** This template provides a standardized structure for adding new patterns to the pre-commit hook.
**Location:** `.git/hooks/pre-commit`
**Current Version:** 3.5.0

---

## Quick Reference

### Before Adding a New Pattern

1. [ ] Determine if pattern should be BLOCKER or WARNING
2. [ ] Define detection scope (all files, server only, client only, etc.)
3. [ ] Identify bypass mechanism (comment pattern)
4. [ ] Create documentation for the pattern
5. [ ] Test with real violations

### Decision: BLOCKER vs WARNING

| Use BLOCKER when... | Use WARNING when... |
|---------------------|---------------------|
| Always wrong (no valid exceptions) | Context-dependent |
| Security vulnerability | Code quality issue |
| Data corruption risk | Performance issue |
| Type safety violation | Architecture deviation |

---

## Implementation Template

### Step 1: Define Detection Scope

```bash
# Pattern N: [DESCRIPTION] (NEW - YYYY-MM-DD)
# [Brief explanation of what this detects and why]
# See: docs/[RELEVANT_DOCUMENTATION].md

# Option A: All TypeScript files
TARGET_FILES="$TS_FILES"

# Option B: Server code only (excluding tests)
TARGET_FILES=$(echo "$TS_FILES" | grep "^server/" | grep -v "test\|spec\|__tests__")

# Option C: Client code only
TARGET_FILES=$(echo "$TS_FILES" | grep "^client/")

# Option D: Specific file types
TARGET_FILES=$(echo "$TS_FILES" | grep "routes/\|services/")
```

### Step 2: Implement Detection Logic

```bash
if [ -n "$TARGET_FILES" ]; then
    # Category 1: [Description]
    CATEGORY_1=$(echo "$TARGET_FILES" | xargs git diff --cached 2>/dev/null | \
      grep -E "^\+" | \
      grep -E "[REGEX_PATTERN_1]" | \
      grep -v "[BYPASS_COMMENT]" | \
      wc -l | tr -d ' ')

    # Category 2: [Description] (if applicable)
    CATEGORY_2=$(echo "$TARGET_FILES" | xargs git diff --cached 2>/dev/null | \
      grep -E "^\+" | \
      grep -E "[REGEX_PATTERN_2]" | \
      grep -v "[BYPASS_COMMENT]" | \
      wc -l | tr -d ' ')

    # Calculate total
    TOTAL_ISSUES=$((CATEGORY_1 + CATEGORY_2))
fi
```

### Step 3: Output Warning/Blocker Message

**For WARNINGS:**

```bash
if [ "$TOTAL_ISSUES" != "0" ]; then
    echo -e "${YELLOW}WARNING Pattern N: [Short description] ($TOTAL_ISSUES instances)${NC}"
    echo "  ${CYAN}RISK:${NC} [Why this matters - what can go wrong]"
    echo "  ${CYAN}QUICK FIX:${NC} [One-line summary of the fix]"
    echo "  ${CYAN}EXAMPLES:${NC}"
    if [ "$CATEGORY_1" != "0" ]; then
        echo "    [Bad example 1]"
        echo "    [Good example 1]"
    fi
    if [ "$CATEGORY_2" != "0" ]; then
        echo "    [Bad example 2]"
        echo "    [Good example 2]"
    fi
    echo "  ${CYAN}BYPASS:${NC} Add '[BYPASS_COMMENT]' comment if intentional"
    echo "  ${CYAN}DOCS:${NC} See docs/[RELEVANT_DOCUMENTATION].md"
    echo ""
fi
```

**For BLOCKERS:**

```bash
if [ "$TOTAL_ISSUES" != "0" ]; then
    echo -e "${RED}BLOCKER N: [Short description] detected${NC}"
    echo "  ${RED}RISK:${NC} [Security/correctness risk]"
    echo "  ${CYAN}FIX:${NC} [How to fix it]"
    echo "  ${CYAN}EXAMPLE:${NC}"
    echo "    [Bad example]"
    echo "    [Good example]"
    echo "  ${CYAN}DOCS:${NC} See docs/[RELEVANT_DOCUMENTATION].md"
    echo ""
    SECURITY_ISSUES=1
fi
```

### Step 4: Update Summary Counter

```bash
# For WARNINGS: Add to TOTAL_PATTERN_WARNINGS
TOTAL_PATTERN_WARNINGS=$((FLOATING_PROMISES + MISUSED_PROMISES + ... + NEW_PATTERN_ISSUES))

# For BLOCKERS: Set SECURITY_ISSUES=1 (already blocks commit)
```

---

## Complete Example: Pattern 7 (UTC Timezone)

```bash
# Pattern 7: Local timezone date methods in server code (NEW - 2025-12-09)
# Detects local timezone Date methods that should use UTC equivalents
# See: docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md
SERVER_FILES=$(echo "$TS_FILES" | grep "^server/" | grep -v "test\|spec\|__tests__")
if [ -n "$SERVER_FILES" ]; then
    # Check for local timezone Date constructor: new Date(year, month, day)
    LOCAL_DATE_CONSTRUCTOR=$(echo "$SERVER_FILES" | xargs git diff --cached 2>/dev/null | grep -E "^\+" | grep -E "new Date\([0-9]+,\s*[0-9]+" | grep -v "Date.UTC" | grep -v "// UTC:" | wc -l | tr -d ' ')

    # Check for local timezone getters: .getFullYear(), .getMonth(), .getDate()
    LOCAL_GETTERS=$(echo "$SERVER_FILES" | xargs git diff --cached 2>/dev/null | grep -E "^\+" | grep -E "\.(getFullYear|getMonth|getDate)\(" | grep -v "getUTC" | grep -v "// UTC:" | wc -l | tr -d ' ')

    # Check for local timezone setters: .setDate(), .setHours(), .setMinutes()
    LOCAL_SETTERS=$(echo "$SERVER_FILES" | xargs git diff --cached 2>/dev/null | grep -E "^\+" | grep -E "\.(setDate|setHours|setMinutes|setSeconds)\(" | grep -v "setUTC" | grep -v "// UTC:" | wc -l | tr -d ' ')

    TIMEZONE_ISSUES=$((LOCAL_DATE_CONSTRUCTOR + LOCAL_GETTERS + LOCAL_SETTERS))

    if [ "$TIMEZONE_ISSUES" != "0" ]; then
        echo -e "${YELLOW}WARNING Pattern 7: Local timezone date methods in server code ($TIMEZONE_ISSUES instances)${NC}"
        echo "  ${CYAN}RISK:${NC} Tests pass in one timezone but fail in another (e.g., PST vs UTC)"
        echo "  ${CYAN}QUICK FIX:${NC} Use UTC date methods for server-side date handling"
        echo "  ${CYAN}EXAMPLES:${NC}"
        if [ "$LOCAL_DATE_CONSTRUCTOR" != "0" ]; then
            echo "    new Date(2024, 0, 1)  // Uses local timezone"
            echo "    new Date(Date.UTC(2024, 0, 1, 0, 0, 0))  // Explicit UTC"
        fi
        if [ "$LOCAL_GETTERS" != "0" ]; then
            echo "    date.getFullYear(), date.getMonth(), date.getDate()"
            echo "    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()"
        fi
        if [ "$LOCAL_SETTERS" != "0" ]; then
            echo "    date.setDate(date.getDate() + 1)"
            echo "    date.setUTCDate(date.getUTCDate() + 1)"
        fi
        echo "  ${CYAN}BYPASS:${NC} Add '// UTC:' comment if local timezone is intentional"
        echo "  ${CYAN}DOCS:${NC} See docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md"
        echo ""
    fi
else
    TIMEZONE_ISSUES=0
fi
```

---

## Testing New Patterns

### 1. Create Test File (Outside Test Directories)

```bash
# Create a file with violations
cat > server/demo-pattern-violation.ts << 'EOF'
// Test file for Pattern N
const violation1 = [VIOLATING_CODE];
const violation2 = [VIOLATING_CODE];
const bypass = [VIOLATING_CODE]; // [BYPASS_COMMENT]
EOF
```

### 2. Stage and Test

```bash
git add server/demo-pattern-violation.ts
git commit -m "test" 2>&1 | grep -i "Pattern N"
# Should show: "Pattern N: ... (2 instances)" (bypass reduces count)
```

### 3. Verify Error Message Quality

- [ ] Clear risk explanation
- [ ] Actionable fix instructions
- [ ] Code examples (bad/good)
- [ ] Bypass mechanism documented
- [ ] Documentation link provided

### 4. Clean Up

```bash
git reset HEAD server/demo-pattern-violation.ts
rm server/demo-pattern-violation.ts
```

---

## Documentation Checklist

When adding a new pattern:

1. [ ] **Pre-commit hook updated** (`.git/hooks/pre-commit`)
2. [ ] **Hook version incremented** (major for new features: 3.5 -> 3.6)
3. [ ] **LEARNINGS document created** (`docs/LEARNINGS_PATTERN_N_*.md`)
4. [ ] **Pattern documentation updated** (`docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md`)
5. [ ] **Relevant pattern file updated** (e.g., `docs/02_DATABASE_PATTERNS.md`)
6. [ ] **CLAUDE.md updated** if project-wide impact

---

## Maintenance Notes

### Version Numbering

- **Patch (3.5.0 -> 3.5.1):** Bug fixes, pattern refinements, false positive reduction
- **Minor (3.5.0 -> 3.6.0):** New warning patterns
- **Major (3.5.0 -> 4.0.0):** New blocker patterns, significant behavior changes

### Updating Existing Patterns

1. Test changes with existing violation scenarios
2. Verify bypass mechanisms still work
3. Update documentation if behavior changes
4. Increment patch version

### Deprecating Patterns

1. Add deprecation notice in hook output
2. Document reason for deprecation
3. Keep pattern active for 2-4 weeks
4. Remove pattern and update version

---

**Template Version:** 1.0
**Created:** 2025-12-09
**Based On:** Pattern 7 implementation
