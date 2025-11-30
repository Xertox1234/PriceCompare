---
Pattern: Security Patterns & Anti-Patterns
Version: 2.1
Last Updated: 2025-11-28
Maintainer: Claude Code / Development Team
Status: Active
Related Patterns: [DATABASE_PATTERNS.md, API_PATTERNS.md, ERROR_HANDLING_PATTERNS.md, TYPESCRIPT_PATTERNS.md, AUTHENTICATION_PATTERNS.md]
Changelog:
  - 2.1 (2025-11-28): Password Security section - centralized constants, special character validation, bcrypt rounds, script credential handling
  - 2.0 (2025-11-27): Major CSRF protection expansion - added critical anti-patterns, auth endpoint requirements, exemption guidelines
  - 1.0 (2025-11-26): Initial security patterns
---

# Security Patterns & Anti-Patterns

This document codifies security patterns to prevent vulnerabilities and ensure data protection in the PriceCompare codebase.

## Table of Contents
- [Critical Security Violations](#critical-security-violations)
- [Authentication & Authorization](#authentication--authorization)
- [Password Security (NEW - 2025-11-28)](#password-security-new---2025-11-28)
- [Input Validation & Sanitization](#input-validation--sanitization)
- [Error Handling & Information Disclosure](#error-handling--information-disclosure)
- [Session Management](#session-management)
- [CSRF Protection](#csrf-protection)
- [Rate Limiting & DDoS Protection](#rate-limiting--ddos-protection)
- [SQL Injection Prevention](#sql-injection-prevention)
- [XSS Prevention](#xss-prevention)

---

## Critical Security Violations

These violations will **FAIL pre-commit hooks** and block commits.

### 1. Password Hash Exposure (COMMIT BLOCKER)

#### ❌ NEVER DO THIS - Expose Password Hash
```typescript
// THIS WILL FAIL PRE-COMMIT HOOK!
const user = await db.select().from(users);
// Returns passwordHash field - CRITICAL VULNERABILITY

// Also bad - logging user object
console.log('User data:', user); // Could expose passwordHash

// Bad in API responses
res.json(user); // Sends passwordHash to client!
```

#### ✅ CORRECT - Explicit Field Selection
```typescript
// Always exclude passwordHash from selections
const user = await db.select({
  id: users.id,
  email: users.email,
  username: users.username,
  role: users.role,
  // SECURITY: Never expose passwordHash
}).from(users);

// Safe to return
res.json(user);
```

#### ✅ CORRECT - Authentication Flow
```typescript
// server/auth.ts - Only place passwordHash is used
async function authenticateUser(email: string, password: string) {
  // SECURITY: passwordHash only for verification, never exposed
  const [user] = await db.select({
    id: users.id,
    passwordHash: users.passwordHash,
  }).from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    // Don't reveal if email exists
    throw new Error('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Never return passwordHash
  return { id: user.id };
}
```

### 2. Direct Error Message Exposure (COMMIT BLOCKER)

#### ❌ NEVER DO THIS - Expose Internal Errors
```typescript
// THIS WILL FAIL PRE-COMMIT WARNING!
try {
  await db.insert(users).values(data);
} catch (error) {
  // Exposes database schema, constraints, internal details
  res.status(500).json({ error: error.message });
}
```

#### ✅ CORRECT - Sanitized Error Responses
```typescript
import { createErrorResponse } from '../utils/error-sanitizer';

try {
  await db.insert(users).values(data);
} catch (error) {
  console.error('User creation failed:', error); // Log full error server-side

  const errorResponse = createErrorResponse(error, 'UserCreation');
  res.status(errorResponse.status).json({
    error: errorResponse.error, // Generic message in production
    details: errorResponse.details, // Only in development
  });
}
```

### 3. Console.log in Production (COMMIT BLOCKER)

#### ❌ NEVER DO THIS - Console.log in Production
```typescript
// THIS WILL FAIL PRE-COMMIT HOOK!
console.log('Processing payment:', paymentData);
console.debug('User session:', req.session);
```

#### ✅ CORRECT - Use Proper Logging
```typescript
import { log } from '../utils/logger';

// Structured logging with appropriate levels
log.info('Processing payment', {
  userId: paymentData.userId,
  amount: paymentData.amount,
  // Don't log sensitive data like card numbers
});

log.debug('User session started', {
  userId: req.session.userId,
  // Don't log session tokens
});
```

---

## Authentication & Authorization

### Secure Password Storage

#### ✅ CORRECT - Bcrypt with Salt Rounds
```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10; // Minimum recommended

// Registration
async function registerUser(email: string, password: string) {
  // Validate password strength first
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await db.insert(users).values({
    email,
    passwordHash, // Store hash, never plain password
  });
}

// Login
async function verifyPassword(inputPassword: string, storedHash: string) {
  return await bcrypt.compare(inputPassword, storedHash);
}
```

### Session Security

#### ✅ CORRECT - Secure Session Configuration
```typescript
// server/index.ts
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET!, // Strong random secret
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only
    httpOnly: true, // No JavaScript access
    sameSite: 'lax', // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));
```

### Authorization Checks

#### ✅ CORRECT - Middleware-Based Authorization
```typescript
// server/middleware/auth.ts
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Usage in routes
router.delete('/api/products/:id',
  requireAuth,
  requireAdmin,
  csrfProtection,
  async (req, res) => {
    // Only admins can reach here
  }
);
```

### Account Lockout

#### ✅ CORRECT - Progressive Delays
```typescript
// server/middleware/account-lockout.ts
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export async function checkAccountLockout(email: string): Promise<boolean> {
  const key = `lockout:${email}`;
  const attempts = await redis.get(key);

  if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
    return true; // Account locked
  }
  return false;
}

export async function recordFailedAttempt(email: string): Promise<void> {
  const key = `lockout:${email}`;
  await redis.incr(key);
  await redis.expire(key, LOCKOUT_DURATION / 1000);
}

export async function clearFailedAttempts(email: string): Promise<void> {
  await redis.del(`lockout:${email}`);
}
```

---

## Password Security (NEW - 2025-11-28)

This section was added following a comprehensive authentication security audit that identified three critical issues:
1. Password validation missing special character enforcement
2. Password minimum length inconsistency (8 vs 12 characters)
3. Hardcoded admin password in setup script

### Centralized Password Constants (MANDATORY)

**ALL password validation MUST use centralized PASSWORD constants** from `server/utils/constants.ts`.

```typescript
// server/utils/constants.ts
export const PASSWORD = {
  MIN_LENGTH: 12,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  MIN_STRENGTH_SCORE: 3,
  BCRYPT_ROUNDS: 12,
} as const;
```

### Password Validation Completeness

**ALL PASSWORD requirement flags MUST be enforced.** If a constant is defined but not checked, it creates a security gap.

#### ❌ CRITICAL - Incomplete Validation (Real Bug Found)
```typescript
// This was the actual bug - REQUIRE_SPECIAL defined but not enforced!
export function validatePassword(password: string) {
  const errors: string[] = [];

  if (password.length < PASSWORD.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD.MIN_LENGTH} characters`);
  }

  if (PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // ❌ BUG: REQUIRE_SPECIAL was true but this check was MISSING!
  // Passwords without special characters were accepted despite the constant

  return { valid: errors.length === 0, errors };
}
```

#### ✅ CORRECT - Complete Validation
```typescript
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD.MIN_LENGTH} characters long`);
  }

  if (PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // SECURITY: Require special characters to increase password strength
  if (PASSWORD.REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}
```

### Zod Schema Consistency

Zod schemas in route files MUST reference PASSWORD constants, not hardcoded values.

#### ❌ WRONG - Hardcoded Length Creates Inconsistency
```typescript
// server/routes/auth-routes.ts
// BUG: Zod says 8 chars, but validatePassword() requires 12!
const registerSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});
```

#### ✅ CORRECT - Use Centralized Constants
```typescript
import { PASSWORD } from "../utils/constants";

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH, `Password must be less than ${PASSWORD.MAX_LENGTH} characters`),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH, `Password must be less than ${PASSWORD.MAX_LENGTH} characters`),
});
```

### Bcrypt Rounds Constant

**NEVER hardcode bcrypt rounds.** Use `PASSWORD.BCRYPT_ROUNDS` for consistent security configuration.

#### ❌ WRONG - Magic Number
```typescript
// Different files might use different values!
const hash = await bcrypt.hash(password, 10);  // One file
const hash = await bcrypt.hash(password, 12);  // Another file
```

#### ✅ CORRECT - Centralized Constant
```typescript
import { PASSWORD } from '../utils/constants';

const hash = await bcrypt.hash(password, PASSWORD.BCRYPT_ROUNDS);
```

### Script Credential Handling (CRITICAL)

**NEVER hardcode passwords in scripts**, even for development or admin setup.

#### ❌ CRITICAL VULNERABILITY - Hardcoded Password
```typescript
// server/scripts/create-admin.ts
// This password ends up in git history FOREVER!
async function createAdmin() {
  const hashedPassword = await bcrypt.hash('AdminPassword123!', 12);
  await db.insert(users).values({
    email: 'admin@pricecompare.com',
    passwordHash: hashedPassword,
  });
}
```

#### ✅ CORRECT - Environment Variable with Validation
```typescript
import { PASSWORD } from '../utils/constants';
import { validatePassword } from '../utils/validation-helpers';

async function createAdmin() {
  // SECURITY: Read from environment variable
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    log.error('ADMIN_PASSWORD environment variable is required');
    log.error('Example: ADMIN_PASSWORD="YourSecurePassword123!" npm run create-admin');
    process.exit(1);
  }

  // Validate password meets security requirements
  const validation = validatePassword(adminPassword);
  if (!validation.valid) {
    log.error('Admin password does not meet security requirements:', {
      errors: validation.errors
    });
    process.exit(1);
  }

  // Use centralized bcrypt rounds
  const hashedPassword = await bcrypt.hash(adminPassword, PASSWORD.BCRYPT_ROUNDS);

  await db.insert(users).values({
    email: 'admin@pricecompare.com',
    passwordHash: hashedPassword,
    role: 'admin',
  });

  log.info('Admin user created successfully');
  log.warn('Please save your admin password securely - it cannot be recovered');
}
```

### Test Password Requirements

**Test passwords MUST meet actual validation requirements.** When password requirements change, tests must be updated.

#### ❌ WRONG - Test Password Doesn't Meet Requirements
```typescript
// Tests pass but use weak passwords that wouldn't work in production!
it('should register a user', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      password: 'Test123',  // Only 7 chars, no special character
    });
});
```

#### ✅ CORRECT - Test Passwords Meet Requirements
```typescript
it('should register a user', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      password: 'SecurePass123!',  // 14 chars, has uppercase, lowercase, number, special
    });
});

it('should reject password without special character', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      password: 'NoSpecialChar123',  // Missing special character
    });

  expectBadRequestError(response, 'Password must contain at least one special character');
});
```

### Password Security Checklist

Use this checklist when reviewing password-related code:

#### Implementation Review
- [ ] Password validation uses `PASSWORD.MIN_LENGTH` (12 characters)
- [ ] Password validation uses `PASSWORD.MAX_LENGTH` (128 characters)
- [ ] Password hashing uses `PASSWORD.BCRYPT_ROUNDS` (12 rounds)
- [ ] ALL PASSWORD requirement flags are enforced:
  - [ ] `REQUIRE_UPPERCASE` - Check for `/[A-Z]/`
  - [ ] `REQUIRE_LOWERCASE` - Check for `/[a-z]/`
  - [ ] `REQUIRE_NUMBER` - Check for `/[0-9]/`
  - [ ] `REQUIRE_SPECIAL` - Check for `/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/`
- [ ] Zod schemas use PASSWORD constants (not hardcoded numbers)
- [ ] Error messages include actual constant values (dynamic, not hardcoded)

#### Script & Test Review
- [ ] No hardcoded passwords in scripts (use environment variables)
- [ ] Scripts validate passwords before hashing
- [ ] Test passwords meet actual requirements (12+ chars with special)
- [ ] Tests cover each password requirement (positive and negative cases)

#### Detection Commands
```bash
# Find hardcoded password lengths
grep -rn "\.min(8" server/routes/ | grep -i password
grep -rn "\.min(12" server/routes/ | grep -v PASSWORD

# Find hardcoded bcrypt rounds
grep -rn "bcrypt.hash.*[0-9]\+)" server/ | grep -v PASSWORD.BCRYPT_ROUNDS

# Find hardcoded passwords in scripts
grep -rn "bcrypt.hash.*['\"]\w" server/scripts/

# Find incomplete validation (missing REQUIRE_SPECIAL)
grep -rn "REQUIRE_UPPERCASE\|REQUIRE_LOWERCASE\|REQUIRE_NUMBER" server/ | \
  grep -v REQUIRE_SPECIAL
```

---

## Input Validation & Sanitization

### Use Zod Schemas

#### ✅ CORRECT - Schema Validation
```typescript
import { z } from 'zod';

// Define schema
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  price: z.number().positive().max(1000000),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  categoryId: z.number().int().positive(),
});

// Route with validation
router.post('/api/products', csrfProtection, async (req, res) => {
  try {
    // Validate and sanitize input
    const data = createProductSchema.parse(req.body);

    // Data is now typed and validated
    const product = await storage.createProduct(data);
    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    // Handle other errors...
  }
});
```

### Safe Integer Parsing (MANDATORY)

NEVER use `parseInt()` directly for user input. Always use `parseIntSafe()` or `parseIntOptional()` with validation.

#### ❌ WRONG - Unsafe Parsing
```typescript
// THIS WILL FAIL CODE REVIEW!
const id = parseInt(req.params.id);        // Accepts NaN, negative, floats
const limit = parseInt(req.query.limit);   // No validation
const offset = Number(req.query.offset);   // No bounds checking

// Problems:
// - parseInt("abc") returns NaN → database errors
// - parseInt("-5") returns -5 → invalid ID
// - parseInt("3.14") returns 3 → silent data loss
// - No max bounds → memory exhaustion attacks
```

#### ✅ CORRECT - Safe Parsing with Validation
```typescript
import { parseIntSafe, parseIntOptional } from '../utils/validation-helpers';

// Required parameter with validation
const id = parseIntSafe(req.params.id, 'watchlistId', { min: 1 });
// - Throws ValidationError if not a valid integer
// - Enforces minimum value of 1
// - Returns validated number or throws

// Optional parameter with default
const limit = parseIntOptional(req.query.limit) || 50;
// - Returns number if valid
// - Returns undefined if invalid
// - Caller provides default value

// Optional with bounds
const offset = parseIntOptional(req.query.offset, { min: 0, max: 10000 }) || 0;
```

#### Detection Rule
```bash
# Find unsafe parseInt usage in route handlers
# Should use parseIntSafe or parseIntOptional instead
grep -r "parseInt(" server/routes/ server/*-routes.ts | grep -v "parseIntSafe" | grep -v "parseIntOptional"

# Find Number() coercion (also unsafe)
grep -r "Number(req\." server/routes/ server/*-routes.ts
```

#### Implementation Reference
```typescript
// utils/validation-helpers.ts
export function parseIntSafe(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): number {
  const parsed = parseInt(String(value), 10);

  if (isNaN(parsed)) {
    throw new ValidationError(`${fieldName} must be a valid integer`, {
      [fieldName]: 'Invalid integer',
    });
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new ValidationError(`${fieldName} must be at least ${options.min}`, {
      [fieldName]: `Minimum value is ${options.min}`,
    });
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new ValidationError(`${fieldName} must not exceed ${options.max}`, {
      [fieldName]: `Maximum value is ${options.max}`,
    });
  }

  return parsed;
}

export function parseIntOptional(
  value: unknown,
  options: { min?: number; max?: number } = {}
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  try {
    return parseIntSafe(value, 'value', options);
  } catch {
    return undefined;
  }
}
```

#### Common Use Cases
```typescript
// Route parameters (required, positive IDs)
const userId = parseIntSafe(req.params.userId, 'userId', { min: 1 });
const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

// Pagination parameters (optional, with limits)
const page = parseIntOptional(req.query.page, { min: 1 }) || 1;
const limit = Math.min(
  parseIntOptional(req.query.limit, { min: 1, max: 100 }) || 50,
  100
);

// Array of IDs from query string
const ids = req.query.ids
  ?.split(',')
  .map((id: string) => parseIntSafe(id, 'productId', { min: 1 }))
  .filter((id: number) => id > 0) || [];
```

### File Upload Validation

#### ✅ CORRECT - Secure File Handling
```typescript
import multer from 'multer';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Invalid file type'));
    }

    // Check MIME type
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images allowed'));
    }

    cb(null, true);
  },
  storage: multer.memoryStorage(), // Process in memory, save to cloud storage
});

router.post('/api/upload',
  requireAuth,
  upload.single('image'),
  async (req, res) => {
    // Additional validation
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Scan for malware if needed
    // Save to secure location with random filename
  }
);
```

---

## Error Handling & Information Disclosure

### Error Sanitization

#### ✅ CORRECT - Error Sanitizer Utility
```typescript
// server/utils/error-sanitizer.ts
export function createErrorResponse(
  error: unknown,
  operation: string
): { status: number; error: string; details?: any } {
  console.error(`${operation} failed:`, error);

  // Development: Include details
  if (process.env.NODE_ENV === 'development') {
    if (error instanceof z.ZodError) {
      return {
        status: 400,
        error: 'Validation failed',
        details: error.errors,
      };
    }

    if (error instanceof Error) {
      return {
        status: 500,
        error: error.message,
        details: error.stack,
      };
    }
  }

  // Production: Generic messages
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      error: 'Invalid input provided',
    };
  }

  // Check for known database errors
  if (error instanceof Error) {
    if (error.message.includes('unique constraint')) {
      return {
        status: 409,
        error: 'This item already exists',
      };
    }

    if (error.message.includes('foreign key')) {
      return {
        status: 400,
        error: 'Referenced item not found',
      };
    }
  }

  // Generic error
  return {
    status: 500,
    error: 'An unexpected error occurred',
  };
}
```

### Security Logging

#### ✅ CORRECT - Security Event Logging
```typescript
// server/utils/security-logger.ts
export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

export function logSecurityEvent(
  type: SecurityEventType,
  req: Request,
  metadata?: any
): void {
  const event = {
    type,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.session?.userId,
    path: req.path,
    method: req.method,
    metadata,
  };

  // Log to security monitoring system
  console.error('[SECURITY]', JSON.stringify(event));

  // Could also send to SIEM, CloudWatch, etc.
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(`Security Event: ${type}`, {
      level: 'warning',
      extra: event,
    });
  }
}
```

---

## CSRF Protection

### CSRF Protection Enforcement (MANDATORY)

ALL mutating operations (POST, PATCH, DELETE, PUT) MUST use `csrfProtection` middleware.

#### ❌ WRONG - Missing CSRF Protection
```typescript
// THIS WILL FAIL CODE REVIEW!
app.post('/api/notifications/preferences', requireAuth, async (req, res) => {
  // Missing csrfProtection middleware - vulnerable to CSRF attacks!
  await storage.updateNotificationPreferences(req.session.userId, req.body);
  res.json({ success: true });
});

app.delete('/api/watchlists/:id', requireAuth, async (req, res) => {
  // Missing csrfProtection - attacker can delete user's watchlists!
  await storage.deleteWatchlist(id);
  res.json({ success: true });
});
```

#### ✅ CORRECT - CSRF Protection Applied
```typescript
import { csrfProtection } from '../middleware/security';

// POST endpoint with CSRF protection
app.post('/api/notifications/preferences',
  requireAuth,
  csrfProtection,  // MANDATORY for all mutating operations
  async (req, res) => {
    await storage.updateNotificationPreferences(req.session.userId, req.body);
    res.json({ success: true });
  }
);

// DELETE endpoint with CSRF protection
app.delete('/api/watchlists/:id',
  requireAuth,
  csrfProtection,  // MANDATORY - protects against malicious deletions
  async (req, res) => {
    await storage.deleteWatchlist(id);
    res.json({ success: true });
  }
);
```

#### Detection Rule
```bash
# Find POST/PATCH/DELETE routes without csrfProtection
# Run in code review to catch missing CSRF protection
grep -r "app\.\(post\|patch\|delete\|put\)" server/routes/ | grep -v csrfProtection | grep -v "// CSRF exempt"

# Check specific route file
grep -E "router\.(post|patch|delete|put)" server/routes/notification-routes.ts | grep -v csrfProtection
```

**CSRF Exemptions** (rare, require security review):
```typescript
// Only exempt for specific use cases (webhook callbacks, public endpoints)
app.post('/api/affiliate/track-click', async (req, res) => {
  // CSRF exempt: Public tracking endpoint with no authentication
  await trackAffiliateClick(req.body);
  res.json({ success: true });
});
```

### Middleware Order for CSRF (CRITICAL)

**CORRECT order: `csrfProtection` → `withAuth/withAdmin` → handler**

#### ✅ CORRECT - CSRF Before Auth
```typescript
import { csrfProtection } from '../middleware/security';
import { withAuth, withAdmin } from './helpers';

// Standard authenticated endpoint
app.post('/api/endpoint',
  csrfProtection,     // 1. Verify CSRF token (fast, fails early)
  withAuth(async (req, res) => {  // 2. Verify authentication
    // 3. Execute business logic
  })
);

// Admin-only endpoint
app.post('/api/admin/products',
  csrfProtection,     // 1. Verify CSRF token
  withAdmin(async (req, res) => {  // 2. Verify admin role
    // 3. Execute business logic
  })
);
```

#### ❌ WRONG - Auth Before CSRF
```typescript
// INEFFICIENT - authenticates before checking CSRF
app.post('/api/endpoint',
  requireAuth,        // ❌ Wastes resources on invalid CSRF requests
  csrfProtection,
  async (req, res) => {}
);

// INCONSISTENT - doesn't match project standard
app.post('/api/notifications/:id/read',
  requireAuth,        // ❌ Should be csrfProtection first
  csrfProtection,
  async (req, res) => {}
);
```

**Why CSRF First:**
- CSRF validation is fast (token comparison)
- Fails early for invalid requests
- Prevents wasting auth resources on CSRF attacks
- Consistent with project-wide pattern (44+ endpoints)

### CRITICAL ANTI-PATTERN: Global CSRF Protection

**NEVER apply `csrfProtection` globally** - use per-route protection instead.

#### ❌ CRITICAL MISTAKE - Global CSRF Middleware
```typescript
// server/index.ts
// THIS WILL CAUSE DOUBLE-PROTECTION CONFLICTS!
app.use(csrfProtection);  // ❌ WRONG - applies to ALL routes

// Then in route files:
app.post('/api/admin/products', csrfProtection, withAdmin(async (req, res) => {
  // ❌ csrfProtection runs TWICE - causes token consumption issues
}));
```

**Problems with Global CSRF:**
1. **Double Protection** - Token validated twice, consumed twice
2. **GET Request Rejection** - Safe methods incorrectly blocked
3. **CORS Issues** - Preflight OPTIONS requests fail
4. **Token Exhaustion** - Tokens may become invalid after first use
5. **Violates Middleware Pipeline** - Conflicts with documented order

#### ✅ CORRECT - Per-Route Protection
```typescript
// server/index.ts
// NOTE: CSRF protection is applied per-route in individual route files,
// not globally. This ensures GET requests aren't protected while mutations are.
// Each POST/PUT/PATCH/DELETE endpoint includes csrfProtection middleware.
// See server/routes/*.ts files for csrfProtection usage.

// In route files - apply selectively:
app.post('/api/admin/products', csrfProtection, withAdmin(async (req, res) => {
  // ✅ CSRF runs once, only on mutations
}));

app.get('/api/products', async (req, res) => {
  // ✅ No CSRF - GET is safe method
});
```

### Authentication Endpoints MUST Have CSRF Protection

**ALL authentication endpoints need CSRF protection** - they are high-value targets.

#### ❌ CRITICAL VULNERABILITY - Unprotected Auth Endpoints
```typescript
// THIS IS A CRITICAL SECURITY VULNERABILITY!
app.post('/api/auth/register', async (req, res) => {
  // ❌ No CSRF - attacker can create fake accounts from malicious site
  const user = await createUser(req.body);
  res.json(user);
});

app.post('/api/auth/login', (req, res, next) => {
  // ❌ No CSRF - attacker can force user login to attacker's account
  passport.authenticate('local')(req, res, next);
});

app.post('/api/auth/forgot-password', async (req, res) => {
  // ❌ No CSRF - attacker can spam password reset emails
  await sendPasswordResetEmail(req.body.email);
});
```

**Attack Scenarios Without CSRF:**
- **Account Creation**: Attacker tricks user into creating accounts
- **Login CSRF**: Force-login user to attacker's account for data harvesting
- **Password Reset Spam**: Flood users with reset emails
- **Session Fixation**: Establish attacker's session in user's browser

#### ✅ CORRECT - Protected Auth Endpoints
```typescript
import { csrfProtection, generateCsrfToken } from '../middleware/security';

// Provide token endpoint for unauthenticated clients
app.get('/api/csrf-token', (req, res) => {
  const token = generateCsrfToken(req);
  sendSuccess(res, { csrfToken: token });
});

// Protect all auth mutations
app.post('/api/auth/register', csrfProtection, async (req, res) => {
  // ✅ CSRF required - prevents unauthorized registration
  const user = await createUser(req.body);
  res.json(user);
});

app.post('/api/auth/login', csrfProtection, (req, res, next) => {
  // ✅ CSRF required - prevents login CSRF attacks
  passport.authenticate('local')(req, res, next);
});

app.post('/api/auth/forgot-password', csrfProtection, async (req, res) => {
  // ✅ CSRF required - prevents reset email spam
  await sendPasswordResetEmail(req.body.email);
});

app.post('/api/auth/reset-password', csrfProtection, async (req, res) => {
  // ✅ CSRF required - prevents unauthorized password changes
  await resetPassword(req.body.token, req.body.password);
});
```

**Token Flow for Unauthenticated Clients:**
1. Client calls `GET /api/csrf-token` to obtain token
2. Token stored in session (server-side)
3. Client includes token in subsequent auth requests
4. Token header: `X-CSRF-Token: <token>` or body: `_csrf: <token>`

### CSRF Exemptions (Rare - Requires Security Review)

**Most endpoints should NOT be exempted.** Only exempt for specific, justified use cases.

#### Valid Exemption Scenarios

1. **Public Analytics/Tracking** - Cross-origin read-only tracking
2. **Webhook Callbacks** - External services with signature verification
3. **Health Checks** - Monitoring endpoints with no state changes

#### ✅ CORRECT - Justified Exemption with Documentation
```typescript
// server/middleware/security.ts
const CSRF_EXEMPT_PATHS = [
  '/api/health',                    // Public health check - no auth, no state change
  '/api/affiliate/track-click',     // Public click tracking - analytics only
  '/api/webhooks/stripe',           // Webhook with signature verification
];

// In route file - clearly document why exempt
app.post("/api/affiliate/track-click/:offerId", async (req, res) => {
  // NOTE: This endpoint is intentionally public and exempted from CSRF protection
  // because it's called cross-origin from retailer sites for analytics tracking.
  // No user data modified, only logs analytics events.
  // See server/middleware/security.ts CSRF_EXEMPT_PATHS for exemption.
  await trackAffiliateClick(offerId);
  res.json({ success: true });
});
```

#### ❌ WRONG - Invalid Exemption Reasons
```typescript
// ❌ BAD: "Too hard to implement" - NOT ACCEPTABLE
app.post("/api/admin/products", async (req, res) => {
  // No CSRF because "client doesn't support tokens yet"
  // THIS IS A CRITICAL SECURITY VULNERABILITY!
});

// ❌ BAD: "Only internal use" - STILL VULNERABLE
app.delete("/api/admin/users/:id", async (req, res) => {
  // No CSRF because "only admins can access"
  // Attacker can trick admin into visiting malicious site!
});

// ❌ BAD: Conflicting protection and exemption
app.post("/api/endpoint", csrfProtection, async (req, res) => {
  // Endpoint is ALSO in CSRF_EXEMPT_PATHS
  // Redundant and confusing - choose one approach
});
```

**Exemption Checklist:**
- [ ] Endpoint is truly public (no authentication required)?
- [ ] Endpoint performs NO user-specific state changes?
- [ ] Alternative protection exists (signature verification, rate limiting)?
- [ ] Exemption documented in code with clear justification?
- [ ] Security team has approved exemption?
- [ ] Exemption added to `CSRF_EXEMPT_PATHS` in security.ts?

**When in doubt: ALWAYS apply CSRF protection.**

### Token Management

#### ✅ CORRECT - CSRF Token Flow
```typescript
// server/middleware/security.ts
import crypto from 'crypto';

// Generate token per session
export function generateCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

// Attach token to responses
export function attachCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (req.session) {
    const token = generateCsrfToken(req);
    res.setHeader('X-CSRF-Token', token);
  }
  next();
}

// Validate token on state-changing requests
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for whitelisted paths
  const exemptPaths = ['/api/health', '/api/affiliate/track-click'];
  if (exemptPaths.includes(req.path)) {
    return next();
  }

  const sessionToken = req.session?.csrfToken;
  const requestToken = req.headers['x-csrf-token'] as string;

  if (!sessionToken || !requestToken) {
    logSecurityEvent(SecurityEventType.CSRF_VIOLATION, req);
    return res.status(403).json({ error: 'CSRF token required' });
  }

  // Timing-safe comparison
  const sessionBuffer = Buffer.from(sessionToken);
  const requestBuffer = Buffer.from(requestToken);

  if (sessionBuffer.length !== requestBuffer.length ||
      !crypto.timingSafeEqual(sessionBuffer, requestBuffer)) {
    logSecurityEvent(SecurityEventType.CSRF_VIOLATION, req);
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}
```

### CSRF Implementation Checklist

Use this checklist when implementing or reviewing CSRF protection:

#### Server-Side Implementation
- [ ] All POST/PUT/PATCH/DELETE endpoints have `csrfProtection` middleware
- [ ] CSRF middleware is placed BEFORE auth middleware (`csrfProtection, withAuth`)
- [ ] NO global `app.use(csrfProtection)` in server/index.ts
- [ ] Auth endpoints (`/register`, `/login`, `/forgot-password`, `/reset-password`) protected
- [ ] `/api/csrf-token` GET endpoint exists for unauthenticated clients
- [ ] `csrfProtection` middleware uses timing-safe comparison (`crypto.timingSafeEqual`)
- [ ] CSRF tokens generated with crypto.randomBytes (32+ bytes)
- [ ] Tokens stored in session, not cookies
- [ ] Exemptions documented in both code AND `CSRF_EXEMPT_PATHS`
- [ ] Security events logged for CSRF violations

#### Client-Side Implementation
- [ ] Client fetches CSRF token before auth operations (`GET /api/csrf-token`)
- [ ] Token included in request headers (`X-CSRF-Token: <token>`)
- [ ] Token included in request body (`_csrf: <token>`) as fallback
- [ ] Token refreshed on session changes
- [ ] 403 CSRF errors handled gracefully (show user-friendly message)

#### Testing & Validation
- [ ] Test: Valid token allows mutation
- [ ] Test: Missing token returns 403
- [ ] Test: Invalid token returns 403
- [ ] Test: GET/HEAD/OPTIONS requests don't require token
- [ ] Test: Exempted paths bypass protection
- [ ] Test: Auth endpoints require token
- [ ] Test: Token from one session doesn't work in another
- [ ] Code review: All mutations have `csrfProtection`
- [ ] Security scan: No unprotected mutations found

#### Documentation
- [ ] CSRF protection mentioned in API documentation
- [ ] Client integration guide includes CSRF token handling
- [ ] Exemptions justified and documented
- [ ] Security event logging configured for CSRF violations

**Reference Implementation:** See `CSRF_PROTECTION_AUDIT.md` for complete implementation details covering 48 endpoints.

---

## Rate Limiting & DDoS Protection

### Layered Rate Limiting

#### ✅ CORRECT - Multiple Rate Limiters
```typescript
// server/middleware/rate-limiting.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// General API rate limit
export const apiLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict auth rate limit
export const authLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, req);
    res.status(429).json({ error: 'Too many login attempts' });
  },
});

// Very strict password reset limit
export const passwordResetLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
});

// Apply to routes
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
```

### DDoS Protection

#### ✅ CORRECT - Request Size Limits
```typescript
// Limit request body size
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Timeout long-running requests
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});
```

---

## SQL Injection Prevention

### Parameterized Queries

#### ❌ WRONG - String Concatenation
```typescript
// NEVER DO THIS - SQL Injection vulnerable!
const query = `SELECT * FROM users WHERE email = '${userInput}'`;
const result = await db.execute(sql.raw(query));
```

#### ✅ CORRECT - Parameterized with Drizzle
```typescript
// Safe - Drizzle parameterizes automatically
const result = await db.select()
  .from(users)
  .where(eq(users.email, userInput));

// Safe - Using SQL template literals
const result = await db.select()
  .from(products)
  .where(sql`${products.name} ILIKE ${'%' + searchTerm + '%'}`);
```

---

## XSS Prevention

### Output Encoding

#### ✅ CORRECT - React Auto-Escaping
```typescript
// React automatically escapes values
function ProductCard({ product }) {
  return (
    <div>
      <h2>{product.name}</h2> {/* Auto-escaped */}
      <p>{product.description}</p> {/* Auto-escaped */}
    </div>
  );
}

// Dangerous - only if absolutely necessary
function RichContent({ html }) {
  // Sanitize server-side first!
  return (
    <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
  );
}
```

### Content Security Policy

#### ✅ CORRECT - CSP Headers
```typescript
// server/middleware/security.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Avoid unsafe-inline in production
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
```

---

## Security Headers

#### ✅ CORRECT - Comprehensive Security Headers
```typescript
// server/middleware/security.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // ... CSP directives
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Additional headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader('Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  next();
});
```

---

## Environment Variables

### Secret Management

#### ❌ WRONG - Hardcoded Secrets
```typescript
// NEVER DO THIS!
const SESSION_SECRET = 'my-secret-key-123';
const API_KEY = 'sk_live_abcd1234';
```

#### ✅ CORRECT - Environment Variables
```typescript
// server/config/env-validation.ts
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Usage
const sessionSecret = getRequiredEnv('SESSION_SECRET');
const apiKey = getRequiredEnv('OPENAI_API_KEY');

// .env.example (commit this)
SESSION_SECRET=generate-with-openssl-rand-base64-32
DATABASE_URL=postgresql://user:pass@localhost/db
REDIS_URL=redis://localhost:6379

// .env (never commit this)
SESSION_SECRET=actualSecretHere123...
```

---

## Security Checklist

### Pre-Deployment Security Audit

- [ ] **Authentication**
  - [ ] Passwords hashed with bcrypt (min 10 rounds)
  - [ ] Session secrets are cryptographically random
  - [ ] Account lockout after failed attempts
  - [ ] Password complexity requirements enforced

- [ ] **Authorization**
  - [ ] All routes have appropriate auth checks
  - [ ] Admin routes protected with role checks
  - [ ] IDOR vulnerabilities checked

- [ ] **Input Validation**
  - [ ] All inputs validated with Zod schemas
  - [ ] File uploads restricted by type/size
  - [ ] Integer parsing uses safe helpers

- [ ] **Output Security**
  - [ ] Password hashes never exposed
  - [ ] Errors sanitized in production
  - [ ] No console.log in production code

- [ ] **CSRF Protection**
  - [ ] CSRF tokens on state-changing requests
  - [ ] SameSite cookie attribute set

- [ ] **Rate Limiting**
  - [ ] Auth endpoints rate limited
  - [ ] API endpoints rate limited
  - [ ] Password reset strictly limited

- [ ] **Headers & Transport**
  - [ ] HTTPS enforced in production
  - [ ] Security headers configured (Helmet)
  - [ ] HSTS enabled with preload

- [ ] **Secrets Management**
  - [ ] No hardcoded secrets
  - [ ] Environment variables validated
  - [ ] Secrets rotated regularly

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [DATABASE_PATTERNS.md](DATABASE_PATTERNS.md) - Database security patterns
- [AUTHENTICATION_PATTERNS.md](AUTHENTICATION_PATTERNS.md) - Auth implementation details
- [Pre-commit Hook](.git/hooks/pre-commit) - Security checks