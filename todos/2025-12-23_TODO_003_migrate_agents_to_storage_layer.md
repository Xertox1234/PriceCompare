# TODO 003: Migrate All Agents to Storage Layer Pattern

**Priority**: P1 (ARCHITECTURE - CRITICAL TECH DEBT)
**File(s)**:
- `server/agents/base-agent.ts` (Lines 3-4, 77-99)
- `server/agents/coordinator-agent.ts` (Lines 4-5, 151-249, 410-431)
- `server/agents/discovery-agent.ts` (Line 2, 124-140)
- `server/agents/search-agent.ts` (Line 2, 111-132)
- `server/agents/extraction-agent.ts` (Lines 5-6, 309-381)
- `server/agents/monitoring-agent.ts` (Line 3, 137-272)
- `server/agents/affiliate-agent.ts` (Line 2, 89-145)

**Estimated Time**: 8-12 hours
**Status**: Not Started

## Problem Statement

**All 7 agent files** directly import and use `db` from `'../db'`, violating the core storage layer architecture pattern documented in CLAUDE.md:

> "ALL database access flows through `server/storage.ts`. Never query `db` directly from routes/services."
>
> "Exception: `price-aggregation-service.ts` only (documented justification for transaction context passing)."

**Code Evidence**:
```typescript
// base-agent.ts:3-4
// TODO: Migrate to storage layer - direct db access violates architecture pattern (see CLAUDE.md)
import { db } from '../db';

// coordinator-agent.ts:4-5
// TODO: Migrate to storage layer - direct db access violates architecture pattern (see CLAUDE.md)
import { db } from '../db';
```

**Impact**:
- ❌ Breaks caching abstraction layer
- ❌ Prevents transaction context passing
- ❌ Makes agent unit testing nearly impossible
- ❌ Creates tight coupling to database implementation
- ❌ Violates single responsibility principle
- ❌ Inconsistent with rest of codebase (routes already use storage)

**Review Finding Reference**: Architecture Strategist - Critical Issue #1

## Root Cause

The storage layer (`server/storage/domains/agent-storage.ts`) was created **after** the agents were initially developed. The agents have TODO comments acknowledging this debt but the migration was never completed.

**Timeline Analysis**:
1. Agents built first with direct `db` access
2. Storage layer pattern added to project
3. Routes migrated to storage layer ✅
4. Agents left with direct `db` access ❌ (4 TODO comments added)

## Solution Approach

1. Use existing `server/storage/domains/agent-storage.ts` (already implements needed methods)
2. Replace all `db.select()`, `db.insert()`, `db.update()` calls with storage methods
3. Remove `import { db } from '../db'` from all agent files
4. Add `import { storage } from '../storage'` instead
5. Update tests to mock storage layer instead of database

**Good news**: Storage layer already exists! Just need to use it.

## Implementation Steps

### Step 1: Verify Storage Layer Completeness

- [ ] Review `server/storage/domains/agent-storage.ts`
- [ ] Confirm all agent database operations have corresponding storage methods
- [ ] Add any missing storage methods (estimated: 2-3 new methods needed)

**Existing Storage Methods** (from agent-storage.ts):
- `createAgentSession()`
- `updateAgentSession()`
- `getRecentAgentSessions()`
- `createScrapingJob()`
- `updateScrapingJob()`
- `getPendingScrapingJobs()`
- `getTrendingProductsByStatus()`
- `updateTrendingProduct()`

**Missing Methods to Add**:
- `createTrendingProduct()`
- `getPriceMonitoringOffers()`
- `updateProductOffer()`

### Step 2: Migrate BaseAgent (Foundation)

- [ ] Remove `import { db } from '../db'` from `base-agent.ts:3`
- [ ] Add `import { storage } from '../storage'` at line 3
- [ ] Replace `db.insert(agentSessions)` with `storage.createAgentSession()` (line 55-59)
- [ ] Replace `db.update(agentSessions)` with `storage.updateAgentSession()` (line 85-91, 96-97)
- [ ] Test: `npm test server/__tests__/agents/base-agent.test.ts`

### Step 3: Migrate CoordinationAgent

- [ ] Remove `import { db } from '../db'` from `coordinator-agent.ts:5`
- [ ] Add `import { storage } from '../storage'`
- [ ] Replace trend product queries (lines 151-155):
  ```typescript
  // BEFORE
  const trendingProductsList = await db.select()
    .from(trendingProducts)
    .where(eq(trendingProducts.status, 'discovered'))

  // AFTER
  const trendingProductsList = await storage.getTrendingProductsByStatus('discovered', limit)
  ```
- [ ] Replace job queries (lines 410-414):
  ```typescript
  // BEFORE
  const pendingJobs = await db.select()
    .from(scrapingJobs)
    .where(and(eq(scrapingJobs.status, 'pending'), ...))

  // AFTER
  const pendingJobs = await storage.getPendingScrapingJobs(maxConcurrentJobs)
  ```
- [ ] Replace product creation (lines 234-242):
  ```typescript
  // BEFORE
  const [createdProduct] = await db.insert(products).values(productData).returning();

  // AFTER
  const createdProduct = await storage.createProductFromTrendingProduct(trendingProduct)
  ```

### Step 4: Migrate DiscoveryAgent

- [ ] Remove `import { db } from '../db'` from `discovery-agent.ts:2`
- [ ] Add `import { storage } from '../storage'`
- [ ] Replace trending product inserts (lines 124-140):
  ```typescript
  // BEFORE
  await db.insert(trendingProducts).values(trendData)

  // AFTER
  await storage.createTrendingProduct(trendData)
  ```

### Step 5: Migrate SearchAgent

- [ ] Remove `import { db } from '../db'` from `search-agent.ts:2`
- [ ] Add `import { storage } from '../storage'`
- [ ] Replace search query inserts (lines 111-132):
  ```typescript
  // BEFORE
  await db.insert(searchQueries).values(queryData)

  // AFTER
  await storage.createSearchQuery(queryData)
  ```

### Step 6: Migrate ExtractionAgent

- [ ] Remove `import { db } from '../db'` from `extraction-agent.ts:5-6`
- [ ] Add `import { storage } from '../storage'`
- [ ] Replace product offer operations (lines 309-381)

### Step 7: Migrate MonitoringAgent

- [ ] Remove `import { db } from '../db'` from `monitoring-agent.ts:3`
- [ ] Add `import { storage } from '../storage'`
- [ ] Replace price monitoring queries (lines 137-272)

### Step 8: Migrate AffiliateAgent

- [ ] Remove `import { db } from '../db'` from `affiliate-agent.ts:2`
- [ ] Add `import { storage } from '../storage'`
- [ ] Replace affiliate link operations (lines 89-145)

### Step 9: Remove TODO Comments

- [ ] Delete TODO comment from `base-agent.ts:3-4`
- [ ] Delete TODO comment from `coordinator-agent.ts:4-5`
- [ ] Verify no `db` imports remain: `grep -r "import.*db.*from.*'\.\.\/db'" server/agents/`

### Step 10: Update Tests

- [ ] Update all agent tests to mock `storage` instead of `db`
- [ ] Verify all tests pass: `npm test server/__tests__/agents/`
- [ ] Add integration tests for storage layer methods

## Technical Details

**Example Migration Pattern**:

```typescript
// ❌ BEFORE (Direct db access)
import { db } from '../db';
import { agentSessions } from '@shared/schema';

async initialize(): Promise<void> {
  const sessionData: InsertAgentSession = {
    agentType: this.config.type,
    sessionId: this.sessionId,
    status: 'active',
  };

  const [session] = await db
    .insert(agentSessions)
    .values(sessionData)
    .returning();

  this.dbSessionId = session.id;
}

// ✅ AFTER (Storage layer)
import { storage } from '../storage';

async initialize(): Promise<void> {
  const sessionData = {
    agentType: this.config.type,
    sessionId: this.sessionId,
    status: 'active' as const,
  };

  const session = await storage.createAgentSession(sessionData);
  this.dbSessionId = session.id;
}
```

**Benefits After Migration**:
1. ✅ Compliance with architecture pattern
2. ✅ Automatic caching for agent queries (via storageCache)
3. ✅ Easier unit testing (mock storage instead of db)
4. ✅ Consistent with routes (all use storage)
5. ✅ Transaction context can be passed
6. ✅ Single source of truth for database access

## Checklist

- [ ] Storage layer has all needed methods
- [ ] BaseAgent migrated and tested
- [ ] CoordinationAgent migrated and tested
- [ ] DiscoveryAgent migrated and tested
- [ ] SearchAgent migrated and tested
- [ ] ExtractionAgent migrated and tested
- [ ] MonitoringAgent migrated and tested
- [ ] AffiliateAgent migrated and tested
- [ ] All `import { db }` removed from agent files
- [ ] TODO comments removed
- [ ] All agent tests pass
- [ ] Integration tests added
- [ ] ESLint passes
- [ ] TypeScript compiles
- [ ] Documentation updated

## Success Criteria

- [ ] **Zero `db` imports in agent files**:
  ```bash
  grep -r "import.*{.*db.*}.*from.*'\.\.\/db'" server/agents/
  # Expected: No results found ✅
  ```

- [ ] **All agents use storage layer**:
  ```bash
  grep -r "import.*{.*storage.*}.*from.*'\.\.\/storage'" server/agents/
  # Expected: 7 files (all agents) ✅
  ```

- [ ] **All agent tests pass**:
  ```bash
  npm test server/__tests__/agents/
  # Expected: 100% pass rate ✅
  ```

- [ ] **TypeScript + ESLint clean**:
  ```bash
  npm run check && npm run lint
  # Expected: No errors ✅
  ```

- [ ] **Agents work in production** (after deployment)

## Migration Safety

**Risk Level**: MEDIUM (breaking change but with clear rollback)

**Mitigation**:
1. Migrate one agent at a time
2. Test each agent thoroughly before moving to next
3. Keep git commits small (one agent per commit)
4. Run full test suite after each migration
5. Deploy to staging first

**Rollback Plan**:
If issues arise, revert specific agent commits:
```bash
git revert <commit-hash>  # Revert specific agent migration
```

## Testing Strategy

**Unit Tests**:
```typescript
import { describe, test, expect, vi } from 'vitest';
import { storage } from '../storage';

vi.mock('../storage', () => ({
  storage: {
    createAgentSession: vi.fn(),
    updateAgentSession: vi.fn(),
    // ... other methods
  }
}));

describe('BaseAgent - Storage Layer Integration', () => {
  test('creates agent session via storage layer', async () => {
    const agent = new BaseAgent({ name: 'Test', type: 'test', ...config });
    await agent.initialize();

    expect(storage.createAgentSession).toHaveBeenCalledWith({
      agentType: 'test',
      sessionId: expect.any(String),
      status: 'active',
    });
  });
});
```

**Integration Tests**:
```typescript
describe('Agent Storage Integration', () => {
  test('coordinator can fetch trending products via storage', async () => {
    const products = await storage.getTrendingProductsByStatus('discovered', 10);
    expect(products).toBeInstanceOf(Array);
  });

  test('base agent can create and update sessions', async () => {
    const session = await storage.createAgentSession({...});
    await storage.updateAgentSession(session.id, { status: 'completed' });
    const updated = await storage.getAgentSessionById(session.id);
    expect(updated.status).toBe('completed');
  });
});
```

---

**Related Documentation**:
- `docs/02_DATABASE_PATTERNS.md` - Storage layer pattern
- `docs/ARCHITECTURE.md` - System architecture overview
- `server/storage/README.md` - Storage layer documentation

**Review Reference**: Comprehensive Code Review - Critical Blocker #2
**Pattern Compliance Impact**: 85% → 95%
