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

## 🟡 Outdated Plan Files (0 items)

> **Updated 2025-01-02**: All items below have already been archived.

### ~~1. NEXT_SESSION_PROMPT.md (Root)~~ ✅ ALREADY CLEANED UP

**Status**: File no longer exists in root - already removed

### ~~2. NEXT_SESSION_PROMPT_2025-12-19.md (docs/)~~ ✅ ALREADY ARCHIVED

**Location**: `docs/archive/NEXT_SESSION_PROMPT_2025-12-19.md`

---

## 🟢 Completed Plans Still in Root (0 items)

> **Updated 2025-01-02**: All items below have already been archived.

### ~~1. CONTINUATION_PROMPT.md (todos/)~~ ✅ ALREADY ARCHIVED

**Location**: `todos/archive/CONTINUATION_PROMPT.md`

### ~~2. MIGRATION_AFFILIATE_AGENT.md (Root)~~ ✅ ALREADY ARCHIVED

**Location**: `docs/archive/MIGRATION_AFFILIATE_AGENT.md`

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

### ~~Immediate (Today)~~ ✅ ALREADY DONE

> **Updated 2025-01-02**: Archive tasks were already completed.

1. ~~Archive completed plans~~ - All already in archive folders
2. ~~Update or archive root NEXT_SESSION_PROMPT.md~~ - Already removed

### Short-term (This Week)

3. **Decision on API testing migration**: Close TODO or continue?
4. **Create GitHub issues** for:
   - `setUserActive()` storage method - See `todos/TODO_002_STORAGE_SET_USER_ACTIVE.md`
   - `highPriorityCount` calculation - See `todos/TODO_003_HIGH_PRIORITY_COUNT_CALCULATION.md`

### Backlog

5. **Retailer breakdown** in affiliate-agent.ts - See `todos/TODO_001_AFFILIATE_RETAILER_BREAKDOWN.md`
6. **WebSocket real-time tests** (Phase 2.2) - See `todos/TODO_004_WEBSOCKET_REALTIME_NOTIFICATIONS.md`
7. **Chart enhancement tests** - See `todos/TODO_005_CHART_ENHANCEMENTS_TESTS.md`
8. **Price analytics features** (time range selector, volatility, etc.) - See `todos/TODO_007_PRICE_ANALYTICS_FEATURES.md`

### TODO Files Created (2025-01-02)

| TODO File | Priority | Description |
|-----------|----------|-------------|
| `todos/TODO_001_AFFILIATE_RETAILER_BREAKDOWN.md` | P3 | Add retailer breakdown to affiliate agent |
| `todos/TODO_002_STORAGE_SET_USER_ACTIVE.md` | P3 | Implement setUserActive() storage method |
| `todos/TODO_003_HIGH_PRIORITY_COUNT_CALCULATION.md` | P2 | Calculate highPriorityCount from watches |
| `todos/TODO_004_WEBSOCKET_REALTIME_NOTIFICATIONS.md` | P3 | WebSocket real-time notification E2E tests |
| `todos/TODO_005_CHART_ENHANCEMENTS_TESTS.md` | P3 | Fix skipped chart tests |
| `todos/TODO_006_API_TESTING_MIGRATION_COMPLETION.md` | P4 | Complete API test migration (optional) |
| `todos/TODO_007_PRICE_ANALYTICS_FEATURES.md` | P3-P4 | Price analytics features backlog |

---

## Test Health Summary

```
Unit Tests:  1694 passed | 64 skipped (70 files)
E2E Tests:   115+ passed (most recent run)
Coverage:    99.1% passing (218/220 migrated tests)
```

**Overall Health**: ✅ Excellent - no critical loose ends
