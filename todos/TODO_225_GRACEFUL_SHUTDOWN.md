# TODO 225: Missing Graceful Shutdown

**Priority**: P2 - MEDIUM
**File(s)**: `server/index.ts`
**Estimated Time**: 30 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Server doesn't gracefully handle SIGTERM/SIGINT signals, causing:

1. **In-flight requests dropped**: Active requests terminated mid-execution
2. **Data loss**: Uncommitted transactions lost
3. **Resource leaks**: Database/Redis connections not properly closed
4. **Job corruption**: Background jobs interrupted without cleanup
5. **Poor deployment experience**: Rolling deploys cause errors

**Operational Impact**: Data loss during deployments, user errors during restarts, zombie connections.

## Root Cause

No signal handlers implemented for process termination signals.

## Solution Approach

1. Implement SIGTERM/SIGINT handlers
2. Stop accepting new connections
3. Wait for in-flight requests to complete
4. Close database and Redis connections
5. Gracefully shut down job queues
6. Force exit after timeout

## Implementation Steps

### Step 1: Add Signal Handlers

- [ ] Listen for SIGTERM and SIGINT
- [ ] Log shutdown initiation
- [ ] Prevent duplicate shutdown attempts

### Step 2: Implement Graceful Shutdown Sequence

- [ ] Stop HTTP server from accepting new connections
- [ ] Wait for active requests to complete (with timeout)
- [ ] Close database connection pool
- [ ] Close Redis connection
- [ ] Close Bull job queues

### Step 3: Add Timeout and Force Exit

- [ ] Set maximum wait time (30 seconds)
- [ ] Force exit if graceful shutdown takes too long
- [ ] Log forced exit for debugging

### Step 4: Test Shutdown Behavior

- [ ] Test during active requests
- [ ] Test with active background jobs
- [ ] Test timeout behavior

## Technical Details

**Current Implementation (NO GRACEFUL SHUTDOWN):**
```typescript
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ❌ No signal handling - process killed immediately
// ❌ In-flight requests dropped
// ❌ Connections not closed
// ❌ Jobs interrupted
```

**Fixed Implementation:**
```typescript
// server/index.ts
import { Server } from 'http';

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Track shutdown state to prevent multiple attempts
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log('Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\nReceived ${signal}, starting graceful shutdown...`);
  
  // Set a hard deadline for shutdown
  const forceExitTimeout = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout
  
  try {
    // Step 1: Stop accepting new connections
    console.log('Stopping HTTP server...');
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          console.error('Error closing HTTP server:', err);
          reject(err);
        } else {
          console.log('HTTP server closed');
          resolve();
        }
      });
    });
    
    // Step 2: Close job queues (wait for active jobs)
    console.log('Closing job queues...');
    if (priceScraperQueue) {
      await priceScraperQueue.close();
      console.log('Price scraper queue closed');
    }
    
    // Step 3: Close WebSocket connections
    console.log('Closing WebSocket connections...');
    if (io) {
      io.close();
      console.log('WebSocket server closed');
    }
    
    // Step 4: Close Redis connection
    console.log('Closing Redis connection...');
    if (redisClient) {
      await redisClient.quit();
      console.log('Redis connection closed');
    }
    
    // Step 5: Close database connection pool
    console.log('Closing database connections...');
    if (db.$client) {
      await db.$client.end();
      console.log('Database connections closed');
    }
    
    // Clear the force exit timeout
    clearTimeout(forceExitTimeout);
    
    console.log('Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions during shutdown
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection, but log it
});
```

**Enhanced Shutdown with Connection Draining:**
```typescript
// server/utils/graceful-shutdown.ts
import { Server } from 'http';
import { Socket } from 'net';

interface ShutdownOptions {
  timeout: number;
  signals: NodeJS.Signals[];
  onShutdown?: () => Promise<void>;
}

export function setupGracefulShutdown(
  server: Server,
  options: ShutdownOptions
): void {
  const { timeout, signals, onShutdown } = options;
  
  // Track active connections for draining
  const connections = new Set<Socket>();
  
  server.on('connection', (socket) => {
    connections.add(socket);
    socket.on('close', () => connections.delete(socket));
  });
  
  let isShuttingDown = false;
  
  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`Received ${signal}, shutting down gracefully...`);
    
    // Force exit after timeout
    const forceExitTimer = setTimeout(() => {
      console.error(`Shutdown timed out after ${timeout}ms, forcing exit`);
      process.exit(1);
    }, timeout);
    
    try {
      // Stop accepting new connections
      server.close();
      
      // Close idle connections immediately
      for (const socket of connections) {
        // Keep-alive connections without active requests
        if (!socket.destroyed) {
          socket.end();
        }
      }
      
      // Wait a moment for requests to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Force close remaining connections
      for (const socket of connections) {
        if (!socket.destroyed) {
          socket.destroy();
        }
      }
      
      // Run custom shutdown logic
      if (onShutdown) {
        await onShutdown();
      }
      
      clearTimeout(forceExitTimer);
      console.log('Graceful shutdown completed');
      process.exit(0);
      
    } catch (error) {
      console.error('Error during shutdown:', error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }
  
  // Register signal handlers
  for (const signal of signals) {
    process.on(signal, () => shutdown(signal));
  }
}
```

**Usage in Main App:**
```typescript
// server/index.ts
import { setupGracefulShutdown } from './utils/graceful-shutdown';

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

setupGracefulShutdown(server, {
  timeout: 30000,
  signals: ['SIGTERM', 'SIGINT'],
  onShutdown: async () => {
    // Close job queues
    await priceScraperQueue?.close();
    
    // Close WebSocket server
    io?.close();
    
    // Close Redis
    await redisClient?.quit();
    
    // Close database
    await db.$client?.end();
  },
});
```

**Docker/Kubernetes Considerations:**
```dockerfile
# Dockerfile
# Use exec form to receive signals properly
CMD ["node", "dist/index.js"]
# NOT: CMD node dist/index.js (shell form doesn't forward signals)
```

```yaml
# kubernetes/deployment.yaml
spec:
  terminationGracePeriodSeconds: 35  # Slightly longer than app timeout
  containers:
    - name: pricecompare
      lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 5"]  # Allow load balancer to update
```

## Checklist

- [ ] SIGTERM handler implemented
- [ ] SIGINT handler implemented
- [ ] HTTP server stops accepting connections
- [ ] Wait for in-flight requests
- [ ] Job queues closed gracefully
- [ ] WebSocket connections closed
- [ ] Redis connection closed
- [ ] Database connections closed
- [ ] Timeout with force exit
- [ ] Tested during active requests

## Success Criteria

- [ ] No dropped requests during deployment
- [ ] No error logs from interrupted jobs
- [ ] Database connections properly closed
- [ ] Process exits with code 0 on clean shutdown
- [ ] Process exits with code 1 on forced shutdown
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Long-running requests block shutdown | Medium | Medium | Timeout with force exit |
| Zombie processes | Low | Medium | Always call process.exit() |
| Double shutdown attempts | Low | Low | Track shutdown state |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm signal handlers exist
  ```bash
  # Verify SIGTERM handler
  grep -n "SIGTERM" server/index.ts
  
  # Verify SIGINT handler
  grep -n "SIGINT" server/index.ts
  
  # Verify graceful shutdown function
  grep -n "gracefulShutdown" server/index.ts
  ```

- [ ] **File inspection**: Review shutdown implementation
  ```bash
  grep -A 50 "gracefulShutdown" server/index.ts
  ```

### Testing
- [ ] **Manual shutdown test**:
  ```bash
  # Start server
  npm run dev &
  SERVER_PID=$!
  
  # Make a long-running request
  curl http://localhost:5000/api/products &
  
  # Send SIGTERM
  kill -TERM $SERVER_PID
  
  # Observe logs - should show graceful shutdown sequence
  # Request should complete before server exits
  ```

- [ ] **Run affected tests**: Execute shutdown tests (if any)
  ```bash
  npm test -- shutdown
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
