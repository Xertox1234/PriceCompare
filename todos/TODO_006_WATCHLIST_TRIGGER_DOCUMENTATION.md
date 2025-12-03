# TODO 006: Add Migration Line Reference to Trigger Documentation

**Priority**: P3 - Low
**Status**: Not Started
**Estimated Time**: 10 minutes
**Category**: Documentation

## Overview

Add migration file line reference to database trigger documentation in `server/__tests__/storage-watchlist.test.ts` for easier reference.

## Current Documentation

Lines 44-47:
```typescript
/**
 * NOTE: Database trigger auto-creates default watchlist on user insert
 * - Trigger: trigger_create_default_watch_list
 * - Creates watchlist with name="My Watches", isDefault=true
 * - We delete this in beforeEach cleanup to isolate tests
 */
```

## Recommended Enhancement

Add migration file reference:
```typescript
/**
 * NOTE: Database trigger auto-creates default watchlist on user insert
 * - Trigger: trigger_create_default_watch_list
 * - Migration: migrations/0008_add_watch_lists.sql (lines XX-YY)
 * - Creates watchlist with name="My Watches", isDefault=true
 * - We delete this in beforeEach cleanup to isolate tests
 */
```

## Files to Modify

- `server/__tests__/storage-watchlist.test.ts` (lines 44-47)
- **Source**: `migrations/0008_add_watch_lists.sql` (to find line numbers)

## Implementation Steps

1. Open migration file to find trigger definition:
   ```bash
   grep -n "trigger_create_default_watch_list" migrations/0008_add_watch_lists.sql
   ```

2. Note the line number range where the trigger is defined

3. Update documentation comment in test file:
   ```typescript
   /**
    * NOTE: Database trigger auto-creates default watchlist on user insert
    * - Trigger: trigger_create_default_watch_list
    * - Migration: migrations/0008_add_watch_lists.sql (lines XX-YY)
    * - Creates watchlist with name="My Watches", isDefault=true
    * - We delete this in beforeEach cleanup to isolate tests
    */
   ```

4. Verify documentation is accurate:
   ```bash
   cat migrations/0008_add_watch_lists.sql | sed -n 'XX,YYp'
   ```

## Success Criteria

- [ ] Migration file name and line numbers added to documentation
- [ ] Line numbers are accurate (verified by viewing those lines)
- [ ] Documentation helps developers quickly find trigger definition
- [ ] No changes to test logic or behavior

## Related Context

From code review of TODO_003 fix - adding line references makes it easier for developers to locate the actual trigger code when debugging.
