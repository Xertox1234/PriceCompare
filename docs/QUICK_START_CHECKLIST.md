# ✅ Quick Start Checklist - Immediate Actions

**Purpose:** Get started on Priority 1 audit remediation items
**Timeline:** This week (5-7 days)
**Effort:** 16-24 hours total

---

## 📋 Pre-Flight Checks

Before starting, ensure you have:

- [ ] Git repository access with branch permissions
- [ ] Access to production environment variables
- [ ] Redis instance available (local or cloud)
- [ ] Node.js 20+ installed
- [ ] npm dependencies installed (`npm install`)
- [ ] Database connection working

---

## 🔴 PRIORITY 1: Critical Items (Do First)

### ✅ Task 1: Fix esbuild Vulnerability (1-2 hours)

**Why:** Moderate security vulnerability (CVSS 5.3)
**Owner:** Any developer

```bash
# Step 1: Check current vulnerabilities
npm audit

# Step 2: Update affected packages
npm update esbuild@latest
npm update vite@latest
npm update drizzle-kit@latest

# Step 3: Verify the fix
npm audit --audit-level=moderate
# Expected: No moderate or higher vulnerabilities

# Step 4: Test build
npm run build
# Expected: Build succeeds

# Step 5: Test dev server
npm run dev
# Expected: Server starts without errors

# Step 6: Commit changes
git add package.json package-lock.json
git commit -m "fix: Update esbuild and related packages to fix security vulnerability"
git push origin claude/code-audit-review-01CoUsBoecLA2W3LyvfQHVZr
```

**Acceptance:**
- [ ] `npm audit` shows 0 moderate+ vulnerabilities
- [ ] Build completes successfully
- [ ] Dev server runs normally
- [ ] All pages load correctly

---

### ✅ Task 2: Migrate to Redis Rate Limiting (3-5 hours)

**Why:** Current in-memory solution doesn't scale horizontally
**Owner:** Backend developer

#### Step 1: Verify Redis is available

```bash
# If using local Redis (Docker)
docker run -d --name redis-pricecompare -p 6379:6379 redis:7-alpine

# OR use cloud Redis (Upstash, Redis Cloud, etc.)
# Get connection URL from provider

# Test connection
redis-cli ping
# Expected: PONG

# OR test with env var
REDIS_URL=redis://localhost:6379 node -e "const {Redis} = require('ioredis'); new Redis(process.env.REDIS_URL).ping().then(console.log)"
```

#### Step 2: Check if redis-rate-limiter exists

```bash
# Check if file exists
ls -la server/middleware/redis-rate-limiter.ts

# If it doesn't exist, create it from this template:
```

Create `server/middleware/redis-rate-limiter.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';

let redisClient: Redis | null = null;

export function setRedisClient(client: Redis | null) {
  redisClient = client;
}

interface RedisRateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  message?: string;
}

export function redisRateLimiter(options: RedisRateLimiterOptions) {
  const { windowMs, maxRequests, keyPrefix = 'ratelimit', message = 'Too many requests' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisClient) {
      console.warn('Redis client not available, skipping rate limiting');
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;

    try {
      // Increment counter
      const current = await redisClient.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await redisClient.pexpire(key, windowMs);
      }

      // Get TTL for remaining time calculation
      const ttl = await redisClient.pttl(key);

      // Check if limit exceeded
      if (current > maxRequests) {
        res.status(429).json({
          error: message,
          retryAfter: Math.ceil(ttl / 1000),
        });
        return;
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + ttl);

      next();
    } catch (error) {
      console.error('Redis rate limiter error:', error);
      // Fail open - allow request if Redis fails
      next();
    }
  };
}
```

#### Step 3: Update server/index.ts

```typescript
// Find these lines (around line 19-20)
import { apiCacheMiddleware } from "./middleware/cache";
import { securityHeaders, rateLimiter, sanitizeInput, corsMiddleware, attachCsrfToken, csrfProtection } from "./middleware/security";

// Add this import
import { redisRateLimiter, setRedisClient } from "./middleware/redis-rate-limiter";

// Find where Redis is initialized (around line 76)
const redisClient = await initializeRedis();

// Add this line right after Redis initialization
setRedisClient(redisClient);

// Find the rate limiting setup (around line 56-68)
// REPLACE THIS:
app.use('/api', rateLimiter({
  windowMs: RATE_LIMIT.WINDOW_MS,
  maxRequests: RATE_LIMIT.MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later'
}));

app.use('/api/auth', rateLimiter({
  windowMs: RATE_LIMIT.WINDOW_MS,
  maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
  message: 'Too many authentication attempts, please try again later'
}));

// WITH THIS:
const rateLimiterMiddleware = redisClient ? redisRateLimiter : rateLimiter;

app.use('/api', rateLimiterMiddleware({
  windowMs: RATE_LIMIT.WINDOW_MS,
  maxRequests: RATE_LIMIT.MAX_REQUESTS,
  keyPrefix: 'ratelimit:api',
  message: 'Too many requests from this IP, please try again later'
}));

app.use('/api/auth', rateLimiterMiddleware({
  windowMs: RATE_LIMIT.WINDOW_MS,
  maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
  keyPrefix: 'ratelimit:auth',
  message: 'Too many authentication attempts, please try again later'
}));
```

#### Step 4: Update environment validation

Edit `server/config/env-validation.ts`:

```typescript
// Add to OPTIONAL_ENV_VARS if not already there
{
  name: 'REDIS_URL',
  description: 'Redis connection URL (recommended for production)',
  critical: false,
},

// Or make it REQUIRED in production by adding to REQUIRED_ENV_VARS with:
{
  name: 'REDIS_URL',
  description: 'Redis connection URL',
  critical: process.env.NODE_ENV === 'production',
},
```

#### Step 5: Test

```bash
# Start server
npm run dev

# In another terminal, test rate limiting
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/products
done

# Expected: First 100 return 200, 101st returns 429

# Check Redis keys
redis-cli KEYS "ratelimit:*"
# Expected: Should see keys like ratelimit:api:127.0.0.1
```

#### Step 6: Commit

```bash
git add server/middleware/redis-rate-limiter.ts
git add server/index.ts
git add server/config/env-validation.ts
git commit -m "feat: Migrate to Redis-based rate limiting for horizontal scalability"
git push origin claude/code-audit-review-01CoUsBoecLA2W3LyvfQHVZr
```

**Acceptance:**
- [ ] Redis connection established
- [ ] Rate limiting uses Redis when available
- [ ] Fallback to in-memory in development
- [ ] Rate limits persist across server restarts
- [ ] Multiple server instances share limits

---

### ✅ Task 3: Fix Test Environment (2-3 hours)

**Why:** Tests can't run, blocking CI/CD
**Owner:** Any developer

#### Step 1: Check current dependencies

```bash
# Check if vite and vitest are installed
npm list vite vitest

# Expected output should show versions
# If "UNMET DEPENDENCY" or "missing", continue to step 2
```

#### Step 2: Install missing dependencies

```bash
# Install latest versions
npm install --save-dev vite@latest vitest@latest @vitest/coverage-v8@latest

# Verify installation
npm list vite vitest
```

#### Step 3: Verify vitest.config.ts

```bash
# Check if config exists
cat vitest.config.ts
```

If file doesn't exist or has issues, create/update it:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './server/__tests__/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'server/__tests__/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'download_package/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
```

#### Step 4: Create test setup file if needed

```bash
# Check if setup file exists
ls -la server/__tests__/setup.ts
```

If it doesn't exist:

```typescript
// server/__tests__/setup.ts
import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Global test setup
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Global cleanup
});
```

#### Step 5: Run tests

```bash
# Run all tests
npm test

# Expected: Tests execute (may have failures, but no config errors)

# Run with coverage
npm run test:coverage

# Expected: Coverage report generates
```

#### Step 6: Fix any failing tests

```bash
# Run specific test to debug
npm test -- server/__tests__/security/validation.test.ts

# Fix issues one by one
# Common issues:
# - Missing environment variables (set in test setup)
# - Database connection (use test DB or mock)
# - Import path issues (check tsconfig aliases)
```

#### Step 7: Commit

```bash
git add vitest.config.ts
git add server/__tests__/setup.ts
git add package.json package-lock.json
git commit -m "fix: Configure test environment for vitest"
git push origin claude/code-audit-review-01CoUsBoecLA2W3LyvfQHVZr
```

**Acceptance:**
- [ ] `npm test` runs without config errors
- [ ] Coverage report generates
- [ ] Can run individual test files
- [ ] All existing tests pass (or failures documented)

---

### ✅ Task 4: Verify No Secrets in Git (30 minutes)

**Why:** Prevent secret leaks
**Owner:** Any developer

#### Step 1: Update .gitignore

```bash
# Verify .gitignore has these entries
cat .gitignore | grep -E "\.env|\.pem|\.key"

# If missing, add them
cat >> .gitignore << EOF
# Environment files
.env
.env.local
.env.*.local

# Security
*.pem
*.key
*.p12

# IDE
.vscode/
.idea/

# Logs
*.log
npm-debug.log*
EOF
```

#### Step 2: Check for committed secrets

```bash
# Quick check for .env files in git
git log --all --full-history --source -- .env

# Should return empty

# Check for potential secrets in current files
grep -r "api_key\|password\|secret" .env.example
# Should only show placeholder values
```

#### Step 3: Scan for leaked secrets (optional but recommended)

```bash
# Install gitleaks (if not installed)
# https://github.com/gitleaks/gitleaks

# Scan repository
gitleaks detect --source . --verbose

# Expected: No leaks found

# OR use git-secrets
git secrets --scan
```

#### Step 4: Verify .env.example is safe

```bash
# Check that example doesn't have real secrets
cat .env.example | grep -v "^#" | grep -v "^$"

# Verify all values are placeholders:
# - "CHANGE_THIS_TO_A_SECURE_RANDOM_VALUE"
# - "your_api_key"
# - "your_password"
# etc.
```

#### Step 5: Document for team

Create a reminder file:

```markdown
<!-- docs/SECURITY_REMINDER.md -->
# Security Reminder

## Never commit secrets!

- Use `.env` for local secrets (gitignored)
- Use `.env.local` for local overrides (gitignored)
- Update `.env.example` with placeholder values only
- Rotate any secret that was accidentally committed

## Before committing:
```bash
# Check what you're committing
git diff --cached

# Look for suspicious patterns
git diff --cached | grep -i "api_key\|password\|secret"
```

## If you accidentally commit a secret:

1. **Rotate the secret immediately**
2. Update environment variables
3. DO NOT just delete the commit (still in git history)
4. Contact DevOps team for help removing from history
```

#### Step 6: Commit

```bash
git add .gitignore
git add docs/SECURITY_REMINDER.md
git commit -m "chore: Update .gitignore and add security reminder"
git push origin claude/code-audit-review-01CoUsBoecLA2W3LyvfQHVZr
```

**Acceptance:**
- [ ] .gitignore covers all secret patterns
- [ ] No .env files in git history
- [ ] .env.example has only placeholders
- [ ] Team is aware of secret handling

---

## 📝 Daily Checklist

Use this for daily standup:

### Monday
- [ ] Review Priority 1 tasks
- [ ] Assign Task 1 (esbuild) to developer
- [ ] Assign Task 2 (Redis) to developer
- [ ] Set up local Redis for testing

### Tuesday
- [ ] Complete Task 1 (esbuild fix)
- [ ] Begin Task 2 (Redis migration)
- [ ] Test Redis connection

### Wednesday
- [ ] Complete Task 2 (Redis migration)
- [ ] Begin Task 3 (test environment)
- [ ] Mid-week progress update

### Thursday
- [ ] Complete Task 3 (test setup)
- [ ] Run full test suite
- [ ] Complete Task 4 (git security)

### Friday
- [ ] Final testing of all changes
- [ ] Code review
- [ ] Merge to main (if approved)
- [ ] Deploy to staging
- [ ] Week retrospective

---

## 🧪 Testing Checklist

Before marking tasks complete:

### Task 1: esbuild Fix
- [ ] `npm audit` shows 0 moderate+ vulnerabilities
- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts server
- [ ] Application loads in browser
- [ ] No console errors

### Task 2: Redis Migration
- [ ] Redis connection established
- [ ] Rate limiting works (test with 101 requests)
- [ ] Redis keys visible with `redis-cli KEYS "ratelimit:*"`
- [ ] Graceful fallback if Redis unavailable
- [ ] Server restart preserves rate limits

### Task 3: Test Fix
- [ ] `npm test` runs without errors
- [ ] `npm run test:coverage` generates report
- [ ] Individual tests can be run
- [ ] Coverage data is accurate

### Task 4: Git Security
- [ ] `.gitignore` prevents .env commits
- [ ] No secrets in git history
- [ ] `.env.example` is safe
- [ ] Team briefed on practices

---

## 🚨 Troubleshooting

### "npm audit" still shows vulnerabilities
```bash
# Try automated fix
npm audit fix

# If that doesn't work, check for peer dependency issues
npm audit fix --force

# Last resort: manually update problem packages
npm update [package-name]@latest
```

### Redis connection fails
```bash
# Check if Redis is running
redis-cli ping

# If not, start Redis
docker start redis-pricecompare

# Or start new container
docker run -d --name redis-pricecompare -p 6379:6379 redis:7-alpine

# Verify connection string
echo $REDIS_URL
# Should be: redis://localhost:6379
```

### Tests fail with import errors
```bash
# Check tsconfig paths
cat tsconfig.json | grep -A5 "paths"

# Ensure vitest.config.ts has matching aliases
cat vitest.config.ts | grep -A5 "alias"

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Rate limiting not working
```bash
# Check Redis keys
redis-cli KEYS "*"

# Monitor Redis commands
redis-cli MONITOR

# Check server logs for errors
tail -f logs/*.log

# Verify redisClient is set
# Add logging in server/index.ts:
console.log('Redis client:', redisClient ? 'connected' : 'not connected');
```

---

## 📞 Need Help?

| Issue | Contact | How |
|-------|---------|-----|
| Redis setup | DevOps team | Slack #devops |
| Test failures | QA team | Slack #qa |
| Git/merge issues | Tech lead | Email/Slack |
| Security questions | Security team | security@company.com |

---

## ✅ Completion Criteria

You're done with Priority 1 when:

- [ ] All 4 tasks completed
- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Merged to main branch
- [ ] Deployed to staging
- [ ] Production deployment scheduled

**Next:** Move to Priority 2 tasks in the [Implementation Plan](./IMPLEMENTATION_PLAN.md)

---

**Last Updated:** 2025-11-15
**Version:** 1.0
