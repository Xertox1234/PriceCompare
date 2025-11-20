---
status: pending
priority: p3
issue_id: "017"
tags: [api, rate-limiting, monetization, performance]
dependencies: []
estimated_effort: 8-12 hours
---

# Implement API Rate Limit Tiers

## Problem Statement

**MONETIZATION & UX IMPROVEMENT**: Current rate limiting applies the same limits to all users (100 requests per 15 minutes). This creates two issues:

1. **Anonymous users** get same limits as authenticated users (no incentive to register)
2. **No premium tier** for power users or paid subscribers
3. **Admins** hit rate limits during legitimate operations

**Impact:** Medium - Limits monetization potential, poor UX for power users

## Current State

✅ **Redis-based rate limiting implemented** (`server/middleware/redis-rate-limiter.ts`)
- Distributed across multiple servers
- Sliding window algorithm
- Per-IP tracking

❌ **Single tier for everyone**:
```typescript
// server/index.ts
app.use('/api', redisRateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  maxRequests: 100,           // Same for everyone
  keyPrefix: 'ratelimit:api',
}));
```

## Implementation Plan

### Step 1: Define Rate Limit Tiers

**File**: `server/utils/constants.ts`

```typescript
export const RATE_LIMIT_TIERS = {
  anonymous: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 50,        // Lowest tier
    description: 'Anonymous/Guest users'
  },
  user: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 200,       // 4x anonymous
    description: 'Authenticated free users'
  },
  premium: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 1000,      // 20x anonymous
    description: 'Premium/Paid subscribers'
  },
  admin: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10000,     // Effectively unlimited
    description: 'Admin users'
  },
};
```

### Step 2: Create Tiered Rate Limiter Middleware

**File**: `server/middleware/tiered-rate-limiter.ts`

```typescript
import { redisRateLimiter } from './redis-rate-limiter';
import { RATE_LIMIT_TIERS } from '../utils/constants';

export function tieredRateLimiter(options?: { keyPrefix?: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    // Determine tier based on user
    let tier: keyof typeof RATE_LIMIT_TIERS = 'anonymous';

    if (user) {
      if (user.role === 'admin') {
        tier = 'admin';
      } else if (user.subscription === 'premium') {
        tier = 'premium';
      } else {
        tier = 'user';
      }
    }

    const limits = RATE_LIMIT_TIERS[tier];

    // Apply tier-specific rate limit
    return redisRateLimiter({
      ...limits,
      keyPrefix: options?.keyPrefix || 'ratelimit',
      tierName: tier, // For logging
    })(req, res, next);
  };
}
```

### Step 3: Update Rate Limiter to Add Headers

**File**: `server/middleware/redis-rate-limiter.ts`

Add response headers to inform clients:

```typescript
export function redisRateLimiter(options) {
  return async (req, res, next) => {
    // ... existing logic ...

    // Add informational headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);
    res.setHeader('X-RateLimit-Tier', tierName || 'default');

    if (remaining <= 0) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000),
        tier: tierName,
        limit: maxRequests,
      });
    }

    next();
  };
}
```

### Step 4: Apply Tiered Limits to Routes

**File**: `server/index.ts`

```typescript
import { tieredRateLimiter } from './middleware/tiered-rate-limiter';

// General API rate limiting (tiered)
app.use('/api', tieredRateLimiter({ keyPrefix: 'api' }));

// More strict for expensive AI endpoints
app.use('/api/search', tieredRateLimiter({
  keyPrefix: 'search',
  // Could override tiers here for specific routes
}));

// Stricter for auth endpoints (prevent brute force)
app.use('/api/auth', redisRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,  // Same for everyone to prevent attacks
  keyPrefix: 'auth',
}));
```

### Step 5: Client-Side Rate Limit Display

**File**: `client/src/hooks/useRateLimit.ts`

```typescript
export function useRateLimit() {
  const [rateLimit, setRateLimit] = useState({
    limit: 0,
    remaining: 0,
    reset: 0,
    tier: 'anonymous',
  });

  // Extract from response headers
  useEffect(() => {
    const interceptor = axios.interceptors.response.use((response) => {
      setRateLimit({
        limit: parseInt(response.headers['x-ratelimit-limit'] || '0'),
        remaining: parseInt(response.headers['x-ratelimit-remaining'] || '0'),
        reset: parseInt(response.headers['x-ratelimit-reset'] || '0'),
        tier: response.headers['x-ratelimit-tier'] || 'anonymous',
      });
      return response;
    });

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  return rateLimit;
}
```

**Usage in UI**:

```typescript
function RateLimitBanner() {
  const { remaining, limit, tier } = useRateLimit();
  const percentage = (remaining / limit) * 100;

  if (percentage > 50) return null; // Don't show until <50% remaining

  return (
    <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400">
      <p className="text-sm text-yellow-700">
        Rate limit: {remaining}/{limit} requests remaining ({tier} tier)
        {tier === 'anonymous' && (
          <a href="/register" className="ml-2 underline">
            Sign up for 4x more requests
          </a>
        )}
      </p>
    </div>
  );
}
```

## Success Criteria

- [ ] Different rate limits for each user tier (anonymous/user/premium/admin)
- [ ] Rate limit info exposed in response headers
- [ ] Client can display remaining requests
- [ ] Premium tier has significantly higher limits
- [ ] Admins have effectively unlimited requests
- [ ] Auth endpoints remain strictly rate limited (same for all)

## Expected Behavior

| User Type | Tier | Requests/15min | Use Case |
|-----------|------|----------------|----------|
| **Anonymous** | `anonymous` | 50 | Casual browsing |
| **Free User** | `user` | 200 | Regular usage |
| **Premium** | `premium` | 1000 | Power users, integrations |
| **Admin** | `admin` | 10,000 | Operations, debugging |

## Timeline

**Estimated effort**: 8-12 hours

- Step 1: Define tiers (1 hour)
- Step 2: Tiered middleware (3-4 hours)
- Step 3: Add headers (2-3 hours)
- Step 4: Apply to routes (1-2 hours)
- Step 5: Client-side display (2-3 hours)

## Monetization Potential

**Premium tier** could be offered as:
- **$5/month** - 1000 requests/15min
- **$20/month** - 5000 requests/15min + API key
- **$50/month** - 20000 requests/15min + priority support

**Anonymous → User conversion**:
- Show "Sign up for 4x more requests" when rate limit hit
- Track conversion rate (estimate: 5-10% conversion)

## Notes

- **Low priority** - Current single-tier works fine for launch
- **Nice-to-have** for monetization strategy
- Already have all infrastructure (Redis rate limiter works perfectly)
- From original implementation plan (Task 3.4)
