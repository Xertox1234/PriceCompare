---
status: pending
priority: p2
issue_id: "002"
tags: [testing, code-quality, duplication, websocket]
dependencies: []
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

**To be filled during triage.**

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

## Notes

- **Severity:** Medium (quality issue, not functional bug)
- **Quick win:** Reduces codebase size significantly with low risk
- **Maintenance benefit:** Future WebSocket test setup changes only need 1 edit
- Consider applying similar pattern to other test file groups if found
