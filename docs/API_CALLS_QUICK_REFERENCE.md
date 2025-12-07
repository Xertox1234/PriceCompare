# API Calls Quick Reference Guide

## File-by-File API Call Locations

### 1. OpenAI API Calls

#### `/home/user/PriceCompare/server/services/advanced-search.ts`
| Line | API Call | Model | Trigger | Cache? |
|------|----------|-------|---------|--------|
| 359 | `openai.embeddings.create()` | text-embedding-3-small | Semantic search | ✅ In-memory |
| 508 | `openai.embeddings.create()` | text-embedding-3-small | Product similarity | ✅ In-memory |
| 686 | `openai.chat.completions.create()` | gpt-4 | Search suggestions | ❌ NO |

**Issue:** Line 686 uses expensive `gpt-4` instead of `gpt-4o-mini` (50% cost difference)

#### `/home/user/PriceCompare/server/agents/search-agent.ts`
| Line | API Call | Model | Trigger | Cache? |
|------|----------|-------|---------|--------|
| 148 | `openai.chat.completions.create()` | gpt-4o-mini | Query generation | ❌ NO |

**Issue:** Should cache results for 7 days

#### `/home/user/PriceCompare/server/agents/discovery-agent.ts`
| Line | API Call | Model | Trigger | Cache? |
|------|----------|-------|---------|--------|
| 121 | `openai.chat.completions.create()` | gpt-4o-mini | Trend analysis | ❌ NO |

**Issue:** Should cache for 24-48 hours

---

### 2. Google Custom Search API

#### `/home/user/PriceCompare/server/services/google-search.ts`
| Line | Method | Endpoint | Rate Limit | Cache? |
|------|--------|----------|------------|--------|
| 79 | `axios.get()` | Custom Search v1 | 1 req/sec | ❌ NO |
| 149 | `axios.get()` | Custom Search v1 | 1 req/sec | ❌ NO |

**Rate Limiter:** ✅ Implemented at line 50 (RateLimiter class)
**Issue:** Results should be cached for 7-30 days

---

### 3. HTTP Scraping (Web Crawling)

#### `/home/user/PriceCompare/server/agents/extraction-agent.ts`
| Line | Method | Retailers | Delay | Cache? |
|------|--------|-----------|-------|--------|
| 139 | `axios.get()` | Amazon, Walmart, Target | 1500ms+ | ❌ NO |

**Features:**
- Random User-Agents (lines 46-50)
- 3 retry attempts (line 43)
- Jitter delay (line 136)

**Issue:** No caching - fetches fresh every time

#### `/home/user/PriceCompare/server/services/hybrid-data-collector.ts`
| Line | Service | API | Status |
|------|---------|-----|--------|
| 115 | Amazon PA-API | `makeAPICall()` | Stub only |
| 222 | Walmart API | `fetch()` | Implemented |
| 488 | Target Scraping | `scrapeRetailer()` | Stub only |

---

### 4. Client-Side API Calls

#### `/home/user/PriceCompare/client/src/hooks/use-products.ts`
- **Endpoint:** `/api/products/search`
- **Debounce:** 300ms
- **Cache:** 5 minutes (staleTime)
- **Refetch:** Manual only

#### `/home/user/PriceCompare/client/src/hooks/use-enhanced-products-search.ts`
- **Endpoints:**
  - `/api/search/smart` (Basic + Intent Analysis)
  - `/api/search/intent/{intent}` (Intent-optimized)
  - `/api/search/advanced` (Full search)
  - `/api/search/analyze` (Intent detection only)
- **Debounce:** Configurable (default 300ms)
- **Cache:** 30 sec (auto), 5 min (default)
- **Issue:** Intent mode makes 2 API calls per search

---

## API Call Density Analysis

### By Frequency per User Search

```
Single User Search Flow:
┌─────────────────────────────────────┐
│  /api/search/smart                  │
├─────────────────────────────────────┤
│  1. analyzeQueryIntent()             │ (database only)
│  2. searchProducts()                 │
│     ├─ performExactSearch()          │ (database)
│     ├─ performFuzzySearch()          │ (database)
│     ├─ performSynonymSearch()        │ (database)
│     └─ performSemanticSearch()       │ (OpenAI API)
│        ├─ CALL #1: embedding query   │ ($0.00001)
│        └─ CALL #2-N: embedding each  │ ($0.0001 × N)
│           product in DB (100 prods)  │ ($0.0100)
│                                       │ ────────────
│                    TOTAL:             │ 101 calls
└─────────────────────────────────────┘
```

### By Endpoint

| Endpoint | Calls/Day (1000 users) | OpenAI Calls | External Calls |
|----------|----------------------|--------------|----------------|
| `/api/search/advanced` | ~2000 | ~202,000 | 0 |
| `/api/search/smart` | ~1500 | ~151,500 | 0 |
| `/api/search/suggestions` | ~500 | ~500 | 0 |
| `/api/scraping/discover-trends` | ~10 | ~1 | 0 |
| Background: Price monitoring | ~5000 | 0 | ~5000 scrapes |

---

## Caching Layers (Current)

### HTTP Response Headers
```
/api/search/advanced        → max-age=120, stale-while-revalidate=60
/api/search/suggestions     → max-age=300, stale-while-revalidate=150
/api/search/facets          → max-age=1800, stale-while-revalidate=900
/api/products               → max-age=300, stale-while-revalidate=60
```

### Server-Side In-Memory (UNBOUNDED)
```javascript
// ❌ MEMORY LEAK RISK - no size limits
this.queryCache = new Map();          // Line 31
this.embeddingCache = new Map();      // Line 32
```

### Client-Side (React Query)
```javascript
staleTime: 5 * 60 * 1000,            // 5 minutes
gcTime: 10 * 60 * 1000,              // 10 minutes
refetchOnWindowFocus: false,
refetchInterval: false                // No auto-refetch
```

---

## Cost Impact Breakdown (Estimated)

### Per 1,000 API Calls

| API | Cost | Note |
|-----|------|------|
| OpenAI Embeddings (text-embedding-3-small) | $0.02 | 1M tokens = ~100K embeddings |
| OpenAI Chat (gpt-4) | $30 | 1M input tokens |
| OpenAI Chat (gpt-4o-mini) | $0.15 | 1M input tokens (10x cheaper) |
| Google Custom Search | $5 | Per 1,000 queries (paid) |
| Web Scraping | $0 | Free but slow (1.5s/req) |

### By Feature (Daily at 1,000 users, 5 searches each)

**Current Stack:**
- Semantic Search: 202K embeddings × $0.02/1M = ~$0.40
- Search Suggestions: 500 calls × $30/1M tokens = ~$0.015 (assuming 30 tokens avg)
- Query Generation: 500 calls × $0.15/1M tokens = ~$0.0075
- Google Search: 5,000 calls × $5/1K = $25 (if paid tier)
- **Daily Total: ~$25.42 (if Google paid), ~$0.42 (if Google free)**

**Issue:** Semantic search has massive N+1 problem - actual cost much higher

---

## Key Optimization Targets

### 🔴 CRITICAL
1. **Fix Semantic Search N+1** (Line 395-409)
   - Change: Don't fetch all products, use pre-calculated embeddings
   - Impact: -90% API calls for semantic search
   - Status: Requires pgvector setup

2. **Replace gpt-4 → gpt-4o-mini** (Line 686)
   - Change: 1-line model name change
   - Impact: -50% cost for suggestions
   - Status: Ready to implement

3. **Cache Search Suggestions** (Line 657-664)
   - Change: Add 1-hour Redis cache
   - Impact: -20-30% duplicate calls
   - Status: Ready to implement

### 🟡 IMPORTANT
1. **Limit In-Memory Cache Size**
   - Issue: queryCache and embeddingCache unbounded
   - Status: Add LRU cache with 1GB max

2. **Cache Google Search Results**
   - Change: Add 7-30 day TTL
   - Impact: -50-70% Google API calls
   - Status: Easy to add

3. **Cache Query Generation**
   - Change: Store generated queries in DB
   - Impact: -30-50% OpenAI calls
   - Status: Easy to add

---

## File Paths Summary

```
Critical Files to Optimize:
├─ server/services/advanced-search.ts        (Semantic Search N+1)
├─ server/agents/search-agent.ts             (Query generation caching)
├─ server/agents/discovery-agent.ts          (Trend analysis caching)
├─ server/services/google-search.ts          (Results caching)
├─ server/agents/extraction-agent.ts         (Web scraping caching)
├─ server/agents/monitoring-agent.ts         (Price monitoring frequency)
└─ server/middleware/cache.ts                (In-memory cache limits)

Client-Side:
├─ client/src/hooks/use-enhanced-products-search.ts  (Intent mode)
└─ client/src/lib/queryClient.ts             (React Query config)
```

