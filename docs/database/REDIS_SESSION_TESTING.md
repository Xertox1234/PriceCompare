# Redis Session Storage Testing Guide

This document provides comprehensive testing procedures for Redis session storage, including multi-instance session sharing, persistence verification, and load testing.

## Overview

Redis session storage enables:
- **Session persistence** across server restarts
- **Distributed sessions** across multiple server instances
- **Horizontal scaling** with load balancing
- **Production-ready** session management

## Automated Tests

Run the automated test suite:

```bash
npm test server/__tests__/redis-session-storage.test.ts
```

The test suite covers:
- ✅ Redis session client initialization
- ✅ Session store creation with Redis
- ✅ Session creation on login
- ✅ Session persistence across requests
- ✅ Session destruction on logout
- ✅ Correct Redis key prefixing (`sess:*`)
- ✅ Session TTL configuration (24 hours)
- ✅ Concurrent sessions for different users
- ✅ Graceful fallback when Redis is unavailable

## Manual Testing Procedures

### 1. Session Persistence Across Server Restarts

**Objective**: Verify sessions survive server restarts

**Steps**:
1. Start Redis server:
   ```bash
   redis-server
   ```

2. Start the application:
   ```bash
   npm run dev
   ```

3. Login via the web interface or API:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}' \
     -c cookies.txt
   ```

4. Verify session exists in Redis:
   ```bash
   redis-cli KEYS "sess:*"
   ```
   Expected: One or more session keys

5. **Restart the server** (Ctrl+C, then `npm run dev`)

6. Make authenticated request with saved cookie:
   ```bash
   curl http://localhost:5000/api/auth/me -b cookies.txt
   ```
   Expected: User data returned (session persisted)

**Success Criteria**: Session data is preserved after server restart

---

### 2. Multi-Instance Session Sharing

**Objective**: Verify sessions work across multiple server instances

**Prerequisites**:
- Redis running on default port (6379)
- Two terminal windows

**Steps**:

#### Terminal 1: Start Instance 1 on port 5000
```bash
PORT=5000 npm run dev
```

#### Terminal 2: Start Instance 2 on port 5001
```bash
PORT=5001 npm run dev
```

#### Test Session Sharing:

1. **Login on Instance 1**:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}' \
     -c cookies.txt -v
   ```

2. **Verify session in Redis**:
   ```bash
   redis-cli KEYS "sess:*"
   redis-cli GET "sess:<session-id>"
   ```

3. **Make authenticated request to Instance 2** using the cookie from Instance 1:
   ```bash
   curl http://localhost:5001/api/auth/me -b cookies.txt
   ```
   Expected: User data returned (session shared across instances)

4. **Logout on Instance 2**:
   ```bash
   curl -X POST http://localhost:5001/api/auth/logout -b cookies.txt
   ```

5. **Verify session deleted in Redis**:
   ```bash
   redis-cli KEYS "sess:*"
   ```
   Expected: No session keys (or fewer if other sessions exist)

6. **Try authenticated request on Instance 1**:
   ```bash
   curl http://localhost:5000/api/auth/me -b cookies.txt
   ```
   Expected: Unauthenticated (401 or guest response)

**Success Criteria**:
- Sessions created on one instance are accessible on another instance
- Session deletion on one instance affects all instances

---

### 3. Session Expiry and TTL Verification

**Objective**: Verify sessions expire after configured TTL

**Steps**:

1. Configure short TTL for testing (edit `server/config/session-store.ts`):
   ```typescript
   ttl: 10, // 10 seconds instead of 86400
   ```

2. Restart server and login:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}' \
     -c cookies.txt
   ```

3. Check TTL in Redis:
   ```bash
   redis-cli KEYS "sess:*"
   redis-cli TTL "sess:<session-id>"
   ```
   Expected: TTL around 10 seconds

4. **Wait 15 seconds**

5. Make authenticated request:
   ```bash
   curl http://localhost:5000/api/auth/me -b cookies.txt
   ```
   Expected: Unauthenticated (session expired)

6. **Restore production TTL** in `server/config/session-store.ts`:
   ```typescript
   ttl: 86400, // 24 hours
   ```

**Success Criteria**: Sessions expire after configured TTL

---

### 4. CSRF Token Integration with Redis Sessions

**Objective**: Verify CSRF tokens work correctly with Redis sessions

**Steps**:

1. Login and capture CSRF token:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}' \
     -c cookies.txt -v | grep X-CSRF-Token
   ```

2. Extract CSRF token from response headers

3. Make state-changing request with CSRF token:
   ```bash
   curl -X POST http://localhost:5000/api/alerts \
     -H "Content-Type: application/json" \
     -H "X-CSRF-Token: <token>" \
     -b cookies.txt \
     -d '{"productId": 1, "targetPrice": 100}'
   ```
   Expected: Success (200 or 201)

4. **Try same request WITHOUT CSRF token**:
   ```bash
   curl -X POST http://localhost:5000/api/alerts \
     -H "Content-Type: application/json" \
     -b cookies.txt \
     -d '{"productId": 1, "targetPrice": 100}'
   ```
   Expected: Forbidden (403) - CSRF protection active

**Success Criteria**: CSRF tokens are properly validated with Redis sessions

---

### 5. Load Testing (100+ Concurrent Sessions)

**Objective**: Verify system handles high concurrent session load

**Prerequisites**: Install `autocannon` or `wrk`

```bash
npm install -g autocannon
```

**Steps**:

1. Start server with Redis:
   ```bash
   npm run dev
   ```

2. Create load test script (`load-test-sessions.js`):
   ```javascript
   import autocannon from 'autocannon';

   const result = await autocannon({
     url: 'http://localhost:5000/api/auth/login',
     connections: 100, // 100 concurrent users
     duration: 30, // 30 seconds
     method: 'POST',
     headers: {
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       email: 'loadtest@example.com',
       password: 'password123'
     })
   });

   console.log(result);
   ```

3. Run load test:
   ```bash
   node load-test-sessions.js
   ```

4. **Monitor Redis during test**:
   ```bash
   redis-cli INFO stats
   redis-cli KEYS "sess:*" | wc -l  # Count session keys
   ```

5. **Check Redis memory usage**:
   ```bash
   redis-cli INFO memory
   ```

**Success Criteria**:
- No errors or timeouts under load
- All sessions created successfully
- Redis memory usage within acceptable limits
- Response times remain consistent

---

## Health Check Verification

**Objective**: Verify `/api/health` endpoint reports Redis session status

**Steps**:

1. **With Redis running**:
   ```bash
   curl http://localhost:5000/api/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2025-11-18T20:00:00.000Z",
     "uptime": 123.456,
     "environment": "development",
     "checks": {
       "database": "ok",
       "redis_cache": "ok",
       "redis_sessions": "ok"
     }
   }
   ```

2. **Stop Redis** and restart server:
   ```bash
   redis-cli shutdown
   npm run dev
   ```

3. **Check health endpoint**:
   ```bash
   curl http://localhost:5000/api/health
   ```
   Expected response (development):
   ```json
   {
     "status": "degraded",
     "checks": {
       "database": "ok",
       "redis_cache": "unavailable",
       "redis_sessions": "unavailable"
     }
   }
   ```

   Expected response (production with `NODE_ENV=production`):
   ```json
   {
     "status": "error",
     "checks": {
       "database": "ok",
       "redis_cache": "unavailable",
       "redis_sessions": "unavailable"
     }
   }
   ```
   HTTP Status: 503 Service Unavailable

**Success Criteria**: Health check accurately reports Redis session status

---

## Troubleshooting

### Sessions not persisting
- Verify Redis is running: `redis-cli ping`
- Check server logs for Redis connection errors
- Verify `REDIS_URL` environment variable is set correctly

### Sessions not shared across instances
- Ensure all instances connect to the same Redis server
- Verify session cookie domain is not instance-specific
- Check Redis for session keys: `redis-cli KEYS "sess:*"`

### Memory issues
- Monitor Redis memory: `redis-cli INFO memory`
- Configure Redis maxmemory policy: `maxmemory-policy allkeys-lru`
- Reduce session TTL if needed

### CSRF token errors
- Ensure CSRF token is included in request headers
- Verify session cookie is sent with requests
- Check that CSRF middleware is after session middleware

---

## Production Checklist

Before deploying to production:

- [ ] Redis is running and accessible
- [ ] `REDIS_URL` environment variable is configured
- [ ] `SESSION_SECRET` is set to a strong random value (32+ characters)
- [ ] Health check endpoint returns `"status": "ok"`
- [ ] Automated tests pass: `npm run test:security`
- [ ] Load testing completed successfully (100+ concurrent sessions)
- [ ] Session TTL is appropriate for your use case (default: 24 hours)
- [ ] CSRF protection is enabled and working
- [ ] Monitoring/alerting configured for Redis availability

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project architecture and patterns
- [CLAUDE.md - Security Patterns](../CLAUDE.md) - Security best practices
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture overview
- [todos/002-completed-p1-fix-redis-session-storage.md](../todos/002-completed-p1-fix-redis-session-storage.md) - Original implementation task

---

## References

- **connect-redis v9**: https://www.npmjs.com/package/connect-redis
- **Redis Session Best Practices**: https://redis.io/docs/manual/patterns/sessions/
- **OWASP Session Management**: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
