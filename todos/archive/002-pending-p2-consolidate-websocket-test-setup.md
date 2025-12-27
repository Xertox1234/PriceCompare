---
status: rejected
priority: p2
issue_id: "002"
tags: [testing, code-quality, duplication, websocket]
dependencies: []
rejection_date: 2025-12-26
---

# Consolidate WebSocket Test Setup (16 Duplications)

## Problem Statement

WebSocket test files contain **16 instances of duplicated test setup code** (21-32 lines each, 153-275 tokens), resulting in 500+ lines of identical boilerplate across 5 test files. This violates DRY principles and makes test maintenance difficult.

**Impact:** MEDIUM - Not a bug, but increases maintenance burden and risk of inconsistent test setups.

## Findings

**From Pattern Recognition Analysis (2025-12-26):**

**Affected files:**
- `server/websocket/__tests__/reconnection.test.ts`
- `server/websocket/__tests__/load.test.ts`
- `server/websocket/__tests__/integration.test.ts`
- `server/websocket/__tests__/handlers.test.ts`
- `server/websocket/__tests__/error-handling.test.ts`

**Duplication pattern:**
- WebSocket mock initialization (21-32 lines per file)
- Similar beforeEach/afterEach setup
- Identical server/client setup logic
- 153-275 tokens duplicated per instance

**Existing infrastructure:**
- `/server/websocket/__tests__/test-utils.ts` exists but not fully utilized
- Could extract all shared setup to this file

**Code duplication metrics (jscpd):**
- Total duplications found: 25 code clones
- WebSocket test setup: 16 instances (64% of duplications)
- Severity: Medium

## Proposed Solutions

### Option 1: Extract to test-utils.ts (Recommended)

**Approach:** Move all duplicated WebSocket setup/teardown logic to shared `test-utils.ts` file with reusable helper functions.

**Implementation:**
```typescript
// server/websocket/__tests__/test-utils.ts
export function createMockWebSocket() {
  // Common WebSocket mock setup
}

export function setupWebSocketTest() {
  beforeEach(() => {
    // Shared setup logic
  });

  afterEach(() => {
    // Shared teardown logic
  });
}
```

**Pros:**
- Reduces codebase by 500+ lines
- Single source of truth for test setup
- Easier to update setup logic across all tests
- Improves test readability

**Cons:**
- Requires careful refactoring to ensure no test behavior changes
- Need to verify all tests still pass after extraction

**Effort:** 2-4 hours

**Risk:** Low (comprehensive test suite validates changes)

---

### Option 2: Create Test Factory Functions

**Approach:** Create factory functions for common test scenarios while keeping minimal setup in each file.

**Pros:**
- More flexible than full extraction
- Tests can customize setup as needed
- Gradual migration possible

**Cons:**
- May not eliminate all duplication
- Partial solution

**Effort:** 1-2 hours

**Risk:** Very Low

---

### Option 3: Test Fixture System

**Approach:** Implement Vitest fixture system for shared test context.

**Pros:**
- Modern Vitest-native approach
- Type-safe fixtures
- Composable test contexts

**Cons:**
- Larger refactor
- Learning curve for fixtures
- Overkill for this specific issue

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

**REJECTED - Do Not Implement**

After parallel review by three specialized agents (DHH Rails, Code Simplicity, Kieran TypeScript), unanimous verdict: **This refactoring should NOT be done.**

**Reasons:**
1. **Technical impossibility**: Vitest hoisting requires `vi.mock()` at module scope - cannot be extracted to functions
2. **Misleading metrics**: Actual duplication is ~165 lines, not 500+ (claim includes already-extracted utilities)
3. **Test clarity**: Explicit mocks make tests self-documenting and easier to debug
4. **Minimal benefit**: Net savings ~55 lines after abstraction overhead
5. **Wrong optimization**: Tests should prioritize debuggability over DRY

**Alternative actions taken:**
- Fix type safety issues in test-utils.ts (remove `any` defaults)
- Delete dead code: `setupWebSocketMocks()` (lines 369-403, unused)
- Document pattern in `docs/08_TESTING_PATTERNS.md`

## Technical Details

**Affected files:**
- `server/websocket/__tests__/reconnection.test.ts` - 5 duplications
- `server/websocket/__tests__/load.test.ts` - 3 duplications
- `server/websocket/__tests__/integration.test.ts` - 4 duplications
- `server/websocket/__tests__/handlers.test.ts` - 2 duplications
- `server/websocket/__tests__/error-handling.test.ts` - 2 duplications
- `server/websocket/__tests__/test-utils.ts` - **Target for consolidation**

**Duplication details:**
- Lines per duplication: 21-32
- Tokens per duplication: 153-275
- Total duplicated lines: 500+ (estimate)

**Test coverage impact:**
- No change to coverage expected
- All tests should continue passing
- May improve test reliability through consistency

## Resources

- **Pattern Analysis:** Code Review 2025-12-26 (Pattern Recognition Specialist)
- **jscpd output:** 25 total duplications, 16 in WebSocket tests
- **Existing utilities:** `server/websocket/__tests__/test-utils.ts`
- **Testing patterns:** `docs/08_TESTING_PATTERNS.md`

## Acceptance Criteria

- [ ] Duplicated setup code reduced by >90% (from 500+ to <50 lines)
- [ ] All WebSocket tests continue to pass
- [ ] `test-utils.ts` contains shared setup functions
- [ ] Each test file imports from test-utils
- [ ] No test behavior changes (verify with git diff output)
- [ ] Code review confirms DRY principles followed
- [ ] Pre-commit hooks pass

## Work Log

### 2025-12-26 - Parallel Review & Rejection Decision

**By:** Three Specialized Review Agents (DHH Rails, Code Simplicity, Kieran TypeScript)

**Review Process:**
- Launched three agents in parallel via `/plan_review` command
- Each agent independently analyzed the proposed refactoring
- All three reached unanimous verdict: REJECT

**DHH Rails Reviewer Findings:**
- "Masturbatory Test Engineering" - solving non-problem
- test-utils.ts (444 lines) already extracts the RIGHT utilities
- `setupWebSocketMocks()` function exists but has ZERO usage (dead code)
- Actual duplication: ~135 lines (27 lines × 5 files), not 500+
- **vi.mock() MUST be at module scope** - cannot extract due to Vitest hoisting
- Test clarity beats test DRY - explicit mocks aid debugging

**Code Simplicity Reviewer Findings:**
- Real duplication: ~165 lines (not 500+ as claimed)
- Net savings after abstraction overhead: ~55 lines
- Trade-off analysis: Save 55 lines, lose clarity, add debugging complexity
- Optimizing for wrong metric (LOC instead of readability)
- Test code ≠ production code: DRY often hurts test comprehension
- Each test needs different mock behaviors (error-handling vs load vs integration)

**Kieran TypeScript Reviewer Findings:**
- The "duplication" is **40 lines of intentional test isolation**
- Vitest hoisting mechanics make consolidation fundamentally impossible
- Each test file requires DIFFERENT mock behaviors for its scenarios
- **Found real issues to fix:**
  - 6+ instances of `any` types in test-utils.ts (lines 109, 113, 120, 140, 176, 177)
  - Dead code: `setupWebSocketMocks()` (lines 369-403) should be deleted
- Test code prioritizes debuggability over DRY

**Unanimous Conclusions:**
1. **Technical impossibility**: Cannot extract vi.mock() due to hoisting
2. **Misleading metrics**: jscpd doesn't understand test patterns
3. **Current state is good**: test-utils.ts already extracts right things
4. **Tests need flexibility**: Each file mocks differently based on test scenarios
5. **Abstraction tax**: Proposed solutions add complexity for minimal gain

**Decision:** REJECT all three proposed options. Mark as "Won't Fix - Duplication is Intentional"

**Learnings:**
- jscpd metrics can mislead when tool doesn't understand framework requirements
- Vitest hoisting makes mock consolidation technically impossible
- Test clarity > DRY: Explicit mocks = better debugging experience
- test-utils.ts already has excellent pattern: extract utilities, keep mocks local
- The "duplication" is beneficial repetition for test independence

### 2025-12-26 - Initial Discovery

**By:** Pattern Recognition Specialist Agent (Code Review)

**Actions:**
- Ran jscpd code duplication analysis
- Identified 16 WebSocket test setup duplications
- Analyzed existing test-utils.ts structure
- Estimated 500+ lines of duplication impact
- Proposed 3 solution approaches

**Learnings:**
- test-utils.ts exists but underutilized
- WebSocket tests have consistent setup patterns
- Simple extraction should preserve all test behavior
- jscpd found 25 total duplications, 64% in WebSocket tests

**Note:** Initial analysis overestimated duplication impact and didn't account for Vitest hoisting constraints

## Notes

- **Status:** REJECTED after parallel review by three specialized agents
- **Severity:** Not a real problem - metrics were misleading
- **Key insight:** Test code prioritizes debuggability over DRY
- **Technical constraint:** Vitest hoisting requires vi.mock() at module scope
- **Current state:** Already optimal - test-utils.ts extracts utilities, mocks stay local
- **Alternative actions:** Fix type safety (`any` removal) and delete dead code instead
- **Lesson learned:** Static analysis tools (jscpd) can misidentify intentional test patterns as problematic duplication
