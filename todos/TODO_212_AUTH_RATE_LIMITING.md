# TODO 212: Missing Rate Limiting on Critical Auth Endpoints

**Priority**: P1 - HIGH
**File(s)**: `server/auth-routes.ts`, `server/middleware/auth-rate-limiter.ts` (new)
**Estimated Time**: 45 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Password reset and login endpoints lack rate limiting, enabling:

1. **Password reset email flooding** - Spam user's inbox, potential email service abuse
2. **Credential stuffing attacks** - Automated login attempts with leaked credentials
3. **Brute force attacks** - Systematic password guessing
4. **Account enumeration** - Discover valid emails through response timing/content

**Security Impact**: Account compromise, service abuse, user harassment via email spam.

## Root Cause

Rate limiting was applied globally but not with endpoint-specific limits appropriate for sensitive auth operations.

## Solution Approach

1. Create dedicated auth rate limiter middleware with Redis backend
2. Apply stricter limits to password reset (3 requests/15 min)
3. Apply moderate limits to login (10 attempts/15 min)
4. Key by both IP and email to prevent distributed attacks

## Implementation Steps

### Step 1: Create Auth Rate Limiter Middleware

- [ ] Create `server/middleware/auth-rate-limiter.ts`
- [ ] Implement `passwordResetLimiter` (3 req/15 min)
- [ ] Implement `loginLimiter` (10 req/15 min)
- [ ] Use Redis store for distributed rate limiting

### Step 2: Apply to Auth Routes

- [ ] Add `passwordResetLimiter` to `/api/auth/forgot-password`
- [ ] Add `loginLimiter` to `/api/auth/login`
- [ ] Consider rate limiting `/api/auth/register` (prevent mass account creation)

### Step 3: Add Tests

- [ ] Test rate limit triggers after threshold
- [ ] Test rate limit resets after window
- [ ] Test different IPs have separate limits
- [ ] Test combined IP+email keying

## Technical Details

**Current Implementation (NO RATE LIMITING):**
```typescript
app.post('/api/auth/forgot-password', csrfProtection, async (req, res) => {
  // ❌ No rate limiting - can be called unlimited times
  const { email } = req.body;
  await passwordResetService.sendResetEmail(email);
  res.json({ success: true });
});

app.post('/api/auth/login', csrfProtection, passport.authenticate('local'), (req, res) => {
  // ❌ No rate limiting - brute force possible
  res.json({ user: req.user });
});
```

**Rate Limiter Implementation:**
```typescript
// server/middleware/auth-rate-limiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../redis';

// Strict rate limit for password reset
export const passwordResetLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: 'rl:pwd-reset:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per 15 minutes per key
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Key by both IP and email to prevent distributed attacks
  keyGenerator: (req) => {
    const email = req.body?.email?.toLowerCase().trim() || 'unknown';
    return `${req.ip}:${email}`;
  },
});

// Rate limit for login attempts
export const loginLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: 'rl:login:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email?.toLowerCase().trim() || 'unknown';
    return `${req.ip}:${email}`;
  },
});

// Rate limit for registration (prevent mass account creation)
export const registrationLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: 'rl:register:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  message: { error: 'Too many accounts created. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

**Fixed Route Implementation:**
```typescript
// server/auth-routes.ts
import { 
  passwordResetLimiter, 
  loginLimiter, 
  registrationLimiter 
} from './middleware/auth-rate-limiter';

// Password reset with rate limiting
app.post('/api/auth/forgot-password', 
  passwordResetLimiter,  // ✅ Rate limit first
  csrfProtection,
  async (req, res) => {
    const { email } = req.body;
    await passwordResetService.sendResetEmail(email);
    res.json({ success: true });
  }
);

// Login with rate limiting
app.post('/api/auth/login',
  loginLimiter,  // ✅ Rate limit first
  csrfProtection,
  passport.authenticate('local'),
  (req, res) => {
    res.json({ user: req.user });
  }
);

// Registration with rate limiting
app.post('/api/auth/register',
  registrationLimiter,  // ✅ Rate limit first
  csrfProtection,
  async (req, res) => {
    // ... registration logic
  }
);
```

## Checklist

- [ ] Auth rate limiter middleware created
- [ ] Password reset endpoint rate limited (3/15min)
- [ ] Login endpoint rate limited (10/15min)
- [ ] Registration endpoint rate limited (5/hour)
- [ ] Redis store used for distributed limiting
- [ ] Tests verify rate limiting behavior

## Success Criteria

- [ ] 4th password reset request in 15 min returns 429
- [ ] 11th login attempt in 15 min returns 429
- [ ] 6th registration in 1 hour returns 429
- [ ] Rate limits apply per IP+email combination
- [ ] Rate limits reset after window expires
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Blocking legitimate users | Low | Medium | Reasonable limits, clear error messages |
| Redis unavailability | Low | Medium | Fallback to memory store (single server) |
| Distributed attack bypass | Low | Medium | Key by both IP and email |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm rate limiters exist and are applied
  ```bash
  # Verify rate limiter file exists
  ls server/middleware/auth-rate-limiter.ts
  
  # Verify rate limiters are imported in auth routes
  grep -n "Limiter" server/auth-routes.ts
  
  # Verify rate limiters are applied to endpoints
  grep -n "passwordResetLimiter\|loginLimiter\|registrationLimiter" server/auth-routes.ts
  ```

- [ ] **File inspection**: Review rate limiter configuration
  ```bash
  cat server/middleware/auth-rate-limiter.ts
  ```

### Testing
- [ ] **Run affected tests**: Execute auth route tests
  ```bash
  npm test -- auth
  npm test -- rate-limit
  ```

- [ ] **Manual rate limit testing**:
  ```bash
  # Test password reset rate limiting (should fail on 4th request)
  for i in {1..4}; do
    curl -X POST http://localhost:5000/api/auth/forgot-password \
      -H "Content-Type: application/json" \
      -d '{"email":"test@example.com"}'
    echo ""
  done
  # 4th request should return 429 Too Many Requests
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
