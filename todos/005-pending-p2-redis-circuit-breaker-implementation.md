# TODO 005: Implement Circuit Breaker for Redis Cache Failures

**Status:** pending
**Priority:** P2 (Important)
**Created:** 2025-12-26
**Tags:** performance, reliability, caching, resilience

---

## Problem Statement

When Redis fails, all cache misses fall back directly to the database without circuit breaker protection. During a Redis outage, this creates a 5x increase in database load (from 20% to 100%) which could saturate connections and cascade into a complete outage.

**Why This Matters:**
- **Cascading Failures:** Redis down → DB overload → Total outage
- **Resource Saturation:** Database connection pool exhaustion
- **Recovery Time:** System may not recover even after Redis restoration
- **User Impact:** Complete service disruption vs graceful degradation

---

## Findings

**Source:** Performance Oracle & Architecture Strategist Agent Reviews (2025-12-26)

**Current Behavior:**
```typescript
// File: server/services/storage-cache.ts:182-197
private async cachedGet<T>(cacheKey: string, fetchFn: () => Promise<T>) {
  try {
    return await this.cache.getOrSet(cacheKey, fetchFn, tier, useL1);
  } catch (error) {
    logger.warn('Cache operation failed, falling back to storage layer');
    return await fetchFn(); // ⚠️ Every request hits DB directly
  }
}
```

**Risk Scenario:**
```
Normal Operation (Redis healthy):
- 80% cache hits → 20% DB queries
- Database handles load comfortably

Redis Outage:
- 100% cache misses → 100% DB queries
- 5x increase in DB load
- Connection pool saturated (100/100 connections)
- New requests timeout
- Service degrades to complete outage
```

---

## Proposed Solutions

### Solution 1: Circuit Breaker Pattern (Recommended)

**Pros:**
- Prevents cascading failures
- Automatic recovery detection
- Industry-standard pattern
- Configurable thresholds

**Cons:**
- Adds state management
- Need to tune parameters

**Effort:** 4-5 hours
**Risk:** Medium (state management complexity)

**Implementation:**
```typescript
// server/services/storage-cache.ts

interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

class StorageCacheService {
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: null,
    state: 'CLOSED',
  };

  private readonly CB_THRESHOLD = 10;        // Open after 10 failures
  private readonly CB_TIMEOUT = 60000;       // Try again after 60 seconds
  private readonly CB_HALF_OPEN_LIMIT = 3;   // Test with 3 requests

  private isCircuitOpen(): boolean {
    if (this.circuitBreaker.state === 'OPEN') {
      const elapsed = Date.now() - (this.circuitBreaker.lastFailure?.getTime() ?? 0);
      if (elapsed > this.CB_TIMEOUT) {
        logger.info('[Circuit Breaker] Moving to HALF_OPEN state');
        this.circuitBreaker.state = 'HALF_OPEN';
        this.circuitBreaker.failures = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = new Date();

    if (this.circuitBreaker.failures >= this.CB_THRESHOLD) {
      logger.error('[Circuit Breaker] OPEN - Redis cache bypassed', {
        failures: this.circuitBreaker.failures,
        threshold: this.CB_THRESHOLD,
      });
      this.circuitBreaker.state = 'OPEN';
    }
  }

  private recordSuccess(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      logger.info('[Circuit Breaker] HALF_OPEN test successful, closing circuit');
    }
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = 'CLOSED';
  }

  private async cachedGet<T>(cacheKey: string, fetchFn: () => Promise<T>) {
    // Circuit breaker check
    if (this.isCircuitOpen()) {
      logger.warn('[Circuit Breaker] OPEN - bypassing Redis cache');
      return await fetchFn();
    }

    try {
      const result = await this.cache.getOrSet(cacheKey, fetchFn, tier, useL1);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      logger.warn('[Cache] Operation failed, falling back to database', {
        circuitState: this.circuitBreaker.state,
        failures: this.circuitBreaker.failures,
      });
      return await fetchFn();
    }
  }
}
```

### Solution 2: Rate Limiting on Cache Fallback

**Pros:**
- Simpler than circuit breaker
- Protects database from overload

**Cons:**
- Requests may be rejected (UX impact)
- Doesn't detect recovery
- Less sophisticated

**Effort:** 2-3 hours
**Risk:** Low

### Solution 3: Queue-Based Backpressure

**Pros:**
- No requests rejected
- Graceful degradation

**Cons:**
- Complex implementation
- Latency increases

**Effort:** 6-8 hours
**Risk:** High

---

## Recommended Action

**Implement Solution 1** (Circuit Breaker Pattern)

**Rationale:**
- Industry-standard resilience pattern
- Automatic recovery detection
- Prevents cascading failures
- Metrics integration (can track circuit state)
- Battle-tested approach (Netflix Hystrix, Resilience4j)

---

## Technical Details

**Affected Files:**
- `server/services/storage-cache.ts` (add circuit breaker logic)
- `server/services/monitoring-service.ts` (add circuit breaker metrics)
- Test: `server/services/__tests__/storage-cache.test.ts`

**Configuration:**
```typescript
// server/utils/constants.ts
export const CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: 10,      // Open after 10 failures
  TIMEOUT_MS: 60000,          // Wait 60s before trying again
  HALF_OPEN_LIMIT: 3,         // Test with 3 requests
};
```

**Database Changes:** None

**Migration Required:** No

---

## Acceptance Criteria

- [ ] Add circuit breaker state to `StorageCacheService`
- [ ] Implement `isCircuitOpen()` method
- [ ] Implement `recordFailure()` method
- [ ] Implement `recordSuccess()` method
- [ ] Add circuit breaker check to `cachedGet()`
- [ ] Add configuration in `constants.ts`
- [ ] Add metrics for circuit breaker state
- [ ] Add integration test for Redis failure scenario
- [ ] Test CLOSED → OPEN transition (after 10 failures)
- [ ] Test OPEN → HALF_OPEN transition (after timeout)
- [ ] Test HALF_OPEN → CLOSED transition (on success)
- [ ] Test HALF_OPEN → OPEN transition (on continued failure)
- [ ] Document pattern in `docs/ARCHITECTURE.md`

**Monitoring:**
- [ ] Add circuit breaker state to monitoring dashboard
- [ ] Alert when circuit opens
- [ ] Track time circuit remains open
- [ ] Log circuit state transitions

---

## Work Log

**2025-12-26:** Issue identified during performance and architecture audit - cascading failure risk

---

## Resources

- [Circuit Breaker Pattern (Martin Fowler)](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Resilience4j Documentation](https://resilience4j.readme.io/docs/circuitbreaker)
- [Netflix Hystrix](https://github.com/Netflix/Hystrix/wiki/How-it-Works#CircuitBreaker)
- File: `server/services/storage-cache.ts`
- Architecture Review: 2025-12-26
