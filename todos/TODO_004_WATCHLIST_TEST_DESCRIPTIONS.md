# TODO 004: Clarify Watchlist Test Descriptions

**Priority**: P3 - Low
**Status**: Not Started
**Estimated Time**: 15 minutes
**Category**: Code Quality - Test Clarity

## Overview

Improve test description clarity in `server/__tests__/storage-watchlist.test.ts` to better communicate what tests are validating.

## Current Issue

Test descriptions use "accept" which might imply validation:
```typescript
it('should accept empty name (validation is route responsibility)', ...)
it('should accept long names (validation is route responsibility)', ...)
it('should accept untrimmed names (validation is route responsibility)', ...)
```

## Recommended Change

Use "preserve" to make it clearer that storage passes data through unchanged:
```typescript
it('should preserve empty names without validation (route responsibility)', ...)
it('should preserve long names without length enforcement (route responsibility)', ...)
it('should preserve whitespace without trimming (route responsibility)', ...)
```

## Files to Modify

- `server/__tests__/storage-watchlist.test.ts` (lines 266-283)

## Implementation Steps

1. Update test description at line ~266:
   ```typescript
   it('should preserve empty names without validation (route responsibility)', async () => {
   ```

2. Update test description at line ~272:
   ```typescript
   it('should preserve long names without length enforcement (route responsibility)', async () => {
   ```

3. Update test description at line ~278:
   ```typescript
   it('should preserve whitespace without trimming (route responsibility)', async () => {
   ```

4. Run tests to verify descriptions display correctly:
   ```bash
   npm test server/__tests__/storage-watchlist.test.ts
   ```

## Success Criteria

- [ ] All 3 test descriptions updated to use "preserve" instead of "accept"
- [ ] Test descriptions clearly communicate storage layer behavior
- [ ] All tests still pass (no logic changes, only descriptions)

## Related Context

From code review of TODO_003 fix - these tests verify that storage layer does NOT validate inputs (validation is handled by Zod schemas in route layer).
