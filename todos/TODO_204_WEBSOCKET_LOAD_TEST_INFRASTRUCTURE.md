# TODO 204: WebSocket Load Test Infrastructure

**Priority**: P4
**File(s)**:
- `server/websocket/__tests__/load.test.ts`
- `server/websocket/__tests__/test-utils.ts`

**Estimated Time**: 6-8 hours
**Status**: Not Started

## Problem Statement

9 load/performance tests are currently failing (0/9 passing) due to missing infrastructure for concurrent connection testing. These tests require:
- Managing 50-100+ concurrent WebSocket connections
- Coordinating message timing across connections
- Measuring throughput and latency under load
- Proper cleanup without test timeouts

**Failing Tests:**
- Server should handle concurrent connections gracefully
- Should broadcast to multiple clients efficiently
- Should maintain performance under sustained load
- Should handle burst connection attempts
- Should recover from connection storms
- Rate limiting should work under load
- Should handle concurrent room joins
- Should process concurrent messages efficiently
- Should maintain message ordering under load

## Root Cause

Load tests require specialized infrastructure not present in standard test setup:
1. **Connection pooling** - Creating 100+ concurrent socket connections
2. **Coordinated timing** - Starting/stopping operations across connections
3. **Resource management** - Properly cleaning up connections without timeouts
4. **Metrics collection** - Measuring latency, throughput, error rates
5. **Load simulation** - Realistic traffic patterns (bursts, sustained, etc.)

## Solution Approach

### Phase 1: Connection Management Infrastructure

Build utilities for managing many concurrent connections:
- Connection pool manager
- Batch connect/disconnect operations
- Connection lifecycle tracking
- Proper cleanup with configurable timeouts

### Phase 2: Load Simulation Utilities

Create helpers for realistic load patterns:
- Burst connection simulator (N connections in M milliseconds)
- Sustained load simulator (constant N connections for M seconds)
- Gradual ramp-up (0 to N connections over M seconds)
- Message rate simulator (X messages/second across connections)

### Phase 3: Metrics Collection

Add performance measurement utilities:
- Connection latency tracking
- Message roundtrip time measurement
- Throughput calculation (messages/second)
- Resource usage monitoring
- Error rate tracking

### Phase 4: Test Implementation

Implement the 9 load tests using new infrastructure:
- Set appropriate timeouts (30s+ for load tests)
- Use realistic load patterns
- Assert on performance metrics
- Include cleanup verification

## Implementation Steps

### Step 1: Connection Pool Manager

- [ ] Create `ConnectionPool` class for managing multiple connections
- [ ] Implement batch `connect()` and `disconnect()` methods
- [ ] Add connection state tracking
- [ ] Implement graceful cleanup with timeout handling
- [ ] Add helper for waiting until N connections ready

```typescript
class ConnectionPool {
  async createConnections(count: number): Promise<ClientSocket[]>
  async closeAll(timeout?: number): Promise<void>
  async waitForReady(): Promise<void>
  getConnectedCount(): number
  getState(): ConnectionState[]
}
```

### Step 2: Load Simulation Helpers

- [ ] Create `BurstSimulator` for rapid connections
- [ ] Create `SustainedLoadSimulator` for constant traffic
- [ ] Create `MessageRateSimulator` for controlled message flow
- [ ] Add `RampUpSimulator` for gradual load increase
- [ ] Implement cleanup and verification

```typescript
class BurstSimulator {
  constructor(pool: ConnectionPool)
  async simulateBurst(connectionCount: number, durationMs: number): Promise<void>
  getMetrics(): BurstMetrics
}
```

### Step 3: Metrics Collection

- [ ] Create `PerformanceMetrics` class
- [ ] Track connection latency (time to 'authenticated' event)
- [ ] Track message roundtrip time
- [ ] Calculate throughput (messages/second)
- [ ] Add percentile calculations (p50, p95, p99)

```typescript
class PerformanceMetrics {
  recordConnectionTime(durationMs: number): void
  recordMessageRoundtrip(durationMs: number): void
  getStats(): MetricsStats
  assertMeetsThresholds(thresholds: Thresholds): void
}
```

### Step 4: Test Configuration

- [ ] Increase test timeouts for load tests (30s+)
- [ ] Add environment-based connection limits (CI vs local)
- [ ] Configure appropriate performance thresholds
- [ ] Add skip conditions for resource-limited environments

### Step 5: Implement Load Tests

- [ ] "Should handle concurrent connections gracefully" (50 connections)
- [ ] "Should broadcast to multiple clients efficiently" (100 clients)
- [ ] "Should maintain performance under sustained load" (5min test)
- [ ] "Should handle burst connection attempts" (100 in 1s)
- [ ] "Should recover from connection storms" (500 rapid connects)
- [ ] "Rate limiting should work under load" (verify limits enforced)
- [ ] "Should handle concurrent room joins" (50 clients join same room)
- [ ] "Should process concurrent messages efficiently" (1000 msgs/sec)
- [ ] "Should maintain message ordering under load" (verify order)

## Technical Details

```typescript
// Example: Load test with infrastructure
describe('Load Tests', () => {
  let pool: ConnectionPool;
  let metrics: PerformanceMetrics;

  beforeAll(() => {
    pool = new ConnectionPool(port);
    metrics = new PerformanceMetrics();
  }, 30000); // 30s setup timeout

  afterAll(async () => {
    await pool.closeAll(10000); // 10s cleanup timeout
  }, 40000); // 40s teardown timeout

  it('should handle concurrent connections gracefully', async () => {
    const connectionCount = process.env.CI ? 50 : 100;

    // Create connections
    const start = Date.now();
    const clients = await pool.createConnections(connectionCount);
    const duration = Date.now() - start;

    // Wait for all to authenticate
    await Promise.all(
      clients.map(c => waitForEvent(c, 'authenticated'))
    );

    // Verify all connected
    expect(pool.getConnectedCount()).toBe(connectionCount);
    expect(duration).toBeLessThan(5000); // Under 5s for all connections

    // Record metrics
    metrics.recordConnectionTime(duration / connectionCount);

    // Cleanup
    await pool.closeAll();
  }, 30000); // 30s test timeout

  it('should broadcast to multiple clients efficiently', async () => {
    const clientCount = 100;
    const clients = await pool.createConnections(clientCount);

    // Setup listeners
    const promises = clients.map(c =>
      waitForEvent(c, 'watchlist:update', 5000)
    );

    // Broadcast message
    const io = getSocketIO();
    const start = Date.now();
    emitWatchListUpdate(io, testUserId, 'created', {
      id: 1,
      name: 'Test',
      productCount: 0
    });

    // Wait for all clients to receive
    await Promise.all(promises);
    const duration = Date.now() - start;

    // Assert performance
    expect(duration).toBeLessThan(1000); // Under 1s for 100 clients
    metrics.recordMessageRoundtrip(duration);
  }, 30000);
});
```

## Checklist

- [ ] Connection pool infrastructure implemented
- [ ] Load simulation utilities created
- [ ] Metrics collection system built
- [ ] Test timeouts configured appropriately
- [ ] All 9 load tests implemented
- [ ] Tests pass in local environment
- [ ] Tests pass in CI environment (with adjusted limits)
- [ ] Documentation for running load tests

## Success Criteria

- [ ] All 9 load tests pass
- [ ] Infrastructure reusable for future load tests
- [ ] Tests complete in reasonable time (< 5 min total)
- [ ] Proper cleanup prevents test environment contamination
- [ ] Performance thresholds realistic and stable
- [ ] CI/local environment differences handled gracefully

## Performance Thresholds (Initial)

Based on requirements for production use:

**Connection Performance:**
- 100 concurrent connections: < 5 seconds total
- Single connection latency: < 50ms (p95)
- Connection success rate: > 99%

**Message Performance:**
- Broadcast to 100 clients: < 1 second
- Message roundtrip time: < 100ms (p95)
- Throughput: > 1000 messages/second

**Rate Limiting:**
- Limits enforced under load
- No false positives under normal load
- Recovery after limit expires

**Resource Management:**
- No memory leaks during sustained load
- Clean disconnection without hangs
- Server remains responsive under load

## Related Context

**Current Status:**
- 0/9 load tests passing
- Load tests are lowest priority (P4)
- Core functionality verified by unit tests
- Production scaling validated by E2E tests

**Why This Matters (Low Priority):**
- Validates WebSocket server can handle production load
- Catches performance regressions early
- Documents expected performance characteristics
- Provides confidence for scaling

**Why Low Priority:**
- Production already handles real-world load successfully
- E2E tests validate actual use cases
- Infrastructure effort is high relative to value
- Performance monitored in production

**Alternatives to Consider:**
- Accept E2E-only validation of load handling
- Use production metrics for performance validation
- Defer until scaling issues appear in production
- Use external load testing tools (k6, Artillery, etc.)

---

## Notes

This is an **optional enhancement** with **very low production impact**. The WebSocket server handles production load successfully. These tests would provide earlier detection of performance regressions but are not critical.

**Effort vs Value:**
- **High Effort**: Building concurrent connection infrastructure (6-8 hours)
- **Low Value**: Production already handles load, E2E tests cover real usage
- **Recommendation**: Defer until needed or use external load testing tools

**When to Prioritize:**
- After experiencing production performance issues
- Before major scaling milestone (10x user growth)
- If adding features with performance concerns
- If replacing with external load testing framework

**External Tools Alternative:**
Instead of building custom infrastructure, consider:
- **k6** - Modern load testing tool with WebSocket support
- **Artillery** - Scenario-based load testing
- **Playwright** - Can handle concurrent connections for load testing
- **Custom script** - Simple Node.js script for basic load testing

This approach would provide better load testing with less effort.

