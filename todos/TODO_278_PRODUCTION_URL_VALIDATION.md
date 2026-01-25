# TODO 278: Add Production URL Validation for APP_URL and CLIENT_URL

**Priority**: P1 (CRITICAL)
**Estimated Time**: 1 hour
**Status**: ✅ COMPLETED (2026-01-25)
**Source**: Production Readiness Audit 2026-01-25

## Problem Statement

Two critical URL environment variables default to `localhost` with **no validation in production**:

1. **`APP_URL`** - Used in password reset emails
2. **`CLIENT_URL`** - Used in WebSocket CORS origin

### Production Impact

**Password Reset Emails Broken:**
```typescript
// server/services/email-service.ts:133
const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=...`;
```
- Users receive emails with `http://localhost:5000/reset-password?token=...`
- Link is completely broken - users cannot reset passwords
- **This is a P1 bug that silently breaks a critical user flow**

**WebSocket CORS May Fail:**
```typescript
// server/websocket/index.ts:80
origin: process.env.CLIENT_URL || 'http://localhost:5000',

// server/services/websocket-service.ts:69
origin: process.env.CLIENT_URL || 'http://localhost:5000',
```
- Real-time features (notifications, price alerts) may fail silently
- Browser console shows CORS errors but server doesn't log the misconfiguration

**Smart Notifications Also Affected:**
```typescript
// server/services/smart-notification-service.ts:291
<a href="${process.env.APP_URL || 'http://localhost:5000'}/products/${product.id}">View Product</a>
```
- Product links in notification emails point to localhost

## Evidence: Other Services ARE Validated

The codebase already validates critical environment variables:

```typescript
// server/config/env-validation.ts:19-45
const REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  { name: 'DATABASE_URL', description: 'PostgreSQL connection string', critical: true },
  { name: 'SESSION_SECRET', description: 'Secret key for session encryption', critical: true },
  { name: 'ENCRYPTION_KEY', description: 'AES-256 encryption key for PII data', critical: true },
  { name: 'DISCOURSE_SSO_SECRET', description: 'Secret key for Discourse SSO', critical: true },
  { name: 'CSRF_SECRET', description: 'Secret key for CSRF token generation', critical: true },
];

const PRODUCTION_REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  { name: 'REDIS_URL', description: 'Redis connection URL', critical: true },
];
```

**`APP_URL` and `CLIENT_URL` should be added to `PRODUCTION_REQUIRED_ENV_VARS`.**

## Solution

### Step 1: Add to Environment Validation

**File**: `server/config/env-validation.ts`

```typescript
const PRODUCTION_REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  {
    name: 'REDIS_URL',
    description: 'Redis connection URL (required in production for distributed features)',
    critical: true,
  },
  {
    name: 'APP_URL',
    description: 'Application URL for email links (e.g., https://pricecompare.com)',
    critical: true,
  },
  {
    name: 'CLIENT_URL',
    description: 'Frontend URL for CORS/WebSocket origins (e.g., https://pricecompare.com)',
    critical: true,
  },
  {
    name: 'ALLOWED_ORIGINS',
    description: 'Comma-separated list of allowed CORS origins',
    critical: true,
  },
];
```

### Step 2: Add URL Format Validation

```typescript
function validateUrlFormat(name: string, value: string): string[] {
  const errors: string[] = [];

  // Must start with https:// in production (allow http:// only for localhost in dev)
  if (process.env.NODE_ENV === 'production' && !value.startsWith('https://')) {
    errors.push(`${name} must use HTTPS in production (got: ${value})`);
  }

  // Must not be localhost in production
  if (process.env.NODE_ENV === 'production' && value.includes('localhost')) {
    errors.push(`${name} cannot be localhost in production (got: ${value})`);
  }

  // Must be a valid URL
  try {
    new URL(value);
  } catch {
    errors.push(`${name} is not a valid URL (got: ${value})`);
  }

  return errors;
}
```

### Step 3: Update .env.example Documentation

```bash
# ==================================================================================
# APPLICATION URLS (REQUIRED IN PRODUCTION)
# ==================================================================================
# These URLs are used in emails and for CORS configuration.
# In production, these MUST be set to your actual domain.
# The app will NOT start in production if these are missing.
# ==================================================================================

# APP_URL - Used in password reset emails and notification links
# Must be the full URL where your app is accessible to users
# Production example: https://pricecompare.com
# Development default: http://localhost:5000
APP_URL=http://localhost:5000

# CLIENT_URL - Used for WebSocket CORS origin validation
# Usually the same as APP_URL unless frontend is on different domain
# Production example: https://pricecompare.com
CLIENT_URL=http://localhost:5000

# ALLOWED_ORIGINS - Comma-separated list of allowed CORS origins
# Production example: https://pricecompare.com,https://www.pricecompare.com
# Development: Automatically set to localhost variants
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5000
```

## Implementation Checklist

- [x] Add `APP_URL` to `PRODUCTION_REQUIRED_ENV_VARS` in `env-validation.ts`
- [x] Add `CLIENT_URL` to `PRODUCTION_REQUIRED_ENV_VARS` in `env-validation.ts`
- [x] Add `ALLOWED_ORIGINS` to `PRODUCTION_REQUIRED_ENV_VARS` in `env-validation.ts`
- [x] Add URL format validation (HTTPS required, no localhost in production)
- [x] Update `.env.example` with clear documentation
- [ ] Add unit tests for URL validation (future work)
- [ ] Update CLAUDE.md "Environment Variables" section (future work)

## Success Criteria

- [ ] App fails to start in production without `APP_URL`
- [ ] App fails to start in production without `CLIENT_URL`
- [ ] App fails to start in production without `ALLOWED_ORIGINS`
- [ ] Localhost URLs rejected in production
- [ ] HTTP (non-HTTPS) URLs rejected in production
- [ ] Clear error messages guide operators to fix configuration

## Related Files

- `server/config/env-validation.ts` - Add validation
- `server/services/email-service.ts:133` - Uses `APP_URL`
- `server/services/smart-notification-service.ts:291` - Uses `APP_URL`
- `server/websocket/index.ts:80` - Uses `CLIENT_URL`
- `server/services/websocket-service.ts:69` - Uses `CLIENT_URL`
- `.env.example` - Update documentation

---

**Created by**: Production Readiness Audit
**Creation Date**: 2026-01-25
**Discovered During**: Local dependency analysis with AI code review
