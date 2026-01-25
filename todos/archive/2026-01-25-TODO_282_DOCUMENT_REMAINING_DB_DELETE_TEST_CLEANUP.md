# TODO 282: Document Remaining db.delete() Test Cleanup Patterns

**Priority**: P3 (Low)
**Estimated Time**: 15 minutes
**Status**: Completed
**Completed Date**: 2026-01-25
**Source**: Pre-commit WARNING 18 (2026-01-25)

## Problem Statement

Pre-commit hook flags `db.delete()` in test files as a warning. TODO 235 addressed most cases, but a few remain undocumented in `price-drop-detection.test.ts`.

### Remaining Violations

```
server/services/__tests__/price-drop-detection.test.ts:77
server/services/__tests__/price-drop-detection.test.ts:379
server/services/__tests__/price-drop-detection.test.ts:407
```

## Solution

Add `// NOTE:` comments explaining why `db.delete()` is intentional (vs TRUNCATE CASCADE):

```typescript
// NOTE: db.delete() with WHERE clause is intentional - deleting trigger-created
// notification preferences to test specific user scenarios
await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
```

## Implementation Checklist

- [x] Add `// NOTE:` comment at line 77 (helper function cleanup) - Added 3-line comment
- [x] Verify line 379 has visible comment (may need adjustment) - Added 3-line comment (now at line 380)
- [x] Add `// NOTE:` comment at line 407 (if needed) - Added 3-line comment (now at line 411)
- [x] Run pre-commit to verify warnings are suppressed - TypeScript and ESLint checks pass, all 9 tests pass

## Context

- **TODO 235** (archived): Already addressed most test cleanup antipatterns
- **Why db.delete() here**: User-scoped cleanup for testing specific notification scenarios
- **Why not TRUNCATE**: Need to preserve other test data, only delete specific user's records

## References

- `todos/archive/2026-01-16-TODO_235_TEST_CLEANUP_ANTIPATTERNS.md`
- `docs/08_TESTING_PATTERNS.md#test-database-cleanup`

---

**Created by**: Production Readiness Audit Follow-up
**Creation Date**: 2026-01-25
