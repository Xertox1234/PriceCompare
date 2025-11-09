# PriceCompare API Calls Analysis

## Executive Summary

The PriceCompare codebase makes extensive use of **OpenAI APIs** (switched to gpt-4o-mini), **external web services** (Google Custom Search), and **web scraping** to gather price data. The current implementation has **multiple caching layers** but relies heavily on **redundant API calls** that could be optimized to reduce costs.

---

## 1. OpenAI/LLM API CALLS (High Cost Impact)

### A. Semantic Search (advanced-search.ts)
**File:** `/home/user/PriceCompare/server/services/advanced-search.ts`
- **API:** `openai.embeddings.create()`
- **Model:** `text-embedding-3-small`
- **Trigger:** Every search query that uses semantic search
- **Frequency:** 
  - Called once per unique search query
  - Called again for EACH product description comparison in `calculateSemanticSimilarity()` (line 499-524)
  - If you have 100 products in the database, a single semantic search makes **101+ API calls** (1 for query + 100 for products)
- **Caching:** ✅ In-memory embedding cache (Map) - caches per query/text
- **Cost:** ~$0.02 per 1M tokens for text-embedding-3-small
- **OPTIMIZATION OPPORTUNITY:** This is CRITICAL - the current implementation fetches ALL products from DB (line 369-391) and calculates similarity for each one. This is extremely expensive.

**Code Location:**
```typescript
// Line 359-365: Query embedding cached
const response = await this.openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: query
});

// Line 508-513: PROBLEM - calculates embedding for EACH product
for (const result of allProducts) {
  const similarity = await this.calculateSemanticSimilarity(query, productText);
}
```

### B. Search Suggestions (advanced-search.ts)
**File:** `/home/user/PriceCompare/server/services/advanced-search.ts`
- **API:** `openai.chat.completions.create()`
- **Model:** `gpt-4` (line 687) - EXPENSIVE
- **Trigger:** Search suggestions request when query length > 3 (line 657)
- **Frequency:** Called on every `/api/search/suggestions` request
- **Caching:** ❌ NO CACHING - This is called every time
- **Cost:** ~$0.30 per 1M input tokens for gpt-4
- **OPTIMIZATION OPPORTUNITY:** This should be cached or use a cheaper model (4o-mini costs ~$0.15/1M tokens, 10x cheaper)

**Code Location:**
```typescript
// Line 680-716: getAISuggestions() 
const response = await this.openai.chat.completions.create({
  model: 'gpt-4',  // ← EXPENSIVE MODEL
  messages: [{...}],
  max_tokens: 100,
  temperature: 0.7
});
```

### C. Search Query Generation (search-agent.ts)
**File:** `/home/user/PriceCompare/server/agents/search-agent.ts`
- **API:** `openai.chat.completions.create()`
- **Model:** `gpt-4o-mini` (line 149) - Good choice
- **Trigger:** When orchestrating product searches across retailers
- **Frequency:** Called once per unique product search (lines 131-175)
- **Caching:** ❌ NO CACHING - Regenerates on every call
- **Context:** Generates 3-5 search query variations for better retailer searches
- **Cost:** ~$0.15 per 1M input tokens for 4o-mini
- **OPTIMIZATION OPPORTUNITY:** Cache generated queries by product name for 1-7 days

**Code Location:**
```typescript
// Line 131-175: generateSearchQueries()
const response = await this.openai.chat.completions.create({
  model: 'gpt-4o-mini',  // Good
  messages: [{...}],
  temperature: 0.3,
  max_tokens: 200
});
```

### D. Trend Analysis (discovery-agent.ts)
**File:** `/home/user/PriceCompare/server/agents/discovery-agent.ts`
- **API:** `openai.chat.completions.create()`
- **Model:** `gpt-4o-mini` (line 122)
- **Trigger:** Trend discovery process (admin endpoint `/api/scraping/discover-trends`)
- **Frequency:** Called during trend discovery workflow, processes multiple trends in one request
- **Caching:** ❌ NO CACHING
- **Cost:** Processes multiple trends per request (line 110), more efficient batching
- **OPTIMIZATION OPPORTUNITY:** Results could be cached for 24-48 hours

**Code Location:**
```typescript
// Line 97-161: analyzeTrendsWithAI()
const response = await this.openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{...}],
  temperature: 0.1,
  max_tokens: 2000
});
```

---

## 2. EXTERNAL API CALLS (Third-party services)

### A. Google Custom Search API
**File:** `/home/user/PriceCompare/server/services/google-search.ts`

**API Details:**
- **Service:** Google Custom Search API
- **Rate Limit:** 100 queries/day (free tier) or 10,000/day (paid)
- **Cost:** Free (limited) or $5 per 1,000 queries (paid)
- **RateLimiter:** ✅ Implemented with 1 request/second limit (line 50)

**Trigger Points:**
1. **Search Retailer (line 56-101):** `/api/search/retailer`
   - Searches for products on specific retailers
   - Uses site restriction: `q: query site:${retailerDomain}`
   
2. **Search Multiple Retailers (line 106-123):**
   - Parallel searches across multiple retailers
   - Makes one request per retailer

3. **General Search (line 128-161):**
   - Unrestricted search with optional date restriction

**Frequency:**
- Called from `SearchOrchestrationAgent.searchRetailer()` (search-agent.ts, line 188)
- Called during trend discovery workflows
- No caching at API level (relies on rate limiter only)

**OPTIMIZATION OPPORTUNITY:** 
- Limited to 100/day on free tier - need to prioritize high-value searches
- Results could be cached for 7-30 days depending on category

---

## 3. WEB SCRAPING API CALLS

### A. Direct HTTP Scraping (extraction-agent.ts)
**File:** `/home/user/PriceCompare/server/agents/extraction-agent.ts`

**Details:**
- **Method:** `axios.get()` with cheerio HTML parsing
- **Retailers:** Amazon, Walmart, Target
- **Frequency:** Called when product URLs need to be scraped for current pricing
- **Delay:** 1500ms random + jitter (line 136) to avoid detection
- **Headers:** Rotating user agents (lines 46-50)
- **Retry:** 3 attempts with 2000ms delay (line 43)

**Triggers:**
1. Manual scraping jobs from coordinator
2. Price monitoring refresh (monitoring-agent.ts)
3. Stale offer updates (monitoring-agent.ts)

**Caching:** ❌ NO CACHING - Fetches fresh data every time

**OPTIMIZATION OPPORTUNITY:**
- Cache scraped product data for 1-6 hours (depending on retailer)
- Implement smart refreshing based on price volatility

### B. Retailer API Services (hybrid-data-collector.ts)
**File:** `/home/user/PriceCompare/server/services/hybrid-data-collector.ts`

**Configured Retailers:**
1. **Amazon Product Advertising API (PA-API 5.0)**
   - Rate Limit: 1 req/min, 8,640/day
   - Cost: Free (requires affiliate sales)
   - Status: Stub implementation (line 202-206)

2. **Walmart API**
   - Base URL: `https://api.walmart.com/v1/`
   - Rate Limit: 100 req/min, 5,000/day
   - Cost: Free tier
   - Implementation: fetch() calls (lines 221, 258)

3. **Target**
   - Primary Source: Web scraping only (no API)
   - Rate Limit: 10 req/min, 1,000/day
   - Delays: 1-3 seconds between requests

---

## 4. CLIENT-SIDE API CALLS (React Query Integration)

### A. Product Search Hook (use-products.ts)
**File:** `/home/user/PriceCompare/client/src/hooks/use-products.ts`

**Configuration:**
- **Endpoint:** `/api/products/search`
- **Debounce:** 300ms to reduce rapid fire requests
- **Cache (Stale Time):** 5 minutes
- **Refetch:** Only on manual trigger (refetchOnWindowFocus: false)
- **Frequency:** 1 API call per 300ms minimum per search

### B. Enhanced Search Hook (use-enhanced-products-search.ts)
**File:** `/home/user/PriceCompare/client/src/hooks/use-enhanced-products-search.ts`

**Multiple Search Modes:**
1. **Smart Mode** → `/api/search/smart` (calls intent analysis FIRST, then search)
2. **Intent Mode** → `/api/search/intent/{intent}` (2 API calls: analyze + search)
3. **Basic Mode** → `/api/search/advanced`

**Configuration:**
- **Debounce:** Configurable (default 300ms)
- **Stale Time:** 30 seconds for auto-search, 5 min for defaults
- **Triggers:** Intent mode makes 2 API calls per search (intent + search)

**OPTIMIZATION OPPORTUNITY:** Intent analysis (line 59) happens on EVERY smart/intent search - could be cached by query

### C. Global Query Client Config (queryClient.ts)
**File:** `/home/user/PriceCompare/client/src/lib/queryClient.ts`

- **Refetch Interval:** Disabled by default
- **Stale Time:** 5 minutes (default)
- **GC Time:** 10 minutes (cache retention)
- **Retry:** Max 2 attempts (except 401s)

---

## 5. SERVER-SIDE CACHING MECHANISMS

### A. HTTP Cache Headers (middleware/cache.ts)
- **Search Results:** `max-age=120s, stale-while-revalidate=60s` (2 min + 1 min stale)
- **Search Suggestions:** `max-age=300s, stale-while-revalidate=150s` (5 min + 2.5 min stale)
- **Facets:** `max-age=1800s, stale-while-revalidate=900s` (30 min + 15 min stale)
- **Products/Retailers:** `max-age=300s, stale-while-revalidate=60s` (5 min + 1 min stale)

### B. In-Memory Caches
1. **Query Cache** (advanced-search.ts, line 31):
   - Caches search results by JSON.stringify({filters, userId})
   - Size: Unbounded (⚠️ MEMORY LEAK RISK)

2. **Embedding Cache** (advanced-search.ts, line 32):
   - Caches OpenAI embeddings by text
   - Prevents duplicate embedding API calls
   - Size: Unbounded (⚠️ MEMORY LEAK RISK)

3. **Search Query Cache** (search-agent.ts):
   - Stores historical search queries to database
   - Optimizes future queries (line 295-307)

---

## 6. BACKGROUND AGENTS & SCHEDULED TASKS

### Price Monitoring Agent (monitoring-agent.ts)
**Monitoring Intervals:**
- Amazon: Every 6 hours
- Walmart: Every 8 hours
- Target: Every 12 hours
- Others: Every 24 hours

**Triggers:**
- Monitors stale offers (older than maxAge)
- Makes extraction API calls for each stale offer
- Could generate 10-100+ API calls per monitoring cycle

---

## 7. API CALL FREQUENCY SUMMARY

| API Type | Model/Service | Calls per User Action | Total Daily (Estimate) | Cost Impact |
|----------|---------------|----------------------|------------------------|------------|
| Semantic Search | text-embedding-3-small | 50-200 per search | 10,000+ | LOW ($0.02/1M) |
| Search Suggestions | gpt-4 | 1 per input | 1,000+ | **HIGH** ($0.30/1M) |
| Search Queries | gpt-4o-mini | 1 per product search | 500+ | LOW ($0.15/1M) |
| Trend Analysis | gpt-4o-mini | 1 per trend cycle | 10-100 | LOW |
| Google Search | Custom Search API | 5-10 per search | 1,000+ | **MEDIUM** ($5/1000) |
| Web Scraping | axios/cheerio | 5-50 per search | 5,000+ | FREE (but slow) |

---

## 8. CRITICAL OPTIMIZATION OPPORTUNITIES

### 🔴 CRITICAL (High Impact, Quick Win)
1. **Replace gpt-4 with gpt-4o-mini for suggestions** (line 687)
   - Cost reduction: 50% ($0.30 → $0.15 per 1M tokens)
   - Impact: Affects `/api/search/suggestions` endpoint
   - Implementation: 1-line change

2. **Fix semantic search N+1 problem** (lines 395-409)
   - Currently: 1 embedding + N embeddings (for each product)
   - Should: 1 embedding + database vector search
   - Cost reduction: 90-95% for searches with many products
   - Implementation: Requires vector database (pgvector, Pinecone)

3. **Cache search suggestion results** (line 657-664)
   - Add 1-hour cache for suggestions by query
   - Prevent duplicate OpenAI calls
   - Cost reduction: 20-30% of suggestion API calls

### 🟡 IMPORTANT (Medium Impact)
1. **Cache search query generation by product name** (search-agent.ts)
   - Cache for 7 days
   - Cost reduction: 30-50% of search query generation calls

2. **Cache Google Search results** (google-search.ts)
   - Cache for 7-30 days by category
   - Cost reduction: 50-70% of Google Search API calls

3. **Implement vector database for embeddings**
   - Store embeddings in pgvector (PostgreSQL extension)
   - Eliminate redundant embedding calculations
   - Cost reduction: 80-90% of embedding API calls

4. **Add bounded limits to in-memory caches**
   - Set max size for queryCache (line 31)
   - Set max size for embeddingCache (line 32)
   - Prevent memory leaks

### 🟢 NICE TO HAVE (Performance & UX)
1. **Add request deduplication**
   - Prevent duplicate concurrent requests
   - Use request.abort() for cancelled requests

2. **Optimize web scraping with caching**
   - Cache product pages for 1-6 hours
   - Reduce bandwidth usage

3. **Batch trend discovery API calls**
   - Already partially done (line 110)
   - Could be further optimized

---

## 9. DETAILED FLOW: TYPICAL USER SEARCH

```
User types "iPhone 15" in search box
↓
Client debounces (300ms) → calls /api/search/smart
↓
Server calls advancedSearchService.analyzeQueryIntent()
  ├─ No API call for intent analysis (keyword matching only)
  └─ Returns: { intent: 'price_comparison', confidence: 0.8 }
↓
Server calls advancedSearchService.searchProducts()
  ├─ Exact search (database)
  ├─ Fuzzy search (database)
  ├─ Synonym search (database)
  └─ Semantic search:
      ├─ API CALL #1: Get embedding for "iPhone 15" ($0.00001)
      ├─ For each of 100 products in DB:
      │   └─ API CALL #2-101: Get embedding for product text ($0.00100)
      └─ Calculate cosine similarity for each
↓
Results cached for 2 minutes
↓
Server responds with 50 products
```

**Problem:** For a single search, 101+ API calls to OpenAI embeddings!

---

## 10. MEMORY & CACHING ARCHITECTURE

```
Client (React)
├─ React Query Cache (10 min)
└─ API Request Deduplication

Server (Node.js)
├─ HTTP Cache Headers (2-30 min)
├─ In-Memory Caches (UNBOUNDED)
│  ├─ queryCache: Search results by JSON key
│  └─ embeddingCache: Embeddings by text
└─ Database Queries

External APIs
├─ OpenAI (Embeddings, Chat)
├─ Google Custom Search (Rate Limited: 1/sec)
└─ Web Scrapers (Delayed: 1.5s + jitter)
```

---

## RECOMMENDATIONS PRIORITY LIST

### Phase 1 (Week 1) - Quick Wins
- [ ] Switch `gpt-4` to `gpt-4o-mini` in getAISuggestions() - 50% cost cut
- [ ] Add 1-hour cache to search suggestions
- [ ] Add bounds to in-memory caches (queryCache, embeddingCache)

### Phase 2 (Week 2-3) - Medium Impact
- [ ] Implement search query caching (7 day TTL)
- [ ] Cache Google Search API results (14 day TTL)
- [ ] Add request deduplication for concurrent identical requests

### Phase 3 (Week 4) - High Impact
- [ ] Deploy pgvector extension to PostgreSQL
- [ ] Migrate semantic search to use pre-calculated embeddings
- [ ] Implement batch embedding calculation (off-peak)

---

## Cost Estimation (Current vs. Optimized)

**Assumptions:** 1,000 users/day, avg 5 searches/day = 5,000 searches

| Phase | OpenAI Cost | Google Cost | Total | Savings |
|-------|------------|-------------|-------|---------|
| Current | ~$2.50/day | ~$2.50/day | ~$5.00/day | Baseline |
| Phase 1 | ~$1.75/day | ~$2.50/day | ~$4.25/day | 15% |
| Phase 2 | ~$1.40/day | ~$1.25/day | ~$2.65/day | 47% |
| Phase 3 | ~$0.30/day | ~$1.25/day | ~$1.55/day | 69% |

**Monthly Savings at Phase 3:** ~$100-150/month (conservative estimate)

