# Scraping System Migration & Test Coverage Plan

**Created:** 2026-01-12
**Status:** PLANNING
**Priority:** P0 - CRITICAL

---

## 🎯 Executive Summary

**Problem:** Core scraping functionality violates project standards (uses axios+cheerio instead of Playwright) and has 0% test coverage for 7/9 agents.

**Solution:** Migrate to Playwright-based scraping with comprehensive test coverage.

**Estimated Timeline:** 2-3 weeks (includes testing, validation, and gradual rollout)

---

## 📋 Phase 1: WebSocket Quick Wins (P0 - Do First)

**Timeline:** 1-2 hours
**Risk:** Low
**Impact:** Fixes 8 test failures immediately

### Tasks

- [ ] **Task 1.1:** Fix error code mismatch in `server/websocket/middleware/error-handler.ts`
  - Change line 95-96 order OR update test expectation to `RATE_LIMIT_EXCEEDED`
  - Update test: `server/websocket/__tests__/handlers.test.ts:169`
  - Run: `npm test handlers.test.ts` to verify
  - **ETA:** 5 minutes

- [ ] **Task 1.2:** Fix WebSocket integration test race condition
  - Add `waitForEventSubscriptionsReady()` helper to `test-utils.ts`
  - Update 7 failing tests in `integration.test.ts` to wait for subscription initialization
  - Tests to fix:
    - `should isolate product events between users` (line 349)
    - `should emit new notification with unread count` (line 391)
    - `should update unread count when notification is read` (line 434)
    - `should emit price alert to user` (line ~460)
    - `should emit price alert only to targeted user` (line ~480)
    - `should emit product added event` (line ~380)
    - `should emit product removed event` (line ~400)
  - Run: `npm test integration.test.ts` to verify
  - **ETA:** 1-2 hours

- [ ] **Task 1.3:** Verify all WebSocket tests pass
  - Run: `npm test server/websocket`
  - Expected: 0 failures, 18 skipped (load/reconnection tests)
  - **ETA:** 5 minutes

**Success Criteria:** All WebSocket tests passing (except intentionally skipped performance tests)

---

## 📋 Phase 2: Research & Architecture Decision (P0 - Critical Path)

**Timeline:** 1-2 days
**Risk:** Medium (architectural decision)
**Impact:** Determines approach for all subsequent work

### Tasks

- [ ] **Task 2.1:** Audit current scraping implementation
  - Document what `extraction-agent.ts` currently does
  - Identify dependencies on axios+cheerio
  - Map out selector strategies for each retailer
  - List all files that import/use extraction agent
  - **Output:** `docs/audits/SCRAPING_CURRENT_STATE.md`
  - **ETA:** 3-4 hours

- [ ] **Task 2.2:** Research Playwright for scraping
  - Review Playwright API for web scraping use cases
  - Research anti-detection patterns (stealth plugins, browser fingerprinting)
  - Test Playwright against 2-3 major retailers (Amazon, Walmart, Target)
  - Document browser resource requirements (memory, CPU)
  - Evaluate headless vs headed mode performance
  - **Output:** `docs/research/PLAYWRIGHT_SCRAPING_FEASIBILITY.md`
  - **ETA:** 4-6 hours

- [ ] **Task 2.3:** Design new architecture
  - Design Playwright-based extraction agent
  - Plan browser pooling strategy (one browser instance vs pool of contexts)
  - Design rate limiting and retry logic
  - Plan error handling and logging
  - Consider caching strategy (screenshot caching, HTML snapshots)
  - Design monitoring and health checks
  - **Output:** `docs/architecture/SCRAPING_ARCHITECTURE_V2.md`
  - **ETA:** 4-6 hours

- [ ] **Task 2.4:** Create migration strategy
  - Plan incremental rollout (feature flag approach?)
  - Identify rollback points
  - Plan A/B testing approach (old vs new scraper)
  - Define success metrics (accuracy, latency, cost)
  - **Output:** `docs/migration/SCRAPING_MIGRATION_STRATEGY.md`
  - **ETA:** 2-3 hours

- [ ] **Task 2.5:** Architecture review meeting
  - Present findings to team/stakeholders
  - Discuss trade-offs (complexity vs reliability vs cost)
  - Get approval to proceed
  - Document decisions
  - **Output:** Approved architecture document
  - **ETA:** 1 hour meeting + followup

**Success Criteria:** Approved architecture with clear implementation path

**Decision Points:**
1. ✅ Migrate to Playwright OR ❌ Update CLAUDE.md to allow axios+cheerio
2. Incremental migration OR big-bang rewrite
3. Browser pooling strategy
4. Resource allocation (how many browser instances?)

---

## 📋 Phase 3: Test Infrastructure Setup (P0 - Parallel to Phase 2)

**Timeline:** 2-3 days
**Risk:** Low
**Impact:** Enables TDD approach for migration

### Tasks

- [ ] **Task 3.1:** Create test directory structure
  ```
  server/agents/__tests__/
    ├── extraction-agent.test.ts
    ├── discovery-agent.test.ts
    ├── search-agent.test.ts
    ├── monitoring-agent.test.ts
    ├── coordinator-agent.test.ts (expand existing)
    ├── base-agent.test.ts
    └── fixtures/
        ├── mock-html/
        │   ├── amazon-product.html
        │   ├── walmart-product.html
        │   └── target-product.html
        └── mock-responses/
  ```
  - **ETA:** 30 minutes

- [ ] **Task 3.2:** Create test utilities for scraping
  - Mock HTML fixtures for major retailers
  - Helper functions for creating mock browser contexts
  - Assertions for product data validation
  - Mock rate limiter for testing
  - **Output:** `server/agents/__tests__/test-utils.ts`
  - **ETA:** 2-3 hours

- [ ] **Task 3.3:** Write tests for `base-agent.ts`
  - Test task queue management
  - Test concurrency limiting
  - Test retry logic
  - Test error handling
  - Test status tracking
  - **Target:** 80%+ coverage
  - **ETA:** 4-6 hours

- [ ] **Task 3.4:** Write tests for current `extraction-agent.ts` (axios+cheerio version)
  - Test product title extraction
  - Test price extraction
  - Test availability detection
  - Test image URL extraction
  - Test error handling for malformed HTML
  - Test rate limiting
  - Test retry logic
  - **Purpose:** Establish baseline behavior before migration
  - **Target:** 70%+ coverage
  - **ETA:** 6-8 hours

- [ ] **Task 3.5:** Write tests for `discovery-agent.ts`
  - Test trend discovery logic
  - Test category filtering
  - Test deduplication
  - **Target:** 70%+ coverage
  - **ETA:** 4-6 hours

- [ ] **Task 3.6:** Write tests for `search-agent.ts`
  - Test search query building
  - Test result parsing
  - Test ranking logic
  - **Target:** 70%+ coverage
  - **ETA:** 4-6 hours

- [ ] **Task 3.7:** Write tests for `monitoring-agent.ts`
  - Test health check logic
  - Test metric collection
  - Test alerting thresholds
  - **Target:** 70%+ coverage
  - **ETA:** 3-4 hours

- [ ] **Task 3.8:** Expand tests for `coordinator-agent.ts`
  - Expand beyond transaction tests
  - Test task distribution
  - Test agent coordination
  - Test error recovery
  - **Target:** 80%+ coverage
  - **ETA:** 4-6 hours

**Success Criteria:** All existing agents have ≥70% test coverage before any migration work begins

---

## 📋 Phase 4: Playwright Migration - Core Extraction (P0)

**Timeline:** 3-5 days
**Risk:** High (core business logic)
**Impact:** Enables reliable scraping of modern websites

### Prerequisites
- ✅ Phase 2 complete (architecture approved)
- ✅ Phase 3 complete (test infrastructure ready)

### Tasks

- [ ] **Task 4.1:** Set up Playwright infrastructure
  - Add Playwright to production dependencies
  - Create browser pool manager (`server/utils/browser-pool.ts`)
  - Configure browser launch options
  - Set up browser context caching
  - Add monitoring for browser resource usage
  - **ETA:** 4-6 hours

- [ ] **Task 4.2:** Create Playwright extraction utilities
  - `server/utils/playwright-scraper-utils.ts`
  - Stealth mode configuration
  - Anti-bot detection evasion
  - Screenshot utility for debugging
  - Wait strategies (networkidle, domcontentloaded, custom)
  - **ETA:** 4-6 hours

- [ ] **Task 4.3:** Implement Playwright-based extraction agent (TDD)
  - Create `server/agents/extraction-agent-v2.ts`
  - Write tests FIRST (red-green-refactor)
  - Implement extraction logic using Playwright API
  - Use real browser contexts instead of axios
  - Handle JavaScript-rendered content
  - Implement error recovery
  - **Target:** 85%+ test coverage
  - **ETA:** 2-3 days

- [ ] **Task 4.4:** Update extraction strategies for Playwright
  - Convert CSS selectors to Playwright locators
  - Add wait strategies for dynamic content
  - Test against real retailer pages (in development)
  - Handle CAPTCHA detection (log and skip, don't attempt to solve)
  - **ETA:** 1-2 days

- [ ] **Task 4.5:** Create integration tests
  - Test extraction from mock server with JavaScript rendering
  - Test handling of slow-loading pages
  - Test error scenarios (timeout, network failure, invalid content)
  - Test browser cleanup and resource management
  - **ETA:** 1 day

- [ ] **Task 4.6:** Performance testing
  - Benchmark extraction speed (old vs new)
  - Test memory usage with multiple concurrent extractions
  - Test browser pool efficiency
  - Document resource requirements
  - **ETA:** 4-6 hours

**Success Criteria:**
- Playwright-based extraction agent passes all tests
- Performance acceptable (within 2x of old system)
- Resource usage within acceptable limits

---

## 📋 Phase 5: Integration & Feature Flag Rollout (P0)

**Timeline:** 3-5 days
**Risk:** Medium
**Impact:** Enables gradual migration with rollback capability

### Tasks

- [ ] **Task 5.1:** Implement feature flag system
  - Add feature flag for "use_playwright_scraper"
  - Store flag in database (per-retailer or global)
  - Add admin UI to toggle flag
  - Add logging for which scraper version is used
  - **ETA:** 4-6 hours

- [ ] **Task 5.2:** Create adapter layer
  - Create `ExtractionAgentAdapter` that can route to v1 (axios) or v2 (Playwright)
  - Ensure interface compatibility
  - Add metrics collection for both paths
  - **ETA:** 3-4 hours

- [ ] **Task 5.3:** Deploy to staging
  - Deploy with feature flag OFF
  - Run smoke tests
  - Enable flag for 1-2 test retailers
  - Monitor for 24-48 hours
  - **ETA:** 4-6 hours + monitoring time

- [ ] **Task 5.4:** A/B testing in production
  - Enable Playwright scraper for 10% of requests
  - Compare accuracy metrics (extraction success rate)
  - Compare performance metrics (latency, resource usage)
  - Monitor error rates
  - **ETA:** 1 week (mostly waiting/monitoring)

- [ ] **Task 5.5:** Gradual rollout
  - Week 1: 25% of traffic
  - Week 2: 50% of traffic
  - Week 3: 75% of traffic
  - Week 4: 100% of traffic (full migration)
  - Monitor at each step, rollback if issues
  - **ETA:** 1 month (mostly monitoring)

- [ ] **Task 5.6:** Remove old implementation
  - Delete `extraction-agent.ts` (old version)
  - Rename `extraction-agent-v2.ts` to `extraction-agent.ts`
  - Remove axios+cheerio dependencies if unused elsewhere
  - Remove feature flag system
  - Update documentation
  - **ETA:** 2-3 hours

**Success Criteria:**
- 100% of scraping requests use Playwright
- Error rate ≤ old system
- Accuracy rate ≥ old system
- No rollbacks needed

---

## 📋 Phase 6: Remaining Agents & Polish (P1)

**Timeline:** 1-2 weeks
**Risk:** Low
**Impact:** Complete test coverage, improve reliability

### Tasks

- [ ] **Task 6.1:** Update `discovery-agent.ts` to use Playwright
  - Migrate trend discovery to use browser automation
  - Add tests for JavaScript-rendered product listings
  - **ETA:** 2-3 days

- [ ] **Task 6.2:** Update `search-agent.ts` to use Playwright
  - Migrate search functionality to use browser
  - Handle SPA navigation
  - **ETA:** 2-3 days

- [ ] **Task 6.3:** Update monitoring & coordinator agents
  - Ensure compatibility with Playwright-based agents
  - Add monitoring for browser pool health
  - **ETA:** 1-2 days

- [ ] **Task 6.4:** Documentation
  - Update CLAUDE.md with Playwright usage patterns
  - Document scraping best practices
  - Create troubleshooting guide
  - Document selector maintenance process
  - **ETA:** 1 day

- [ ] **Task 6.5:** Enable reconnection tests
  - Fix or move to E2E as decided in Phase 2
  - **ETA:** 4-6 hours

**Success Criteria:**
- All agents using Playwright
- All agents have ≥80% test coverage
- Documentation complete

---

## 📋 Phase 7: Performance & Monitoring (P2)

**Timeline:** 1 week
**Risk:** Low
**Impact:** Operational excellence

### Tasks

- [ ] **Task 7.1:** Set up scraping dashboards
  - Extraction success rate by retailer
  - Average extraction time
  - Browser resource usage (memory, CPU)
  - Error rates and types
  - **ETA:** 1-2 days

- [ ] **Task 7.2:** Create alerting rules
  - Alert on extraction failure rate > 10%
  - Alert on browser pool exhaustion
  - Alert on memory leaks
  - **ETA:** 4-6 hours

- [ ] **Task 7.3:** Optimize browser pool
  - Tune pool size based on load
  - Implement browser context reuse
  - Add warmup strategy for cold starts
  - **ETA:** 1-2 days

- [ ] **Task 7.4:** Create maintenance runbook
  - Document common failure modes
  - Document recovery procedures
  - Document selector update process
  - **ETA:** 1 day

**Success Criteria:**
- Monitoring in place
- Team can diagnose and fix issues quickly
- System operates reliably at scale

---

## 📊 Resource Requirements

### Development Time
- **Phase 1:** 1-2 hours (1 developer)
- **Phase 2:** 1-2 days (1 developer + architecture review)
- **Phase 3:** 2-3 days (1-2 developers)
- **Phase 4:** 3-5 days (2 developers)
- **Phase 5:** 3-5 days + 1 month monitoring (1 developer + DevOps)
- **Phase 6:** 1-2 weeks (1-2 developers)
- **Phase 7:** 1 week (1 developer + DevOps)

**Total:** ~3 weeks active development + 1 month gradual rollout

### Infrastructure
- **Browser Instances:** 5-10 concurrent browsers (estimate)
- **Memory:** ~200-500MB per browser instance = 1-5GB total
- **CPU:** Moderate (browsers are CPU-intensive)
- **Cost:** Estimate $50-200/month additional compute costs (depends on scraping volume)

---

## ⚠️ Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Playwright slower than axios+cheerio | High | Medium | Feature flag allows rollback; optimize pool |
| Anti-bot detection | Medium | High | Use stealth mode, rotate user agents, rate limit |
| Resource exhaustion | Medium | High | Implement browser pool limits, monitoring |
| Selector changes break extraction | High | Medium | Monitoring alerts, fallback selectors |
| Team unfamiliar with Playwright | Low | Medium | Training, documentation, code reviews |
| Rollout issues | Medium | High | Gradual rollout with feature flags |

---

## ✅ Definition of Done

### Phase 1 (Quick Wins)
- [ ] All WebSocket tests passing (0 failures)
- [ ] Error code standardized
- [ ] CI green

### Phase 2 (Architecture)
- [ ] Architecture document approved
- [ ] Migration strategy documented
- [ ] Trade-offs understood and accepted

### Phase 3 (Test Infrastructure)
- [ ] All existing agents have ≥70% test coverage
- [ ] Test utilities created and documented
- [ ] Baseline behavior established

### Phase 4 (Core Migration)
- [ ] Playwright extraction agent implemented
- [ ] All tests passing with ≥85% coverage
- [ ] Performance acceptable
- [ ] Code reviewed and approved

### Phase 5 (Rollout)
- [ ] 100% of traffic using Playwright scraper
- [ ] Metrics show equal or better performance
- [ ] Old implementation removed
- [ ] Documentation updated

### Phase 6 (Complete)
- [ ] All agents migrated to Playwright
- [ ] All agents have ≥80% test coverage
- [ ] Reconnection tests enabled or moved to E2E

### Phase 7 (Excellence)
- [ ] Monitoring dashboards live
- [ ] Alerting configured
- [ ] Runbook documented
- [ ] Team trained

---

## 📞 Communication Plan

### Weekly Updates
- Summary of completed work
- Blockers and decisions needed
- Next week's plan

### Key Milestones
- Phase 1 complete → Announce WebSocket fixes
- Phase 2 complete → Share architecture decision
- Phase 4 complete → Demo new scraper
- Phase 5 50% → Report on A/B test results
- Phase 5 complete → Announce full migration
- Phase 6 complete → Celebrate 🎉

---

## 📚 References

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Stealth Plugin](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [Web Scraping Best Practices](https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)
- Current Implementation: `server/agents/extraction-agent.ts`
- CLAUDE.md Project Standards: `/Users/williamtower/projects/PriceCompare/CLAUDE.md`

---

## 🎯 Next Steps

1. **Review this plan** with stakeholders
2. **Get approval** for architecture approach
3. **Assign resources** (developers, DevOps)
4. **Start Phase 1** immediately (quick wins)
5. **Schedule architecture review** for Phase 2
6. **Set up project tracking** (GitHub project, Jira, etc.)

---

**Plan Author:** Claude Code
**Last Updated:** 2026-01-12
**Status:** AWAITING REVIEW
