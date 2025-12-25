# TODO 003: Migrate All Agents to Storage Layer Pattern

**Priority**: P1 (ARCHITECTURE - CRITICAL TECH DEBT)
**Estimated Time**: 2-3 hours
**Status**: ✅ COMPLETED (2025-12-24)
**Completion Notes**: All 7 agents migrated to storage layer pattern. 15 new storage methods added. All type errors resolved. Zero direct DB access violations remaining. Commit: 804b1a9

## Problem Statement

All 7 agent files directly import and use `db` from `'../db'`, violating the storage layer architecture pattern documented in CLAUDE.md:

> "ALL database access flows through `server/storage.ts`. Never query `db` directly from routes/services."

**Impact**:
- ❌ Breaks caching abstraction layer
- ❌ Prevents transaction context passing
- ❌ Makes agent unit testing difficult (must mock database vs storage interface)
- ❌ Inconsistent with rest of codebase (routes already use storage)

**Files Affected**:
- `server/agents/base-agent.ts` (~4 db calls)
- `server/agents/coordinator-agent.ts` (~11 db calls)
- `server/agents/discovery-agent.ts` (~1 db call)
- `server/agents/search-agent.ts` (~1 db call)
- `server/agents/extraction-agent.ts` (~6 db calls)
- `server/agents/monitoring-agent.ts` (~4 db calls)
- `server/agents/affiliate-agent.ts` (~3 db calls)

**Total**: ~30 call sites to migrate

---

## Solution: 3-Step Migration

### Step 1: Implement Missing Storage Methods (60 min)

**Review `server/storage/domains/agent-storage.ts` and add missing methods:**

#### 1.1 Transaction-Safe Product Creation (CRITICAL)
```typescript
/**
 * Creates product from trending product with atomic transaction
 * Prevents race conditions and ensures data consistency
 */
async createProductFromTrendingProduct(
  trendingProduct: TrendingProduct,
  offerData: InsertProductOffer[]
): Promise<Product> {
  return await this.db.transaction(async (tx) => {
    const [product] = await tx.insert(products).values({
      name: trendingProduct.name,
      category: trendingProduct.category,
      // ... other fields
    }).returning();

    await tx.insert(productOffers).values(
      offerData.map(offer => ({ ...offer, productId: product.id }))
    );

    await tx.update(trendingProducts)
      .set({ status: 'processed', productId: product.id })
      .where(eq(trendingProducts.id, trendingProduct.id));

    return product;
  });
}
```

#### 1.2 Price Monitoring Queries (CRITICAL - Preserve JOINs)
```typescript
/**
 * Gets stale offers with relations using efficient JOIN
 * WARNING: Must use db.query API to preserve JOIN efficiency
 */
async getPriceMonitoringOffers(
  cutoffTime: Date,
  limit: number
): Promise<ProductOfferWithRelations[]> {
  return await this.db.query.productOffers.findMany({
    where: lt(productOffers.lastLinkCheck, cutoffTime),
    with: { product: true, retailer: true }, // Efficient JOIN
    limit
  });
}

/**
 * Gets active price alerts with deeply nested relations
 */
async getActivePriceAlertsWithRelations(): Promise<PriceAlertWithProduct[]> {
  return await this.db.query.priceAlerts.findMany({
    where: eq(priceAlerts.isActive, true),
    with: {
      product: {
        with: {
          offers: { with: { retailer: true } }
        }
      }
    }
  });
}
```

#### 1.3 Find-or-Create Patterns (For ExtractionAgent)

**⚠️ DOMAIN BOUNDARY DECISION**: These should go in **ProductStorage**, not AgentStorage:

```typescript
// server/storage/domains/product-storage.ts (NOT agent-storage.ts)
async findOrCreateRetailer(website: string): Promise<Retailer> {
  const existing = await this.db.query.retailers.findFirst({
    where: eq(retailers.website, website)
  });
  if (existing) return existing;

  const [retailer] = await this.db.insert(retailers)
    .values({ name: website, website })
    .returning();
  return retailer;
}

async findOrCreateProduct(name: string, category?: string): Promise<Product> {
  const existing = await this.db.query.products.findFirst({
    where: eq(products.name, name)
  });
  if (existing) return existing;

  const [product] = await this.db.insert(products)
    .values({ name, category })
    .returning();
  return product;
}
```

#### 1.4 Verification Checklist
- [ ] All new methods added to appropriate domain storage
- [ ] Methods use Drizzle relational API for JOINs (not separate queries)
- [ ] Transaction-safe methods wrap multi-step operations
- [ ] Run `npm run check` (TypeScript compilation)
- [ ] Run integration tests: `npm test server/storage/`

---

### Step 2: Migrate All Agents (60 min)

**For each agent file, perform these replacements:**

1. **Replace import**:
   ```typescript
   // BEFORE
   import { db } from '../db';
   import { agentSessions, productOffers } from '@shared/schema';

   // AFTER
   import { storage } from '../storage';
   // Remove unused schema imports
   ```

2. **Replace database calls with storage equivalents**:

| Agent | Line(s) | Before | After |
|-------|---------|--------|-------|
| **base-agent** | 55-59 | `db.insert(agentSessions).values(data).returning()` | `storage.createAgentSession(data)` |
| | 85-91 | `db.update(agentSessions).set(updates).where(...)` | `storage.updateAgentSession(id, updates)` |
| **coordinator** | 151-155 | `db.select().from(trendingProducts).where(...).limit(5)` | `storage.getTrendingProductsByStatus('discovered', 5)` |
| | 178-181 | `db.update(trendingProducts).set({ status }).where(...)` | `storage.updateTrendingProduct(id, { status })` |
| | 234-242 | `db.insert(products).values(...) + db.insert(productOffers)` | `storage.createProductFromTrendingProduct(trending, offers)` |
| **monitoring** | 131-138 | `db.query.productOffers.findMany({ with: {...} })` | `storage.getPriceMonitoringOffers(cutoffTime, 50)` |
| | 221-235 | `db.query.priceAlerts.findMany({ with: {...} })` | `storage.getActivePriceAlertsWithRelations()` |
| **extraction** | 315-371 | Find-or-create retailer/product | `storage.findOrCreateRetailer(domain)` + `storage.findOrCreateProduct(name)` |

3. **Remove TODO comments**:
   - Delete "TODO: Migrate to storage layer" comments from all agent files

#### Agent Migration Checklist
- [ ] base-agent.ts
- [ ] coordinator-agent.ts
- [ ] discovery-agent.ts
- [ ] search-agent.ts
- [ ] extraction-agent.ts
- [ ] monitoring-agent.ts
- [ ] affiliate-agent.ts

---

### Step 3: Verify Migration (10 min)

```bash
# TypeScript compilation
npm run check

# All tests pass
npm test

# Verify no direct db imports remain
grep -r "import.*{.*db.*}.*from.*'\.\.\/db'" server/agents/
# Expected: No results ✅

# Verify storage imports exist
grep -r "import.*storage.*from.*'\.\.\/storage'" server/agents/
# Expected: 7 files ✅

# ESLint passes
npm run lint
```

---

## Performance Considerations

### Cache Strategy for Agents

**⚠️ CRITICAL**: Disable global cache for agent queries to prevent stale data:

```typescript
// Agents should use skipCache flag
const products = await storage.getTrendingProductsByStatus('discovered', 5, true);
```

**Why**: Agents are write-heavy and time-sensitive. Cached data causes:
- Coordinator reprocessing same products (status changes immediately after query)
- MonitoringAgent checking stale offer data
- **Cache hit rate < 5%** for agent operations

**Recommendation**: Add `skipCache` parameter to all agent storage methods or use 30-second TTL.

### Batch Update Optimization (Future Enhancement)

MonitoringAgent currently updates 50 offers sequentially:
```typescript
for (const offer of staleOffers) {
  await storage.updateProductOffer(offer.id, updates); // 50 queries
}
```

**Optimization**: Add batch update method (50x faster):
```typescript
// Future: server/storage/domains/product-storage.ts
async batchUpdateOffers(updates: Array<{ id: number; price: string; availability: string }>) {
  await this.db.execute(sql`
    UPDATE product_offers AS po
    SET price = v.price, availability = v.availability, last_link_check = NOW()
    FROM (VALUES ${updates.map(u => sql`(${u.id}, ${u.price}, ${u.availability})`)})
    AS v(id, price, availability)
    WHERE po.id = v.id
  `);
}
```

---

## Success Criteria

- [ ] Zero `import { db }` in `server/agents/` directory
- [ ] All agents import and use `storage` from `../storage`
- [ ] TypeScript compiles with zero errors
- [ ] All tests pass (100% pass rate)
- [ ] Query performance regression < 10%
- [ ] No N+1 query patterns introduced (verify with query logging)

---

## Testing Strategy

**Unit Tests**: Mock storage interface instead of database
```typescript
vi.mock('../storage', () => ({
  storage: {
    createAgentSession: vi.fn().mockResolvedValue(mockSession),
    getTrendingProductsByStatus: vi.fn().mockResolvedValue([])
  }
}));
```

**Integration Tests**: Run existing agent test suite
```bash
npm test server/__tests__/agents/
```

**Architecture Enforcement**: Add test to prevent regression
```typescript
describe('Storage Layer Architecture', () => {
  test('agents must not import db directly', () => {
    const agentFiles = glob.sync('server/agents/*.ts');
    agentFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/import.*\bdb\b.*from.*['"]\.\.\/db['"]/);
    });
  });
});
```

---

## Risk Mitigation

**Risk Level**: MEDIUM (mechanical refactor with performance considerations)

**Mitigation**:
1. ✅ Implement all storage methods BEFORE migrating agents
2. ✅ Use Drizzle relational API to preserve JOIN efficiency
3. ✅ Add transaction support for multi-step operations
4. ✅ Disable caching for agent queries
5. ✅ Run full test suite after migration
6. ✅ Monitor query performance in staging

**Rollback Plan**: Single atomic commit, easy to revert:
```bash
git revert <commit-hash>
```

---

## Benefits After Migration

1. ✅ **Architectural Consistency**: 95%+ pattern compliance across codebase
2. ✅ **Better Testing**: Mock storage interface instead of database
3. ✅ **Transaction Support**: Prevents race conditions in find-or-create patterns
4. ✅ **Future-Proofing**: Easier to swap databases or add query optimization
5. ✅ **Clear Separation**: Agents orchestrate, storage accesses data

**Performance**: +5-10% query overhead acceptable for architectural benefits.

---

**Related Documentation**:
- `docs/02_DATABASE_PATTERNS.md` - Storage layer pattern
- `ARCHITECTURE.md` - System architecture overview
- `server/storage/README.md` - Storage layer documentation

**Review Reference**: Multi-agent plan review (2025-12-23)
- Simplicity Review: 72% plan reduction recommended
- Architecture Review: Domain boundaries + transaction support
- Performance Review: Cache strategy + JOIN preservation
