# TODO 013: Fix Pre-Existing CI Test Failures

**Priority**: P2
**File(s)**:
- `server/websocket/__tests__/reconnection.test.ts`
- `client/src/hooks/__tests__/use-watchlist-updates.test.tsx`
- Various other test files

**Estimated Time**: 3-4 hours
**Status**: Not Started

## Problem Statement

CI test suite is failing with 70 failed tests across multiple test files. These are **pre-existing failures** on the `add_scraping` base branch that are blocking all PRs, even though the new code is working correctly.

**Current Status**:
- Test Files: 9 failed | 66 passed (76)
- Tests: 70 failed | 1,659 passed (1,742)
- **Pass Rate**: 95.2% (good, but failures block CI)

**Impact**:
- Blocks PR merges even when new code is clean
- Makes it difficult to identify regressions from new changes
- Reduces confidence in CI system

## Root Cause

Analysis shows these failures are NOT introduced by recent PRs:

1. **WebSocket Reconnection Tests** (4 failures)
   - `should restore subscriptions after reconnection`
   - `should receive events after reconnection`
   - `should transition through correct connection states`
   - `should not reconnect after intentional disconnect`
   - **Likely Cause**: Timing issues or WebSocket server state

2. **Client Hook Tests** (1 failure)
   - `should invalidate queries on watch list update`
   - **Error**: Expected `/api/watchlists` but got `/api/watchlists/1`
   - **Likely Cause**: Query key invalidation logic changed

3. **Other Failures** (65 failures)
   - Need detailed investigation

**Evidence these are pre-existing**:
- PR #183 (Phase 2 API) doesn't touch WebSocket or client hook files
- All Phase 2 tests (59/59) passing
- git diff shows no changes to failing test files

## Solution Approach

### Phase 1: Investigation (1 hour)
1. Run full test suite locally to reproduce failures
2. Check git history to identify when tests started failing
3. Group failures by root cause
4. Prioritize by impact

### Phase 2: Fix High-Priority Failures (2-3 hours)
1. Fix WebSocket reconnection tests (likely timing issues)
2. Fix client hook query invalidation test
3. Verify fixes don't introduce regressions

### Phase 3: Document & Prevent (30 min)
1. Document findings in `LEARNINGS_TODO_013.md`
2. Add CI job to prevent test failures from merging
3. Update contributing guidelines

## Implementation Steps

### Step 1: Reproduce Locally

```bash
# Run full test suite
npm test 2>&1 | tee test-output.log

# Check which tests are failing
grep "FAIL" test-output.log

# Run specific failing tests
npm test -- server/websocket/__tests__/reconnection.test.ts
npm test -- client/src/hooks/__tests__/use-watchlist-updates.test.tsx
```

- [ ] Run full test suite and capture output
- [ ] Identify all failing test files
- [ ] Group failures by likely root cause
- [ ] Document failure patterns

### Step 2: Fix WebSocket Reconnection Tests

```bash
# Run WebSocket tests with verbose output
npm test -- server/websocket/__tests__/reconnection.test.ts --reporter=verbose
```

**Likely Issues**:
- Timing assumptions (need `await waitFor()` with longer timeouts)
- WebSocket server state not cleaned between tests
- Event listeners not properly cleaned up

- [ ] Identify specific assertion failures
- [ ] Check for timing issues (increase timeouts if needed)
- [ ] Verify WebSocket server cleanup in `afterEach`
- [ ] Add missing `await` statements
- [ ] Run tests 10x to ensure stability

### Step 3: Fix Client Hook Query Invalidation

The test expects:
```typescript
invalidateQueries({ queryKey: ['/api/watchlists'] })
```

But gets:
```typescript
invalidateQueries({ queryKey: ['/api/watchlists/1'] })
```

**Fix Options**:
1. Update test expectation to match actual behavior
2. Fix hook to invalidate both specific and list queries
3. Check if this is a regression from recent changes

- [ ] Read `use-watchlist-updates.test.tsx` test code
- [ ] Read actual hook implementation
- [ ] Determine correct behavior (specific vs list invalidation)
- [ ] Update hook or test accordingly
- [ ] Verify related hooks follow same pattern

### Step 4: Investigate Remaining 65 Failures

- [ ] Group by test file
- [ ] Identify common patterns
- [ ] Prioritize by impact (user-facing vs internal)
- [ ] Create separate TODOs if multiple unrelated issues

### Step 5: Verify Fixes

```bash
# Run full test suite
npm test

# Should see improved pass rate
# Target: 100% passing (1,742/1,742)

# Run CI checks locally
npm run lint
npm run check
npm run test:e2e
```

- [ ] All unit tests passing
- [ ] All E2E tests passing
- [ ] No new failures introduced
- [ ] TypeScript compilation successful
- [ ] ESLint passing

## Technical Details

### WebSocket Test Pattern
```typescript
// Typical WebSocket test structure
describe('WebSocket Reconnection', () => {
  let wsServer: WebSocketServer;
  let client: WebSocket;

  beforeEach(async () => {
    wsServer = await startWebSocketServer();
    client = new WebSocket('ws://localhost:3001');
    // Wait for connection
    await waitFor(() => client.readyState === WebSocket.OPEN);
  });

  afterEach(async () => {
    // CRITICAL: Clean up properly
    client.close();
    await wsServer.close();
    // Wait for cleanup
    await waitFor(() => client.readyState === WebSocket.CLOSED);
  });

  it('should reconnect after disconnect', async () => {
    // Simulate disconnect
    client.close();

    // Wait for disconnect
    await waitFor(() => client.readyState === WebSocket.CLOSED);

    // Attempt reconnect
    client = new WebSocket('ws://localhost:3001');

    // Wait with longer timeout for flaky tests
    await waitFor(
      () => client.readyState === WebSocket.OPEN,
      { timeout: 5000 } // Increased from default 1000ms
    );

    expect(client.readyState).toBe(WebSocket.OPEN);
  });
});
```

### Query Invalidation Pattern
```typescript
// In use-watchlist-updates hook
const updateWatchList = useMutation({
  mutationFn: updateWatchListApi,
  onSuccess: (data, variables) => {
    // Invalidate both specific item AND list
    queryClient.invalidateQueries({
      queryKey: ['/api/watchlists', variables.id]
    });
    queryClient.invalidateQueries({
      queryKey: ['/api/watchlists']
    });
  },
});
```

## Checklist

- [ ] Investigation complete - all failures documented
- [ ] WebSocket tests fixed and stable (10x runs)
- [ ] Client hook tests fixed
- [ ] High-impact failures addressed
- [ ] Full test suite passing (100%)
- [ ] CI checks passing
- [ ] Learnings documented
- [ ] Contributing guidelines updated

## Success Criteria

- [ ] **CI Status**: All CI checks passing ✅
- [ ] **Test Pass Rate**: 100% (1,742/1,742 tests passing)
- [ ] **Stability**: Tests pass 10 consecutive times locally
- [ ] **No Regressions**: Existing passing tests still pass
- [ ] **Documentation**: Learnings captured in `LEARNINGS_TODO_013.md`
- [ ] **Prevention**: CI configured to block merges with failing tests

## Context

**Related PRs**:
- PR #183 - Phase 2 Agent API (blocked by these failures despite clean code)

**Related Issues**:
- These failures exist on `add_scraping` base branch
- Not introduced by recent PRs
- Affect all contributors

**Business Impact**:
- Medium - Blocks feature delivery
- Low urgency - Workaround exists (review test output manually)
- High importance - Reduces CI reliability

---

## Notes

### Test Failure Summary (2025-12-28)

```
Test Files  9 failed | 66 passed (76)
Tests       70 failed | 1,659 passed (1,742)
Duration    385.91s
```

**Breakdown**:
- WebSocket reconnection: 4 failures
- Client hooks: 1 failure
- Other: 65 failures (needs investigation)

### Investigation Log

_Add notes here as you investigate_

**2025-12-28**: Created TODO after PR #183 blocked by pre-existing failures
- Confirmed failures not from PR #183 changes
- Phase 2 API tests (59/59) all passing
- Need to fix base branch before additional PRs can merge cleanly
