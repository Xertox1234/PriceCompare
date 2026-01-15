# TODO 223: Missing Health Check Endpoint

**Priority**: P1 - HIGH
**File(s)**: `server/routes/health.ts` (new), `server/index.ts`
**Estimated Time**: 30 minutes
**Status**: COMPLETED
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

No health check endpoint exists for load balancers or monitoring systems. Without health checks:

1. Load balancers can't determine if the service is healthy
2. Kubernetes/Docker can't perform readiness/liveness probes
3. No visibility into dependency health (database, Redis)
4. Incidents detected late (only when users complain)

**Operational Impact**: Poor observability, delayed incident response, unreliable deployments.

## Root Cause

Health endpoints were not implemented during initial development.

## Solution Approach

1. Create `/health` endpoint for basic liveness (fast, no dependencies)
2. Create `/health/ready` endpoint for readiness (checks dependencies)
3. Return appropriate HTTP status codes (200 healthy, 503 unhealthy)
4. Include diagnostic information for debugging

## Implementation Steps

### Step 1: Create Health Routes

- [ ] Create `server/routes/health.ts`
- [ ] Implement `/health` (basic liveness)
- [ ] Implement `/health/ready` (dependency checks)

### Step 2: Add Dependency Checks

- [ ] PostgreSQL connectivity check
- [ ] Redis connectivity check
- [ ] Include latency metrics

### Step 3: Register Routes

- [ ] Add health routes to `server/index.ts`
- [ ] Ensure routes are BEFORE auth middleware (public endpoints)
- [ ] No CSRF protection on health endpoints

### Step 4: Add Monitoring Integration

- [ ] Return structured JSON for monitoring systems
- [ ] Include memory usage metrics
- [ ] Include uptime information

## Technical Details

**Health Routes Implementation:**
```typescript
// server/routes/health.ts
import { Router } from 'express';
import { db } from '../db';
import { redisClient } from '../redis';
import { sql } from 'drizzle-orm';

export const healthRouter = Router();

interface HealthCheck {
  status: 'pass' | 'fail';
  latencyMs?: number;
  message?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

/**
 * Basic liveness check - fast, no dependencies
 * Used by load balancers for quick health verification
 * 
 * GET /health
 */
healthRouter.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Readiness check - verifies all dependencies
 * Used by Kubernetes for readiness probes
 * Returns 503 if any critical dependency is down
 * 
 * GET /health/ready
 */
healthRouter.get('/health/ready', async (req, res) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    uptime: process.uptime(),
    checks: {
      database: { status: 'fail' },
      redis: { status: 'fail' },
    },
    memory: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };

  // Check PostgreSQL
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    health.checks.database = { 
      status: 'pass', 
      latencyMs: Date.now() - dbStart,
    };
  } catch (error) {
    health.checks.database = { 
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'unhealthy';
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    await redisClient.ping();
    health.checks.redis = { 
      status: 'pass', 
      latencyMs: Date.now() - redisStart,
    };
  } catch (error) {
    health.checks.redis = { 
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    // Redis down = degraded (can still serve cached data)
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
  }

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(health);
});

/**
 * Deep health check - detailed diagnostics
 * Only accessible in non-production or with auth
 * 
 * GET /health/detailed
 */
healthRouter.get('/health/detailed', async (req, res) => {
  // Only allow detailed checks in development or with special header
  if (process.env.NODE_ENV === 'production' && 
      req.headers['x-health-key'] !== process.env.HEALTH_CHECK_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const detailed = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    uptime: process.uptime(),
    pid: process.pid,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    // Add more diagnostics as needed
  };
  
  res.json(detailed);
});
```

**Register in Main App:**
```typescript
// server/index.ts
import { healthRouter } from './routes/health';

// ... other imports

const app = express();

// ✅ Health routes FIRST - before any middleware
// These must be accessible without auth, CSRF, or rate limiting
app.use(healthRouter);

// ... rest of middleware and routes
```

**Kubernetes Probe Configuration:**
```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: pricecompare
          livenessProbe:
            httpGet:
              path: /health
              port: 5000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 5000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 10
            failureThreshold: 3
```

**Docker Healthcheck:**
```dockerfile
# Dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1
```

## Checklist

- [x] `/health` endpoint created (basic liveness)
- [x] `/health/ready` endpoint created (dependency checks)
- [x] Database connectivity check implemented
- [x] Redis connectivity check implemented
- [x] Appropriate HTTP status codes returned
- [x] Routes registered before auth middleware

## Success Criteria

- [x] `GET /health` returns 200 with status info
- [x] `GET /health/ready` returns 200 when all dependencies healthy
- [x] `GET /health/ready` returns 503 when database is down
- [x] Health endpoints accessible without authentication
- [x] Response includes latency metrics for dependencies
- [x] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Health check causes load | Low | Low | Keep checks lightweight |
| Expose internal info | Medium | Low | Limit detailed info to dev/auth |
| False positives/negatives | Low | Medium | Test thoroughly, tune thresholds |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [x] **Grep verification**: Confirm health routes exist
  ```bash
  # Verify health route file exists
  ls server/routes/health.ts
  # ✅ File exists: -rw-r--r-- 5074 bytes

  # Verify routes are registered
  grep -n "healthRouter" server/index.ts
  # ✅ Line 83: import { healthRouter } from './routes/health';
  # ✅ Line 84: app.use(healthRouter);

  # Verify endpoints exist
  grep -n "'/health" server/routes/health.ts
  # ✅ Line 52: healthRouter.get('/health', ...)
  # ✅ Line 75: healthRouter.get('/health/ready', ...)
  # ✅ Line 165: healthRouter.get('/health/detailed', ...)
  ```

- [x] **File inspection**: Review health check implementations
  ```bash
  cat server/routes/health.ts
  # ✅ All three endpoints implemented with proper error handling
  ```

### Testing
- [x] **Manual endpoint testing**:
  ```bash
  # Basic health (should return 200)
  curl http://localhost:5001/health
  # ✅ Returns: {"status":"ok","timestamp":"2026-01-15T13:48:00.731Z","uptime":59.91}

  # Readiness check (should return 200 with dependency status)
  curl http://localhost:5001/health/ready
  # ✅ Returns: {"status":"healthy","checks":{"database":{"status":"pass","latencyMs":0},"redis":{"status":"pass","latencyMs":68}},...}

  # Verify JSON structure
  curl -s http://localhost:5001/health/ready | jq .
  # ✅ Valid JSON with all required fields
  ```

- [x] **Run affected tests**: Execute health check tests
  ```bash
  npm test -- health
  # ✅ Test Files: 1 passed (1)
  # ✅ Tests: 16 passed (16)
  # ✅ Duration: 669ms
  ```

### Build & Type Safety
- [x] **TypeScript compilation**: Ensure no type errors
  ```bash
  npm run check
  # ✅ No TypeScript errors in health.ts
  # ✅ All types properly defined with interfaces
  ```

- [x] **ESLint check**: Verify no linting errors
  ```bash
  npm run lint
  # ✅ No ESLint errors in server/routes/health.ts
  # ✅ No warnings for health endpoints
  ```

---

## ✅ RESOLUTION (2026-01-15)

**Decision**: Implemented comprehensive health check endpoints for production monitoring and Kubernetes/Docker deployments.

### Summary

Successfully implemented three health check endpoints to support load balancers, Kubernetes probes, and monitoring systems:

1. **`GET /health`** - Basic liveness check (fast, no dependencies)
   - Returns simple status for quick load balancer checks
   - Response time < 100ms
   - No database or Redis dependencies

2. **`GET /health/ready`** - Readiness check with dependency verification
   - Checks PostgreSQL database connectivity with latency metrics
   - Checks Redis connectivity with latency metrics
   - Returns 200 for healthy/degraded, 503 for unhealthy
   - Includes memory usage metrics (heap, RSS)
   - Status: healthy (all pass), degraded (Redis down), unhealthy (DB down)

3. **`GET /health/detailed`** - Deep diagnostics
   - Development-only or requires `X-Health-Key` header in production
   - Returns Node.js version, process ID, uptime, CPU usage
   - Detailed memory metrics for debugging

### Changes Made

**Files Created:**
- `/Users/williamtower/projects/PriceCompare/server/routes/health.ts` (5074 bytes)
  - Three health endpoints with full type safety
  - Database and Redis connectivity checks
  - Memory and CPU metrics collection
  - Production security guard for detailed endpoint

- `/Users/williamtower/projects/PriceCompare/server/routes/__tests__/health.test.ts`
  - 16 comprehensive tests covering all endpoints
  - Tests for status codes, response format, latency metrics
  - Production security verification
  - Response consistency validation

**Files Modified:**
- `/Users/williamtower/projects/PriceCompare/server/index.ts`
  - Registered health routes BEFORE all middleware (lines 83-84)
  - Ensures health checks bypass auth, CSRF, rate limiting
  - Placed after global error handlers but before Sentry middleware

### Verification Results

**Code Verification:**
- ✅ Health route file exists (5074 bytes)
- ✅ Routes registered in server/index.ts (lines 83-84)
- ✅ All three endpoints implemented (lines 52, 75, 165)
- ✅ Proper placement before all middleware

**Testing:**
- ✅ Manual testing: All endpoints return correct responses
  - `/health`: 200 with status, timestamp, uptime
  - `/health/ready`: 200 with database (pass, 0ms), Redis (pass, 68ms), memory metrics
  - `/health/detailed`: 200 with full diagnostics in development
- ✅ Automated testing: 16/16 tests passed in 669ms
  - Basic liveness tests
  - Dependency connectivity tests
  - Status code verification
  - Memory metrics validation
  - Production security tests
  - Response format consistency

**Build & Type Safety:**
- ✅ TypeScript compilation: No type errors
- ✅ ESLint check: No linting errors or warnings
- ✅ All types properly defined with interfaces (HealthCheck, HealthStatus)
- ✅ Promise return types explicit on async handlers

**Architecture Compliance:**
- ✅ Health routes registered BEFORE auth middleware (correct placement)
- ✅ No CSRF protection on health endpoints (public access)
- ✅ No rate limiting on health endpoints (load balancer needs)
- ✅ Uses `getRedisClient()` from config/redis.ts (dual Redis pattern)
- ✅ Uses `db.execute(sql\`SELECT 1\`)` for database check (Drizzle ORM)
- ✅ Proper error handling with try/catch blocks
- ✅ Return type annotations (Promise<void>, void) for type safety

**Production Readiness:**
- ✅ Liveness probe: Fast, no dependencies, < 100ms response
- ✅ Readiness probe: Verifies critical dependencies (DB, Redis)
- ✅ Status codes: 200 (healthy/degraded), 503 (unhealthy)
- ✅ Latency metrics: Database and Redis response times included
- ✅ Memory metrics: Heap usage, RSS for debugging
- ✅ Security: Detailed endpoint requires auth in production
- ✅ JSON responses: All endpoints return structured JSON

---

**Created by**: Claude Code (Security Audit)
**Completion Date**: 2026-01-15
**Actual Time**: 25 minutes
