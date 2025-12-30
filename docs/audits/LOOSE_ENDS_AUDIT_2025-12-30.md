# Loose Ends Audit - December 30, 2025

## Summary

This audit identifies unfinished work, pending TODOs, and incomplete plan files in the PriceCompare codebase. Items are categorized by priority and action needed.

---

## 🔴 Active TODOs in Code (6 items)

### 1. Server-Side TODOs

| File | Line | TODO | Priority | Recommendation |
|------|------|------|----------|----------------|
| [server/agents/affiliate-agent.ts](../server/agents/affiliate-agent.ts#L350) | 350 | `// TODO: Add retailer breakdown` | P3 | Implement or convert to issue |
| [server/test/basic-auth.test.ts](../server/test/basic-auth.test.ts#L332) | 332 | `// TODO: Implement setUserActive() method` | P3 | Blocked on missing storage method - create issue |
| [server/ai/output-validation.ts](../server/ai/output-validation.ts#L309) | 309 | TypeScript union type workaround note | P4 | Leave as-is (awaiting TS improvement) |

### 2. Client-Side TODOs

| File | Line | TODO | Priority | Recommendation |
|------|------|------|----------|----------------|
| [client/src/hooks/use-community.ts](../client/src/hooks/use-community.ts#L593) | 593 | `highPriorityCount: 0, // TODO: Calculate from product watches` | P2 | Implement calculation or remove field |
| [client/src/components/price-history/__tests__/ChartEnhancements.test.tsx](../client/src/components/price-history/__tests__/ChartEnhancements.test.tsx#L5) | 5-7 | Skipped test suite (Recharts rendering issues) | P3 | Move to E2E testing or fix mocks |

### 3. E2E TODOs

| File | Line | TODO | Priority | Recommendation |
|------|------|------|----------|----------------|
| [e2e/notifications.spec.ts](../e2e/notifications.spec.ts#L725) | 725 | WebSocket real-time notification testing (Phase 2.2) | P3 | Phase 2.2 work - track in roadmap |

---

## 🟡 Outdated Plan Files (2 items)

### 1. NEXT_SESSION_PROMPT.md (Root)

**File**: [NEXT_SESSION_PROMPT.md](../../NEXT_SESSION_PROMPT.md)

**Issue**: Outdated - references API testing migration from November 2025

**Status in file**: Shows 6/15+ test suites migrated

**Recommendation**: Archive or update with current priorities

### 2. NEXT_SESSION_PROMPT_2025-12-19.md (docs/)

**File**: [docs/NEXT_SESSION_PROMPT_2025-12-19.md](../docs/NEXT_SESSION_PROMPT_2025-12-19.md)

**Issue**: Historical file from 12/19 - E2E enablement is complete

**Recommendation**: Move to docs/archive/

---

## 🟢 Completed Plans Still in Root (2 items)

### 1. CONTINUATION_PROMPT.md (todos/)

**File**: [todos/CONTINUATION_PROMPT.md](../todos/CONTINUATION_PROMPT.md)

**Status**: Shows **PROJECT 100% COMPLETE** - All 13 features across 4 phases

**Recommendation**: Archive to todos/archive/ (mission accomplished!)

### 2. MIGRATION_AFFILIATE_AGENT.md (Root)

**File**: [MIGRATION_AFFILIATE_AGENT.md](../../MIGRATION_AFFILIATE_AGENT.md)

**Status**: ✅ Complete (marked in file)

**Recommendation**: Move to docs/archive/

---

## 🔵 Test Suites Pending Migration (docs/testing/TODO_API_TESTING_MIGRATION.md)

**File**: [docs/testing/TODO_API_TESTING_MIGRATION.md](../docs/testing/TODO_API_TESTING_MIGRATION.md)

**Completed**: 6/15+ test suites (99.1% passing)

**Remaining Medium Priority**:
- [ ] price-history-routes.test.ts
- [ ] notification-routes.test.ts
- [ ] smart-alerts-routes.test.ts
- [ ] affiliate-routes.test.ts
- [ ] admin-routes.test.ts

**Remaining Low Priority**:
- [ ] scraping-routes.test.ts
- [ ] monitoring-routes.test.ts
- [ ] community-routes.test.ts
- [ ] And 5+ more specialized routes

**Recommendation**: Consider if migration is still needed or close as "good enough" at 99.1%

---

## 🟣 Skipped E2E Tests (By Design)

These are intentionally skipped and documented:

| Spec File | Reason | Status |
|-----------|--------|--------|
| price-alerts.spec.ts | Product selection test - by design | Keep skipped |
| price-analytics.spec.ts | 15+ features not implemented (time range, volatility, etc.) | Backlog items |
| ChartEnhancements.test.tsx | Recharts test environment issues | E2E alternative needed |

---

## 🟤 Documentation Notes (Low Priority)

### Not Yet Implemented Features (tracked in code)

1. **Stock status in notification processor** ([notification-processor.ts#L80](../server/jobs/notification-processor.ts#L80))
   - Currently defaults to 'in_stock'
   - Future enhancement to fetch from product offers

2. **Enhanced search header retailer lookup** ([enhanced-search-header.tsx#L140](../client/src/components/enhanced-search-header.tsx#L140))
   - Comment notes proper implementation needed

---

## Recommended Actions

### Immediate (Today)

1. **Archive completed plans**:
   - Move `MIGRATION_AFFILIATE_AGENT.md` to `docs/archive/`
   - Move `todos/CONTINUATION_PROMPT.md` to `todos/archive/`
   - Move `docs/NEXT_SESSION_PROMPT_2025-12-19.md` to `docs/archive/`

2. **Update or archive root NEXT_SESSION_PROMPT.md**

### Short-term (This Week)

3. **Decision on API testing migration**: Close TODO or continue?
4. **Create GitHub issues** for:
   - `setUserActive()` storage method
   - `highPriorityCount` calculation

### Backlog

5. **Retailer breakdown** in affiliate-agent.ts
6. **WebSocket real-time tests** (Phase 2.2)
7. **Price analytics features** (time range selector, volatility, etc.)

---

## Test Health Summary

```
Unit Tests:  1694 passed | 64 skipped (70 files)
E2E Tests:   115+ passed (most recent run)
Coverage:    99.1% passing (218/220 migrated tests)
```

**Overall Health**: ✅ Excellent - no critical loose ends
