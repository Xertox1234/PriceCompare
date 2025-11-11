# Security Enhancements

This document describes the security improvements implemented to address audit findings.

## Overview

Three medium-priority security issues have been resolved:
1. ✅ **Input Validation** - Consistent safe parsing throughout
2. ✅ **CSRF Protection** - Enhanced protection for JSON endpoints
3. ✅ **Distributed Security** - Redis-based rate limiting and account lockout

---

## 1. Enhanced CSRF Protection

### What Changed

Previously, JSON API endpoints skipped CSRF validation, relying only on Same-Origin Policy. This has been strengthened with comprehensive CSRF token validation.

### Implementation

**Location:** `server/middleware/security.ts`

#### Key Features:
- ✅ **Token-based protection** for all state-changing operations (POST/PUT/DELETE/PATCH)
- ✅ **Timing-safe comparison** to prevent timing attacks
- ✅ **Explicit exempt list** for public endpoints
- ✅ **Automatic token distribution** via `X-CSRF-Token` header
- ✅ **Token included in user auth response** for convenience

#### Exempt Endpoints:
```typescript
const CSRF_EXEMPT_PATHS = [
  '/api/affiliate/track-click', // Public click tracking
  '/api/health',                 // Health checks
  '/health',                     // Health checks
  '/discourse/sso',              // External SSO callback
];
```

### Client Usage

#### Getting the CSRF Token

**Option 1: From Response Header** (All endpoints)
```javascript
const response = await fetch('/api/auth/user');
const csrfToken = response.headers.get('X-CSRF-Token');
```

**Option 2: From User Endpoint** (Authenticated users)
```javascript
const response = await fetch('/api/auth/user');
const data = await response.json();
const csrfToken = data.csrfToken;
```

#### Sending the CSRF Token

**Option 1: Custom Header** (Recommended for JSON APIs)
```javascript
await fetch('/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({ name: 'Product' }),
});
```

**Option 2: Request Body** (For form submissions)
```javascript
await fetch('/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    _csrf: csrfToken,
    name: 'Product',
  }),
});
```

### Error Handling

**Missing Token:**
```json
{
  "error": "CSRF token missing",
  "message": "CSRF token is required for this request"
}
```

**Invalid Token:**
```json
{
  "error": "Invalid CSRF token"
}
```

---

## 2. Redis-Based Rate Limiting

### What Changed

Rate limiting moved from in-memory storage to Redis with automatic fallback. This enables distributed rate limiting across multiple server instances.

### Implementation

**Location:** `server/middleware/redis-rate-limiter.ts`

#### Key Features:
- ✅ **Distributed rate limiting** - Works across multiple servers
- ✅ **Sliding window algorithm** - More accurate than fixed windows
- ✅ **Automatic fallback** - Uses in-memory storage if Redis unavailable
- ✅ **Rate limit headers** - Clients can see their limits
- ✅ **Fail-open policy** - Allows requests on error to prevent DoS

#### Pre-configured Rate Limiters:

```typescript
import { RateLimiters } from './middleware/redis-rate-limiter';

// Authentication endpoints: 10 req/15min
app.use('/api/auth', RateLimiters.auth());

// General API: 100 req/15min
app.use('/api', RateLimiters.api());

// Sensitive operations: 5 req/hour
app.use('/api/admin/sensitive', RateLimiters.sensitive());
```

#### Custom Rate Limiter:

```typescript
import { createRateLimiter } from './middleware/redis-rate-limiter';

const customLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 30,
  message: 'Too many requests',
  keyGenerator: (req) => req.user?.id || req.ip, // Custom key
});

app.use('/api/custom', customLimiter);
```

### Response Headers

All rate-limited responses include:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699564800
```

### Error Response

When rate limit exceeded:
```json
{
  "error": "Too many requests from this IP, please try again later",
  "retryAfter": 847
}
```

---

## 3. Redis-Based Account Lockout

### What Changed

Account lockout moved from in-memory to Redis, enabling distributed brute-force protection.

### Implementation

**Location:** `server/middleware/redis-account-lockout.ts`

#### Key Features:
- ✅ **Distributed lockout** - Synced across all servers
- ✅ **5 failed attempts** trigger 15-minute lockout
- ✅ **Automatic fallback** to in-memory storage
- ✅ **Sliding time window** (15 minutes)
- ✅ **Automatic cleanup** of expired entries

#### Usage in Auth Routes:

```typescript
import { accountLockout, checkAccountLockout } from './middleware/redis-account-lockout';

// Apply middleware to check lockout before login
app.use(checkAccountLockout);

// On failed login
const result = await accountLockout.recordFailedLogin(email);
if (result.locked) {
  return res.status(429).json({
    error: 'Account locked',
    lockedUntil: result.lockedUntil,
  });
}

// On successful login
await accountLockout.clearFailedLogins(email);
```

### Error Response

When account is locked:
```json
{
  "error": "Account temporarily locked due to too many failed login attempts",
  "locked": true,
  "remainingTime": 847,
  "message": "Please try again in 15 minutes.",
  "attempts": 5
}
```

---

## Redis Configuration

### Setup

**1. Install Redis**
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

**2. Install ioredis**
```bash
npm install ioredis --save
```

**3. Configure Environment**
```bash
# .env
REDIS_URL=redis://localhost:6379

# Or for Redis Cloud/Upstash
REDIS_URL=rediss://username:password@host:port
```

**4. Initialize Redis**
```typescript
// server/index.ts
import { initializeRedis } from './config/redis';

// Initialize on startup
initializeRedis().then(client => {
  if (client) {
    console.log('✅ Redis-based security features enabled');
  } else {
    console.warn('⚠️  Using in-memory fallback');
  }
});
```

### Fallback Behavior

**If Redis is not available:**
- ✅ Application continues to work
- ⚠️ Falls back to in-memory storage
- ⚠️ Rate limits/lockouts don't sync across servers
- ℹ️ Automatic cleanup prevents memory leaks

### Production Recommendations

For production deployments:

1. **Use Redis Cluster** for high availability
2. **Enable persistence** (AOF or RDB)
3. **Set maxmemory-policy** to `allkeys-lru`
4. **Monitor Redis** with CloudWatch/Datadog
5. **Use Redis Sentinel** for automatic failover

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Security Secrets (Already required)
SESSION_SECRET=<32+ character secret>
CSRF_SECRET=<32+ character secret>
DISCOURSE_SSO_SECRET=<32+ character secret>
```

---

## Migration Guide

### From Old Rate Limiter

**Before:**
```typescript
import { rateLimiter } from './middleware/security';

app.use('/api', rateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Too many requests'
}));
```

**After:**
```typescript
import { RateLimiters } from './middleware/redis-rate-limiter';

app.use('/api', RateLimiters.api());
```

### From Old Account Lockout

**Before:**
```typescript
import {
  isAccountLocked,
  recordFailedLogin,
  clearFailedLogins
} from './middleware/account-lockout';

const status = isAccountLocked(email);
recordFailedLogin(email);
clearFailedLogins(email);
```

**After:**
```typescript
import { accountLockout } from './middleware/redis-account-lockout';

const status = await accountLockout.isLocked(email);
await accountLockout.recordFailedLogin(email);
await accountLockout.clearFailedLogins(email);
```

---

## Testing

### Testing CSRF Protection

```bash
# Should succeed with token
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_TOKEN" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{"name":"Test Product"}'

# Should fail without token (403 Forbidden)
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{"name":"Test Product"}'
```

### Testing Rate Limiting

```bash
# Make multiple requests quickly
for i in {1..15}; do
  curl http://localhost:5000/api/products
  sleep 0.1
done

# Should eventually return 429 Too Many Requests
```

### Testing Account Lockout

```bash
# Attempt login 6 times with wrong password
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done

# Should return 429 Account Locked
```

---

## Performance Impact

### CSRF Protection
- **Overhead:** ~0.1ms per request
- **Memory:** Minimal (tokens stored in session)

### Redis Rate Limiting
- **Overhead:** ~1-2ms per request
- **Fallback:** ~0.1ms (in-memory)
- **Network:** Single Redis command per request

### Account Lockout
- **Overhead:** ~1-2ms per login attempt
- **Fallback:** ~0.1ms (in-memory)
- **Network:** One Redis GET per login

---

## Monitoring

### Redis Health Check

```typescript
import { isRedisConnected } from './config/redis';

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    redis: isRedisConnected() ? 'connected' : 'fallback',
  });
});
```

### Rate Limit Metrics

```typescript
// Check X-RateLimit-* headers in responses
res.on('finish', () => {
  console.log('Rate limit remaining:', res.get('X-RateLimit-Remaining'));
});
```

---

## Security Best Practices

### DO:
- ✅ Always include CSRF token in state-changing requests
- ✅ Use HTTPS in production
- ✅ Monitor Redis connection health
- ✅ Set up alerts for rate limit violations
- ✅ Review exempt endpoints regularly

### DON'T:
- ❌ Expose CSRF tokens in URLs or logs
- ❌ Share sessions across domains
- ❌ Disable CSRF protection without security review
- ❌ Use weak Redis passwords
- ❌ Store sensitive data in Redis without encryption

---

## Troubleshooting

### CSRF Token Issues

**Problem:** "CSRF token missing" errors

**Solution:**
```javascript
// Ensure session is initialized
app.use(session({ /* config */ }));

// Get token before making requests
const response = await fetch('/api/auth/user');
const token = response.headers.get('X-CSRF-Token');
```

### Redis Connection Issues

**Problem:** Redis connection failures

**Solution:**
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check connection string
echo $REDIS_URL

# Check logs for errors
tail -f /var/log/redis/redis-server.log
```

### Rate Limit False Positives

**Problem:** Legitimate users getting rate limited

**Solution:**
```typescript
// Increase limits for specific endpoints
const customLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 200, // Increased from 100
});

// Or use custom key (e.g., by user ID instead of IP)
const userBasedLimiter = createRateLimiter({
  keyGenerator: (req) => req.user?.id || req.ip,
});
```

---

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Redis Rate Limiting](https://redis.io/docs/manual/patterns/rate-limiter/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

## Support

For questions or issues:
1. Check this documentation
2. Review security guidelines: `SECURITY_GUIDELINES.md`
3. Check audit report: `SECURITY_AUDIT_REPORT.md`
4. Contact security team
