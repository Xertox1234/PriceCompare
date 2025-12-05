# TODO 011: Review Error Monitoring & Observability Setup

**Priority**: P4 (Future Enhancement)
**File(s)**: `server/utils/logger.ts`, `server/config/sentry.ts`, error monitoring dashboards
**Estimated Time**: 2-4 hours
**Status**: Ready

## Problem Statement

With the standardized error response format now in place across all middleware, we have an opportunity to improve error monitoring and observability. The current setup logs errors, but we're not systematically tracking:

1. Error frequency patterns (which middleware errors occur most?)
2. Unique IP patterns for rate limiting/lockouts
3. Affected user accounts (who's hitting errors?)
4. Error correlation (do certain errors cluster together?)
5. Performance impact (are errors causing slowdowns?)

## Root Cause

This is not a bug or deficiency - it's an enhancement opportunity identified during code review of issue #162. The standardized error format now makes structured monitoring much easier to implement.

## Solution Approach

Review and potentially enhance the error monitoring setup to take advantage of the newly standardized error response format. This involves:

1. Structured logging for middleware errors
2. Sentry context enrichment
3. Dashboard/alerting setup
4. Pattern analysis capabilities

## Implementation Steps

### Phase 1: Assessment

- [ ] Review current Sentry configuration (`server/config/sentry.ts`)
- [ ] Review logger setup (`server/utils/logger.ts`)
- [ ] Check what error metadata is currently captured
- [ ] Identify gaps in observability

### Phase 2: Structured Logging Enhancement

- [ ] Add structured logging for rate limit events
  ```typescript
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    limit: info.total,
    tier: tier,
    resetTime: new Date(info.reset)
  });
  ```

- [ ] Add structured logging for account lockouts
  ```typescript
  logger.warn('Account locked', {
    email: email,
    attempts: lockStatus.attempts,
    lockedUntil: new Date(lockStatus.lockedUntil),
    ip: req.ip
  });
  ```

- [ ] Add structured logging for CSRF violations
  ```typescript
  logger.warn('CSRF violation', {
    ip: req.ip,
    path: req.path,
    hasToken: !!token,
    hasSessionToken: !!sessionToken
  });
  ```

### Phase 3: Sentry Context Enrichment

- [ ] Add custom Sentry tags for error types
  ```typescript
  Sentry.setTag('error_code', 'RATE_LIMIT_EXCEEDED');
  Sentry.setTag('middleware', 'redis-rate-limiter');
  ```

- [ ] Add user context for authenticated errors
  ```typescript
  if (req.user) {
    Sentry.setUser({
      id: req.user.id,
      email: req.user.email,
      username: req.user.username
    });
  }
  ```

- [ ] Add request context (IP, path, tier)

### Phase 4: Pattern Analysis

- [ ] Review error logs for common patterns
- [ ] Identify top error sources (which middleware? which endpoints?)
- [ ] Track error frequency over time
- [ ] Correlate errors with deployment events

### Phase 5: Alerting Setup (Optional)

- [ ] Configure Sentry alerts for error spikes
- [ ] Set up dashboard for key metrics:
  - Rate limit hits per hour
  - Account lockouts per day
  - CSRF violations per hour
  - Top affected users/IPs
- [ ] Document alerting thresholds

## Technical Details

**Current State Assessment Questions**:

1. **Sentry Integration**:
   - Is Sentry properly capturing middleware errors?
   - Are error contexts being set correctly?
   - Are custom tags being used effectively?

2. **Logging**:
   - Is the logger capturing sufficient detail?
   - Are logs structured for easy parsing?
   - Can we query logs by error type?

3. **Metrics**:
   - Do we track error rates over time?
   - Can we identify error patterns?
   - Are we monitoring error impact on performance?

**Proposed Enhancements**:

```typescript
// Example: Enhanced rate limiter logging
export function createRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // ... existing code ...

    if (!allowed) {
      // ENHANCED: Structured logging before error response
      logger.warn('Rate limit exceeded', {
        errorCode: 'RATE_LIMIT_EXCEEDED',
        middleware: 'redis-rate-limiter',
        ip: req.ip,
        path: req.path,
        method: req.method,
        tier: tier,
        limit: info.total,
        remaining: info.remaining,
        resetTime: new Date(info.reset).toISOString(),
        userId: (req.user as { id?: number })?.id,
      });

      // ENHANCED: Sentry context
      Sentry.setContext('rateLimit', {
        tier,
        limit: info.total,
        remaining: info.remaining,
        resetTime: new Date(info.reset).toISOString(),
      });

      // Existing error response
      sendError(res, message, 429, {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((info.reset - Date.now()) / 1000)
      });
      return;
    }
    // ... rest of code ...
  };
}
```

## Monitoring Objectives

**Key Metrics to Track**:

1. **Error Frequency**:
   - Rate limit hits per hour/day
   - Account lockouts per hour/day
   - CSRF violations per hour/day
   - Request size limit violations per day

2. **User Impact**:
   - Unique IPs affected by rate limits
   - User accounts locked out
   - Patterns in affected users (bots vs legitimate?)

3. **System Health**:
   - Error rate trends over time
   - Correlation with deployments
   - Performance impact of middleware errors

4. **Security Insights**:
   - CSRF attack patterns
   - Potential DDoS attempts (rate limit spikes)
   - Brute force patterns (account lockouts)

## Checklist

- [ ] Current monitoring setup documented
- [ ] Gaps identified and prioritized
- [ ] Structured logging added to key middleware
- [ ] Sentry context enrichment implemented
- [ ] Dashboard or visualization created (if applicable)
- [ ] Alerting configured (if needed)
- [ ] Documentation updated

## Success Criteria

- [ ] Can answer: "Which middleware errors are most common?"
- [ ] Can answer: "Are rate limits effective or too strict?"
- [ ] Can answer: "Is account lockout preventing brute force?"
- [ ] Can identify error patterns within 5 minutes
- [ ] Can track error trends over time
- [ ] Alerts fire for anomalous error rates (if configured)

## Benefits

1. **Visibility**: Clear understanding of error patterns and frequency
2. **Tuning**: Data-driven decisions for rate limit/lockout thresholds
3. **Security**: Early detection of attacks (brute force, DDoS, CSRF)
4. **UX**: Identify legitimate users affected by overly strict limits
5. **Debugging**: Faster root cause analysis for production issues
6. **Compliance**: Better audit trail for security events

## Out of Scope

- [ ] Custom metrics infrastructure (use existing Sentry/logging)
- [ ] Real-time dashboards (unless quick win with existing tools)
- [ ] Machine learning for anomaly detection (future enhancement)
- [ ] Integration with external monitoring tools (unless already in use)

## Resources

- Sentry documentation: https://docs.sentry.io/
- Structured logging best practices
- Error monitoring patterns for Express.js
- Current logger configuration: `server/utils/logger.ts`
- Current Sentry config: `server/config/sentry.ts`

---

**Source**: Code review enhancement suggestion from issue #162
**Category**: Observability / Operations / Security
**Related**: Error response standardization, security monitoring
**Estimated Impact**: Better operational visibility, faster incident response
**Timeline**: Non-urgent - can be done when monitoring needs arise
