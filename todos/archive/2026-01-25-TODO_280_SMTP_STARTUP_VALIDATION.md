# TODO 280: Add SMTP Connection Validation at Startup

**Priority**: P2 (IMPORTANT)
**Estimated Time**: 1 hour
**Status**: Completed
**Completed**: 2026-01-25
**Source**: Production Readiness Audit 2026-01-25

## Problem Statement

The email service silently fails if SMTP is misconfigured. Users discover this only when trying to reset their password - a critical user flow that appears working until the moment of need.

### Current Behavior

```typescript
// server/services/email-service.ts
if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
  logger.info('Email service not configured...');  // INFO level, not ERROR
  this.isConfigured = false;
  return;  // Silent failure
}
```

**Problems:**
1. Logged as INFO, not WARNING or ERROR
2. No startup health check to verify SMTP actually works
3. No indication to operators that password reset is broken
4. Users get generic "something went wrong" when reset fails

## Solution

### Step 1: Add SMTP Connection Verification

```typescript
// server/services/email-service.ts

async verifyConnection(): Promise<boolean> {
  if (!this.isConfigured || !this.transporter) {
    return false;
  }

  try {
    await this.transporter.verify();
    logger.info('✅ SMTP connection verified successfully');
    return true;
  } catch (error) {
    logger.error('❌ SMTP connection verification failed:', error);
    return false;
  }
}
```

### Step 2: Call Verification at Startup

```typescript
// server/index.ts (after email service initialization)

// Verify email service if configured
if (emailService.isReady()) {
  const smtpOk = await emailService.verifyConnection();
  if (!smtpOk) {
    log.error('============ WARNING ============');
    log.error('SMTP configured but connection FAILED');
    log.error('Password reset emails will NOT work');
    log.error('Check SMTP credentials and server');
    log.error('=================================');

    if (isProduction) {
      // In production, this is a critical warning but not fatal
      // (app can still function without email)
      log.error('Consider this a P1 issue - users cannot reset passwords');
    }
  }
} else {
  log.warn('⚠️  Email service not configured - password reset disabled');
}
```

### Step 3: Add Health Check Endpoint

```typescript
// server/routes/health-routes.ts

app.get('/api/health/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      email: {
        configured: emailService.isReady(),
        verified: emailService.isReady() ? await emailService.verifyConnection() : false,
      },
      openai: !!process.env.OPENAI_API_KEY,
    },
  };

  // If critical services down, return 503
  if (!health.services.database || !health.services.redis) {
    health.status = 'unhealthy';
    return res.status(503).json(health);
  }

  // If optional services down, return 200 with degraded status
  if (!health.services.email.verified) {
    health.status = 'degraded';
  }

  sendSuccess(res, health);
});
```

### Step 4: Update Logging Level

```typescript
// Change from INFO to WARN
if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
  logger.warn('⚠️  Email service not configured - password reset will be unavailable');
  this.isConfigured = false;
  return;
}
```

## Implementation Checklist

- [x] Add `verifyConnection()` method to EmailService
- [x] Call verification at startup in `server/index.ts`
- [ ] Add detailed health check endpoint (deferred - separate TODO)
- [x] Change email config log level from INFO to WARN
- [ ] Add documentation for SMTP troubleshooting (deferred - separate TODO)
- [x] Test with valid and invalid SMTP credentials

## Success Criteria

- [x] SMTP connection verified at startup (if configured)
- [x] Clear error message if SMTP verification fails
- [ ] Health endpoint shows email service status (deferred - separate TODO)
- [x] Operators alerted to email issues before users discover them
- [x] Log level appropriate (WARN not INFO for missing config)

## Related Files

- `server/services/email-service.ts` - Add verification
- `server/index.ts` - Call verification at startup
- `server/routes/health-routes.ts` - Add detailed health endpoint

---

**Created by**: Production Readiness Audit
**Creation Date**: 2026-01-25
