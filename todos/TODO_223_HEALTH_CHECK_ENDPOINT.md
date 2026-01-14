# TODO 223: Missing Health Check Endpoint

**Priority**: P1 - HIGH
**File(s)**: `server/routes/health.ts` (new), `server/index.ts`
**Estimated Time**: 30 minutes
**Status**: Not Started
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

- [ ] `/health` endpoint created (basic liveness)
- [ ] `/health/ready` endpoint created (dependency checks)
- [ ] Database connectivity check implemented
- [ ] Redis connectivity check implemented
- [ ] Appropriate HTTP status codes returned
- [ ] Routes registered before auth middleware

## Success Criteria

- [ ] `GET /health` returns 200 with status info
- [ ] `GET /health/ready` returns 200 when all dependencies healthy
- [ ] `GET /health/ready` returns 503 when database is down
- [ ] Health endpoints accessible without authentication
- [ ] Response includes latency metrics for dependencies
- [ ] All tests pass

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
- [ ] **Grep verification**: Confirm health routes exist
  ```bash
  # Verify health route file exists
  ls server/routes/health.ts
  
  # Verify routes are registered
  grep -n "healthRouter" server/index.ts
  
  # Verify endpoints exist
  grep -n "'/health" server/routes/health.ts
  ```

- [ ] **File inspection**: Review health check implementations
  ```bash
  cat server/routes/health.ts
  ```

### Testing
- [ ] **Manual endpoint testing**:
  ```bash
  # Basic health (should return 200)
  curl -v http://localhost:5000/health
  
  # Readiness check (should return 200 with dependency status)
  curl -v http://localhost:5000/health/ready
  
  # Verify JSON structure
  curl -s http://localhost:5000/health/ready | jq .
  ```

- [ ] **Run affected tests**: Execute health check tests
  ```bash
  npm test -- health
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors
  ```bash
  npm run check
  ```

- [ ] **ESLint check**: Verify no linting errors
  ```bash
  npm run lint
  ```

---

## ✅ RESOLUTION (YYYY-MM-DD)

**Decision**: [To be completed]

### Summary

[To be completed upon resolution]

### Changes Made

[To be completed upon resolution]

### Verification Results

[To be completed upon resolution]

---

**Created by**: Claude Code (Security Audit)
**Completion Date**: TBD
**Actual Time**: TBD
