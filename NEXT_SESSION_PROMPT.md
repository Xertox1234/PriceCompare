# Next Session: Continue API Testing Migration

## Quick Start Prompt

```
Continue the API testing migration. Migrate the next medium-priority test suite to use standardized validation helpers.

Current Progress:
- ✅ 6/15+ test suites completed (99.1% passing - 218/220 tests)
- ✅ All high-priority core routes COMPLETED
- ✅ 18+ production bugs fixed and patterns codified
- ✅ Forum storage bugs FIXED (44/44 tests passing)

Next Targets (Medium Priority):
- price-history-routes.test.ts
- notification-routes.test.ts
- smart-alerts-routes.test.ts

Context Files:
- TODO_API_TESTING_MIGRATION.md - Migration status and patterns
- docs/API_TESTING_PATTERNS.md - Testing patterns reference
- server/__tests__/helpers/response-validators.ts - Validation helpers

Goal: Continue migrating medium-priority feature routes and maintain 99%+ test pass rate.
```

---

## Recent Accomplishments (2025-11-28)

### Forum Storage Bug Fixes - COMPLETED ✅

Fixed 3 critical production bugs in forum storage layer:

1. **Stale Object Reference (postCount)**
   - Fix: Use `.returning()` on UPDATE and reassign variable
   - Impact: Prevents data corruption

2. **Slug VARCHAR Overflow**
   - Fix: Truncate slug to MAX_SLUG_LENGTH (250 chars)
   - Impact: Handles long titles gracefully

3. **SERIALIZABLE Transaction Retry**
   - Fix: Check PostgreSQL error codes (40001, 40P01)
   - Impact: Auto-retry on serialization failures

**Result**: 44/44 tests passing (100%) ✅

**Patterns Codified**: All 3 bugs documented in 4 reviewer agents

**Archive**: `docs/archive/SESSION_2025-11-28_FORUM_STORAGE_BUGS.md`

---

## Current Status

### Completed Test Suites (6/15+)

#### High Priority (Core Routes) - ALL COMPLETE ✅

1. ✅ **alert-routes.test.ts** - 29/30 passing (96.7%)
   - 1 test skipped (Drizzle bug)

2. ✅ **retailer-routes.test.ts** - 18/18 passing (100%)

3. ✅ **product-routes.test.ts** - 42/42 passing (100%)

4. ✅ **auth-routes.test.ts** - 53/54 passing (98.1%)
   - 1 test skipped (edge case)

5. ✅ **watchlist-routes.test.ts** - 32/32 passing (100%)

#### Medium Priority (Feature Routes)

6. ✅ **forum-routes.test.ts** - 44/44 passing (100%) ✅
   - All 3 production bugs FIXED
   - Patterns codified

### Statistics

- **Test Suites**: 6/15+ completed (40%)
- **Total Tests**: 218/220 passing (99.1%)
- **Tests Skipped**: 2 (Drizzle bug + edge case)
- **Bugs Fixed**: 18+ production issues
- **Patterns Codified**: All learnings in reviewer agents

---

## Next Targets

### Medium Priority (Feature Routes)

Pick one of these for the next session:

1. **price-history-routes.test.ts** - Historical price data
   - Expected: Price snapshots, aggregations, trends
   - Watch for: N+1 queries, date handling, time zones

2. **notification-routes.test.ts** - User notifications
   - Expected: Create, read, mark as read, delete
   - Watch for: Authorization, pagination, real-time updates

3. **smart-alerts-routes.test.ts** - Advanced price alerting
   - Expected: Complex alert conditions, triggers
   - Watch for: Business logic complexity, edge cases

### Recommended Order

Start with **notification-routes.test.ts** because:

- Simpler CRUD operations
- Well-defined authorization patterns
- Good foundation for smart-alerts (which builds on notifications)

---

## Migration Checklist (For Next Session)

### 1. Preparation

- [ ] Read the test file to understand current structure
- [ ] Read the corresponding route file to understand endpoints
- [ ] Check storage layer for data access patterns
- [ ] Review any service layer logic

### 2. Code Changes

- [ ] Import validation helpers
- [ ] Replace `response.body` with `expectSuccessResponse()`
- [ ] Add TypeScript types to validation calls
- [ ] Check for variable naming conflicts
- [ ] Verify status codes (201 for creation, etc.)
- [ ] Add CSRF protection checks for mutations

### 3. Testing

- [ ] Run specific test file
- [ ] Fix failures (expectations vs behavior)
- [ ] Watch for N+1 queries
- [ ] Check authorization patterns
- [ ] Verify all tests pass

### 4. Documentation

- [ ] Update TODO_API_TESTING_MIGRATION.md
- [ ] Document any bugs discovered
- [ ] Add patterns to docs/API_TESTING_PATTERNS.md
- [ ] Codify learnings into reviewer agents

---

## Common Issues (Reference)

### Variable Naming Conflicts ⚠️

```typescript
import { notifications } from '@shared/schema';

// ❌ WRONG - Shadows import
const notifications = expectSuccessResponse(...);

// ✅ CORRECT - Use distinct name
const result = expectSuccessResponse(...);
```

### Status Codes

- **201** - Creation (POST)
- **200** - Success (GET, PUT)
- **204** - No content (DELETE)
- **400** - Validation errors
- **401** - Unauthorized
- **404** - Not found

### Authorization Pattern

```typescript
// Don't reveal resource existence to unauthorized users
sendError(res, 'Resource not found or unauthorized', 404);
```

### N+1 Query Prevention

```typescript
// ❌ BAD
for (const item of items) {
  const related = await db.select()...; // N queries!
}

// ✅ GOOD
const related = await db.select()
  .where(inArray(table.id, itemIds)); // 1 query
```

---

## Success Criteria

For the next test suite migration:

- [ ] All tests passing (95%+ pass rate)
- [ ] No N+1 queries introduced
- [ ] No variable naming conflicts
- [ ] Status codes correct
- [ ] Authorization properly tested
- [ ] Bugs documented and fixed
- [ ] Patterns codified

---

## Resources

### Documentation

- `TODO_API_TESTING_MIGRATION.md` - Current status
- `docs/API_TESTING_PATTERNS.md` - Testing patterns
- `docs/DATABASE_PATTERNS.md` - Database patterns
- `docs/SECURITY_PATTERNS.md` - Security patterns
- `docs/archive/SESSION_2025-11-28_FORUM_STORAGE_BUGS.md` - Latest session

### Helper Files

- `server/__tests__/helpers/response-validators.ts` - Validation helpers
- `server/utils/api-response.ts` - Response helpers
- `server/utils/validation-helpers.ts` - Input validation

### Reviewer Agents

- `.claude/agents/code-review-specialist.md`
- `.claude/agents/database-engineer.md`
- `.claude/agents/typescript-reviewer.md`
- `.claude/knowledge/storage-review-patterns.md`

---

Ready to continue the API testing migration! 🚀
