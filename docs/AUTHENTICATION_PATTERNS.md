---
Pattern: Authentication Patterns & Best Practices
Version: 1.0
Last Updated: 2025-11-26
Maintainer: Claude Code / Development Team
Status: Active
Related Patterns: [SECURITY_PATTERNS.md, API_PATTERNS.md, ERROR_HANDLING_PATTERNS.md]
---

# Authentication Patterns & Best Practices

This document codifies the authentication patterns and solutions established for the PriceCompare application.

## Table of Contents
- [Rate Limiting](#rate-limiting)
- [CSRF Protection](#csrf-protection)
- [Session Management](#session-management)
- [Development vs Production](#development-vs-production)

## Rate Limiting

### Problem Identified
Initial rate limiting configuration was too restrictive for development, causing legitimate requests to be blocked:
- **Issue**: 5 requests per 15 minutes for all `/api/auth/*` endpoints
- **Root Cause**: Rate limiter counts ALL auth requests, including `/api/auth/user` (authentication check)
- **Impact**: Frontend calls `/api/auth/user` on every page load, quickly exhausting the limit during development

### Solution
Environment-aware rate limiting with different limits for development and production:

**Location**: `server/utils/constants.ts`
```typescript
export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000,  // 15 minutes
  MAX_REQUESTS: 100,           // per window
  AUTH_MAX_REQUESTS: process.env.NODE_ENV === 'production' ? 5 : 50,  // environment-aware
  SKIP_SUCCESSFUL_REQUESTS: false,
} as const;
```

**Rationale**:
- **Development**: 50 requests per 15 minutes allows for frequent testing and page reloads
- **Production**: 5 requests per 15 minutes provides strong protection against brute force attacks
- **Flexibility**: Easy to adjust per environment without code changes

### Rate Limiting Best Practices

1. **Exclude Health Checks**: Don't count health check endpoints (`/health`, `/api/health`)
2. **Separate Limits**: Different rate limits for different endpoint types:
   - Authentication endpoints: Stricter (5-50 per 15 min)
   - General API: More lenient (100 per 15 min)
   - Sensitive operations: Very strict (5 per hour)

3. **Clear Rate Limit Data**:
   ```bash
   # Development: Clear rate limits in Redis
   redis-cli DEL "ratelimit:127.0.0.1"
   ```

4. **Monitor Rate Limits**: Server logs rate limit violations with context:
   ```typescript
   logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, req, {
     metadata: {
       limit: info.total,
       remaining: info.remaining,
       resetTime: new Date(info.reset).toISOString(),
     }
   });
   ```

## CSRF Protection

### Problem Identified
Frontend was missing CSRF token handling, causing all state-changing requests to be rejected with 403 errors.

### Solution
Implemented automatic CSRF token management in the API client:

**Location**: `client/src/lib/queryClient.ts`

```typescript
// Store CSRF token in memory
let csrfToken: string | null = null;

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add CSRF token for non-GET requests
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    credentials: "include",
    ...options,
  });

  // Extract CSRF token from response headers
  const newCsrfToken = res.headers.get('X-CSRF-Token');
  if (newCsrfToken) {
    csrfToken = newCsrfToken;
  }

  return await res.json();
}
```

### CSRF Flow

1. **Server generates token**: On any request with a session
   ```typescript
   // server/middleware/security.ts
   export function attachCsrfToken(req: Request, res: Response, next: NextFunction) {
     if (req.session) {
       const token = generateCsrfToken(req);
       res.setHeader('X-CSRF-Token', token);  // Token sent to client
     }
     next();
   }
   ```

2. **Client receives token**: Extracts from response header and stores
3. **Client sends token**: Includes in subsequent state-changing requests (POST, PUT, DELETE)
4. **Server validates token**: Compares request token with session token using timing-safe comparison

### CSRF Best Practices

1. **Exempt Safe Methods**: Don't require CSRF tokens for GET, HEAD, OPTIONS
2. **Exempt Public Endpoints**: Whitelist public endpoints that don't need protection:
   ```typescript
   const CSRF_EXEMPT_PATHS = [
     '/api/affiliate/track-click',
     '/api/health',
     '/discourse/sso',
   ];
   ```

3. **Timing-Safe Comparison**: Always use `crypto.timingSafeEqual()` to prevent timing attacks
4. **Session-Based Storage**: Store CSRF tokens in session, not cookies
5. **Automatic Token Refresh**: Client automatically updates token from response headers

## Session Management

### Configuration
**Location**: `server/index.ts`

```typescript
app.use(session({
  store: sessionStore,  // Redis or in-memory fallback
  secret: getRequiredEnv('SESSION_SECRET'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    httpOnly: true,  // Prevent XSS
    sameSite: 'lax',  // CSRF protection
    maxAge: SESSION.MAX_AGE,  // 24 hours
  },
}));
```

### Session Best Practices

1. **Redis in Production**: Use Redis session store for multi-instance deployments
2. **Secure Cookies**: Always set `secure: true` in production
3. **HttpOnly Flag**: Prevent JavaScript access to session cookies
4. **SameSite Protection**: Use `lax` or `strict` for CSRF protection
5. **Session Expiry**: Set reasonable max age (24 hours for user sessions)

## Development vs Production

### Key Differences

| Feature | Development | Production |
|---------|------------|------------|
| Rate Limits | 50 requests/15min | 5 requests/15min |
| HTTPS Required | No | Yes |
| Secure Cookies | No | Yes |
| Redis Required | No (fallback to in-memory) | Yes (enforced) |
| Error Details | Verbose | Minimal |
| Source Maps | Enabled | Disabled |

### Environment Setup

**Required Environment Variables**:
```bash
# Authentication
SESSION_SECRET=<64-character-random-string>
CSRF_SECRET=<64-character-random-string>

# Database
DATABASE_URL=postgresql://user:pass@localhost/pricecompare

# Redis (optional in dev, required in production)
REDIS_URL=redis://localhost:6379
```

### Development Workflow

1. **Start Redis** (optional but recommended):
   ```bash
   redis-server
   ```

2. **Clear development data** if needed:
   ```bash
   # Clear rate limits
   redis-cli DEL "ratelimit:127.0.0.1"

   # Clear sessions
   redis-cli KEYS "sess:*" | xargs redis-cli DEL
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

## Troubleshooting

### Rate Limit Issues
**Symptoms**: "Too many requests" (429) errors
**Solutions**:
1. Clear Redis rate limit: `redis-cli DEL "ratelimit:127.0.0.1"`
2. Check rate limit constants in `server/utils/constants.ts`
3. Verify `NODE_ENV` is set correctly

### CSRF Token Issues
**Symptoms**: "CSRF token missing" (403) errors
**Solutions**:
1. Verify client is including token in headers
2. Check session is active (cookies are being sent)
3. Clear browser cookies and restart session
4. Check `apiRequest` function is being used for all API calls

### Session Issues
**Symptoms**: User logged out unexpectedly
**Solutions**:
1. Check Redis is running (production)
2. Verify `SESSION_SECRET` is set and consistent
3. Check cookie settings (secure flag, sameSite)
4. Verify session max age hasn't expired

## Security Checklist

- [ ] Rate limiting enabled on all auth endpoints
- [ ] CSRF protection active for state-changing requests
- [ ] Sessions use Redis in production
- [ ] Secure cookies enabled in production (HTTPS)
- [ ] Session secrets are cryptographically random
- [ ] Failed login attempts are logged
- [ ] Account lockout after failed attempts
- [ ] Password requirements enforced (min 8 chars, complexity)
- [ ] Security events logged to monitoring system

## Related Documentation

- [Security Middleware](../server/middleware/security.ts)
- [Rate Limiting](../server/middleware/redis-rate-limiter.ts)
- [Auth Routes](../server/routes/auth-routes.ts)
- [API Client](../client/src/lib/queryClient.ts)
