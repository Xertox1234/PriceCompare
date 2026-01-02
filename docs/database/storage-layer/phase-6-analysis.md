# Phase 6 Storage Layer Migration - Analysis

**Date:** 2025-11-24
**Branch:** refactor/storage-layer-phase-6
**Services:** 4 services (monitoring, price-drop-detection, product-discovery-fallback, advanced-search)

## Executive Summary

Phase 6 focuses on migrating 4 services with mixed complexity:
- **Simple**: product-discovery-fallback (157 lines, Drizzle query builder)
- **Medium**: price-drop-detection (427 lines, mixed queries)
- **Complex**: monitoring-service (515 lines, aggregation queries)
- **Very Complex**: advanced-search.ts (939 lines, AI/embeddings/vector search)

**Total:** ~2,037 lines of code to migrate
**Estimated Storage Methods:** 15-20 new methods

## Service Analysis

### 1. monitoring-service.ts (515 lines)

**Purpose:** Real-time system metrics dashboard (agents, jobs, cache, locks, products, health)

**Database Queries:**

1. **getAgentMetrics()** - lines 161-166
   ```typescript
   // Get recent agent sessions (last 24 hours)
   await db.select()
     .from(agentSessions)
     .where(gte(agentSessions.sessionStart, new Date(Date.now() - 24 * 60 * 60 * 1000)))
     .orderBy(desc(agentSessions.sessionStart))
     .limit(20);
   ```
   **Storage Method:** `getRecentAgentSessions(hours: number, limit: number)`

2. **getJobMetrics()** - lines 206-218
   ```typescript
   // Get recent jobs with status counts
   const [allJobs, jobCounts] = await Promise.all([
     db.select().from(scrapingJobs).orderBy(desc(scrapingJobs.createdAt)).limit(50),
     db.select({ status: scrapingJobs.status, count: count() })
       .from(scrapingJobs).groupBy(scrapingJobs.status)
   ]);
   ```
   **Storage Methods:**
   - `getRecentScrapingJobs(limit: number)`
   - `getScrapingJobStatusCounts()`

3. **getLockMetrics()** - lines 335-338
   ```typescript
   // Query active locks from job_locks table
   await db.select({ count: count() })
     .from(jobLocks)
     .where(sql`${jobLocks.expiresAt} > NOW()`);
   ```
   **Storage Method:** `getActiveJobLocksCount()`

4. **getProductMetrics()** - lines 376-385
   ```typescript
   // Get counts for products, offers, trending
   const [productCount, offerCount, trendingCounts] = await Promise.all([
     db.select({ count: count() }).from(agentSessions), // Using as proxy
     db.select({ count: count() }).from(productOffers),
     db.select({ status: trendingProducts.status, count: count() })
       .from(trendingProducts).groupBy(trendingProducts.status)
   ]);
   ```
   **Storage Methods:**
   - `getProductOffersCount()`
   - `getTrendingProductsStatusCounts()`

5. **getHealthStatus()** - lines 424, 442-448
   ```typescript
   // Health checks
   await db.select().from(agentSessions).limit(1); // DB health
   await db.select().from(agentSessions)
     .where(and(
       eq(agentSessions.status, 'active'),
       gte(agentSessions.sessionStart, new Date(Date.now() - 10 * 60 * 1000))
     ));
   ```
   **Storage Method:** `getActiveAgentSessionsCount(minutes: number)`

**Complexity:** Medium - mostly simple aggregations and counts, no complex JOINs

---

### 2. price-drop-detection.ts (427 lines)

**Purpose:** Detects significant price drops and triggers notifications

**Database Queries:**

1. **detectPriceDrop()** - lines 75-80
   ```typescript
   // Get recent price history for drop detection
   await db.select()
     .from(priceHistory)
     .where(eq(priceHistory.productOfferId, productOfferId))
     .orderBy(desc(priceHistory.recordedAt))
     .limit(100);
   ```
   **Storage Method:** `getPriceHistoryByOfferId(productOfferId: number, limit: number)`

2. **checkPriceAlertsForDrop()** - lines 200-212, 219-228
   ```typescript
   // Get product offer details with JOIN
   await db.select({
     productId: productOffers.productId,
     productName: products.name,
     retailerName: retailers.name,
     productUrl: productOffers.productUrl,
     price: productOffers.price,
   })
   .from(productOffers)
   .leftJoin(products, eq(productOffers.productId, products.id))
   .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
   .where(eq(productOffers.id, productOfferId))
   .limit(1);

   // Find triggered price alerts
   await db.select()
     .from(priceAlerts)
     .where(and(
       eq(priceAlerts.productId, offer.productId),
       eq(priceAlerts.isActive, true),
       sql`${priceAlerts.targetPrice}::numeric >= ${newPrice}`
     ));
   ```
   **Storage Methods:**
   - `getProductOfferDetailsForAlert(productOfferId: number)`
   - `getTriggeredPriceAlerts(productId: number, newPrice: number)`

3. **checkPriceAlertsForDrop()** - lines 242
   ```typescript
   // Create notification + emit WebSocket event
   await db.insert(notifications).values(notification).returning();
   ```
   **Note:** Already migrated via notification-service in Phase 2

4. **createPriceDropNotification()** - lines 298
   ```typescript
   // Insert price drop notification
   await db.insert(notifications).values(notificationData);
   ```
   **Note:** Already migrated via notification-service

5. **getUsersToNotify()** - lines 311-319
   ```typescript
   // Get users with active alerts for product
   await db.select({ userId: priceAlerts.userId })
     .from(priceAlerts)
     .where(and(
       eq(priceAlerts.productId, productId),
       eq(priceAlerts.isActive, true)
     ));
   ```
   **Storage Method:** `getUsersWithActiveAlertsForProduct(productId: number)`

6. **processPriceChange()** - lines 347-358
   ```typescript
   // Get product details again (duplicate of query in checkPriceAlertsForDrop)
   await db.select({ ... })
     .from(productOffers)
     .leftJoin(products, ...)
     .leftJoin(retailers, ...)
     .where(eq(productOffers.id, productOfferId));
   ```
   **Note:** Will reuse `getProductOfferDetailsForAlert()`

**Complexity:** Medium - Simple queries with basic JOINs, no aggregations

---

### 3. product-discovery-fallback.ts (157 lines)

**Purpose:** Fallback product discovery using database when external APIs fail

**Database Queries:**

1. **searchExistingProducts()** - lines 23-42
   ```typescript
   // Search with multiple LIKE conditions using Drizzle query builder
   await db.query.products.findMany({
     where: or(
       ...searchTerms.map(term => or(
         like(products.name, `%${term}%`),
         like(products.description, `%${term}%`),
         like(products.category, `%${term}%`),
         like(products.brand, `%${term}%`)
       ))
     ),
     with: {
       offers: { with: { retailer: true } }
     },
     limit: maxResults
   });
   ```
   **Storage Method:** `searchProductsByTerms(searchTerms: string[], limit: number)`

2. **getTrendingCategories()** - lines 82-91
   ```typescript
   // Get category counts
   await db.select({
     category: products.category,
     count: count()
   })
   .from(products)
   .where(isNotNull(products.category))
   .groupBy(products.category)
   .orderBy(desc(count()))
   .limit(limit);
   ```
   **Storage Method:** `getTrendingProductCategories(limit: number)`

3. **getSearchSuggestions()** - lines 107-117
   ```typescript
   // Get similar product names using Drizzle query builder
   await db.query.products.findMany({
     where: or(
       like(products.name, `%${searchTerm}%`),
       like(products.brand, `%${searchTerm}%`)
     ),
     columns: { name: true, brand: true },
     limit: limit * 2
   });
   ```
   **Storage Method:** `getProductSearchSuggestions(searchTerm: string, limit: number)`

**Complexity:** Simple - All queries use Drizzle query builder, straightforward patterns

---

### 4. advanced-search.ts (939 lines) **MOST COMPLEX**

**Purpose:** AI-powered multi-strategy search (exact, fuzzy, semantic, synonym, filtered)

**Database Queries:**

1. **performExactSearch()** - lines 173-215
   ```typescript
   // Complex JOIN with json_agg for products+offers+retailers
   await db.select({
     id: products.id,
     name: products.name,
     description: products.description,
     category: products.category,
     brand: products.brand,
     image: products.image,
     offers: sql<Array<{...}>>`
       json_agg(json_build_object(
         'id', ${productOffers.id},
         'price', ${productOffers.price}::text,
         'availability', ${productOffers.availability},
         'productUrl', ${productOffers.productUrl},
         'retailer', json_build_object(
           'id', ${retailers.id},
           'name', ${retailers.name},
           'websiteUrl', ${retailers.websiteUrl}
         )
       )) FILTER (WHERE ${productOffers.id} IS NOT NULL)
     `
   })
   .from(products)
   .leftJoin(productOffers, eq(products.id, productOffers.productId))
   .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
   .where(or(
     sql`LOWER(${products.name}) LIKE LOWER(${searchPattern})`,
     sql`LOWER(${products.brand}) LIKE LOWER(${searchPattern})`
   ))
   .groupBy(products.id, products.name, products.description, products.category, products.brand, products.image)
   .limit(params.limit);
   ```
   **Storage Method:** `searchProductsExact(searchPattern: string, limit: number)`

2. **performFuzzySearch()** - lines 226-268
   ```typescript
   // Similar to exact search but with fuzzy matching (similarity)
   // Same json_agg pattern, different WHERE clause with similarity function
   ```
   **Storage Method:** `searchProductsFuzzy(searchPattern: string, threshold: number, limit: number)`

3. **performSynonymSearch()** - lines 350-383
   ```typescript
   // Batch query with multiple OR conditions
   await db.select({ ... json_agg pattern ... })
     .from(products)
     .leftJoin(productOffers, ...)
     .leftJoin(retailers, ...)
     .where(or(
       ...allTerms.map(term => or(
         sql`LOWER(${products.name}) LIKE LOWER('%' || ${term} || '%')`,
         sql`LOWER(${products.brand}) LIKE LOWER('%' || ${term} || '%')`,
         sql`LOWER(${products.description}) LIKE LOWER('%' || ${term} || '%')`
       ))
     ))
     .groupBy(...)
     .limit(params.limit);
   ```
   **Storage Method:** `searchProductsBySynonyms(searchTerms: string[], limit: number)`

4. **performSemanticSearch()** - lines 418-467
   ```typescript
   // Vector similarity search using pgvector
   await db.select({
     id: products.id,
     name: products.name,
     description: products.description,
     category: products.category,
     brand: products.brand,
     image: products.image,
     similarity: sql<number>`1 - (${products.embedding} <=> ${embeddingString}::vector)`,
     offers: sql<Array<{...}>>`json_agg(...) FILTER (...)`
   })
   .from(products)
   .leftJoin(productOffers, ...)
   .leftJoin(retailers, ...)
   .where(sql`${products.embedding} IS NOT NULL`)
   .groupBy(...)
   .orderBy(sql`${products.embedding} <=> ${embeddingString}::vector`)
   .limit(params.limit);
   ```
   **Storage Method:** `searchProductsSemantic(embedding: number[], limit: number)`

5. **performFilteredSearch()** - lines 472-507
   ```typescript
   // No-query filtered search (uses in-memory filter on exact results)
   // Reuses performExactSearch() then filters results
   ```
   **Note:** No separate storage method needed - uses exact search

6. **getSearchSuggestions()** - lines 623-633
   ```typescript
   // Auto-completion query with ILIKE
   await db.select({
     name: products.name,
     brand: products.brand,
     category: products.category
   })
   .from(products)
   .where(or(
     sql`LOWER(${products.name}) LIKE LOWER(${`%${query}%`})`,
     sql`LOWER(${products.brand}) LIKE LOWER(${`%${query}%`})`,
     sql`LOWER(${products.category}) LIKE LOWER(${`%${query}%`})`
   ))
   .limit(10);
   ```
   **Storage Method:** `getProductAutocompleteSuggestions(query: string, limit: number)`

7. **generateProductEmbedding()** - lines 820-870
   ```typescript
   // Fetch product for embedding generation
   await db.query.products.findFirst({
     where: eq(products.id, productId),
     columns: {
       id: true,
       name: true,
       description: true,
       category: true,
       brand: true
     }
   });

   // Update product with new embedding
   await db.update(products)
     .set({ embedding: embeddingArray })
     .where(eq(products.id, productId));
   ```
   **Storage Methods:**
   - `getProductForEmbedding(productId: number)`
   - `updateProductEmbedding(productId: number, embedding: number[])`

**Complexity:** Very High
- Heavy use of `json_agg` for nested structures
- pgvector integration for semantic search
- Complex similarity calculations
- Multiple search strategies with different patterns

---

## Storage Method Design

### Summary of New Methods (15 total)

**Monitoring Service (6 methods):**
1. `getRecentAgentSessions(hours: number, limit: number)`
2. `getRecentScrapingJobs(limit: number)`
3. `getScrapingJobStatusCounts()`
4. `getActiveJobLocksCount()`
5. `getProductOffersCount()`
6. `getTrendingProductsStatusCounts()`
7. `getActiveAgentSessionsCount(minutes: number)`

**Price Drop Detection (3 methods):**
8. `getPriceHistoryByOfferId(productOfferId: number, limit: number)`
9. `getProductOfferDetailsForAlert(productOfferId: number)`
10. `getTriggeredPriceAlerts(productId: number, newPrice: number)`
11. `getUsersWithActiveAlertsForProduct(productId: number)`

**Product Discovery Fallback (3 methods):**
12. `searchProductsByTerms(searchTerms: string[], limit: number)`
13. `getTrendingProductCategories(limit: number)`
14. `getProductSearchSuggestions(searchTerm: string, limit: number)`

**Advanced Search (8 methods):**
15. `searchProductsExact(searchPattern: string, limit: number)`
16. `searchProductsFuzzy(searchPattern: string, threshold: number, limit: number)`
17. `searchProductsBySynonyms(searchTerms: string[], limit: number)`
18. `searchProductsSemantic(embedding: number[], limit: number)`
19. `getProductAutocompleteSuggestions(query: string, limit: number)`
20. `getProductForEmbedding(productId: number)`
21. `updateProductEmbedding(productId: number, embedding: number[])`

**Reused from Previous Phases:**
- Notification creation (Phase 2)
- User active alerts queries (may already exist)

---

## Type Definitions Needed

### Monitoring Types
```typescript
interface AgentSessionData {
  id: number;
  agentType: string;
  status: string;
  sessionStart: Date;
  tasksCompleted: number | null;
  successRate: string | null;
  errorsEncountered: number | null;
}

interface ScrapingJobData {
  id: number;
  jobType: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}

interface JobStatusCount {
  status: string;
  count: number;
}

interface TrendingProductStatusCount {
  status: string;
  count: number;
}
```

### Price Drop Types
```typescript
interface ProductOfferForAlert {
  productId: number;
  productName: string | null;
  retailerName: string | null;
  productUrl: string | null;
  price: string;
}

interface TriggeredPriceAlert {
  id: number;
  userId: number;
  productId: number;
  targetPrice: string;
  isActive: boolean;
  createdAt: Date;
}
```

### Search Types
```typescript
interface ProductWithOffersAndRetailers {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  image: string | null;
  similarity?: number; // For semantic search
  offers: Array<{
    id: number;
    price: string;
    availability: string | null;
    productUrl: string | null;
    retailer: {
      id: number;
      name: string;
      websiteUrl: string | null;
    } | null;
  }>;
}

interface ProductCategoryCount {
  category: string;
  count: number;
}

interface ProductSuggestion {
  name: string;
  brand: string | null;
  category: string | null;
}

interface ProductForEmbedding {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
}
```

---

## Migration Complexity Assessment

### Easy (1 service): product-discovery-fallback
- All queries use Drizzle query builder
- No complex aggregations
- ~1-2 hours implementation

### Medium (2 services): monitoring-service, price-drop-detection
- Simple counts and aggregations
- Basic JOINs
- ~3-4 hours implementation each

### Very Complex (1 service): advanced-search.ts
- Heavy `json_agg` usage for nested structures
- pgvector integration (semantic search)
- Multiple search strategies
- Complex similarity calculations
- ~6-8 hours implementation

**Total Estimated Time:** 13-18 hours

---

## Risk Factors

1. **pgvector Integration** - Semantic search requires vector operations, may need careful SQL construction
2. **json_agg Complexity** - Nested JSON aggregation for product+offers+retailers must be exact
3. **OpenAI API Calls** - External dependency in advanced-search (not in transaction!)
4. **In-Memory Caching** - advanced-search has multiple caches, ensure not broken
5. **WebSocket Events** - price-drop-detection emits events, preserve this logic

---

## Next Steps

1. Add 20 storage method signatures to IStorage interface
2. Implement 20 methods in DatabaseStorage
3. Add 20 stubs to MemStorage
4. Migrate monitoring-service.ts (easiest)
5. Migrate product-discovery-fallback.ts (simple)
6. Migrate price-drop-detection.ts (medium)
7. Migrate advanced-search.ts (complex - save for last)
8. TypeScript compilation check
9. Pre-commit hook validation
10. Create PR #119
