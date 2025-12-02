---
Pattern: Security Patterns & Anti-Patterns
Version: 2.1
Last Updated: 2025-12-02
Maintainer: Claude Code / Development Team
Status: Active - SINGLE SOURCE OF TRUTH
Migrated From:
  - docs/SECURITY_PATTERNS.md (1,511 lines)
  - docs/VALIDATION_PATTERNS.md (520 lines)
  - docs/AUTHENTICATION_PATTERNS.md (271 lines)
  - docs/PHASE0_WATCHLIST_PATTERNS.md (validation layer separation section)
Related Patterns: [DATABASE_PATTERNS.md, API_PATTERNS.md, ERROR_HANDLING_PATTERNS.md, TYPESCRIPT_PATTERNS.md]
Changelog:
  - 2.1 (2025-12-02): Added Dependency Security & Error Monitoring section with Sentry patterns, npm audit workflow, transitive dependency handling, real-world example (GHSA-6465-jgvq-jhgp)
  - 2.0 (2025-11-29): MAJOR CONSOLIDATION - Merged 4 pattern files, eliminated CSRF duplication across 8+ files
  - 1.0 (2025-11-28): Initial consolidated security patterns
---

# Security Patterns & Anti-Patterns

**This is the SINGLE SOURCE OF TRUTH for security patterns in the PriceCompare codebase.**

This document consolidates security, validation, and authentication patterns to prevent vulnerabilities and ensure data protection. All CSRF protection documentation has been centralized here from 8+ separate files.

## Table of Contents
- [Critical Security Violations](#critical-security-violations)
- [Authentication & Authorization](#authentication--authorization)
- [Password Security](#password-security)
- [Input Validation & Sanitization](#input-validation--sanitization)
- [Validation Layer Separation](#validation-layer-separation)
- [CSRF Protection - SINGLE SOURCE OF TRUTH](#csrf-protection---single-source-of-truth)
- [Rate Limiting & DDoS Protection](#rate-limiting--ddos-protection)
- [Session Management](#session-management)
- [Error Handling & Information Disclosure](#error-handling--information-disclosure)
- [SQL Injection Prevention](#sql-injection-prevention)
- [XSS Prevention](#xss-prevention)
- [Security Headers](#security-headers)
- [Environment Variables & Secret Management](#environment-variables--secret-management)
- [Dependency Security & Error Monitoring](#dependency-security--error-monitoring)
- [Development vs Production](#development-vs-production)
- [Security Checklist](#security-checklist)

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
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';

try {
  await db.insert(users).values(data);
} catch (error) {
  console.error('User creation failed:', error); // Log full error server-side
  sendErrorFromException(res, error, 'UserCreation');
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
import { PASSWORD } from './utils/constants';

// Registration
async function registerUser(email: string, password: string) {
  // Validate password strength first
  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD.BCRYPT_ROUNDS);

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

### Authorization Checks

#### ✅ CORRECT - Middleware-Based Authorization
```typescript
// server/routes/helpers.ts
export function withAuth(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    await handler(req, res);
  };
}

export function withAdmin(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }
    await handler(req, res);
  };
}

// Usage in routes
router.delete('/api/products/:id',
  csrfProtection,
  withAdmin(async (req, res) => {
    // Only admins can reach here
  })
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

## Password Security

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
import { sendSuccess, sendErrorFromException } from '../utils/api-response';

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
    sendSuccess(res, product, 201);
  } catch (error) {
    sendErrorFromException(res, error, 'CreateProduct');
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

## Validation Layer Separation

**CRITICAL**: Validation should happen at the **route layer** using Zod, NOT in the storage layer.

### The Problem: Order-of-Operations Bugs

When validation lives in storage, it runs AFTER route-layer transformations, leading to bugs:

```typescript
// ANTI-PATTERN: Storage layer validation
async createWatchList(data: { name: string }) {
  // Problem: By now, Zod may have already trimmed the input
  // Or worse: validation checks BEFORE trimming!
  if (!data.name || data.name.length === 0) {  // "   " passes! (length 3)
    throw new Error('Name is required');
  }
}
```

### Solution: Route-Layer Zod Validation

All input validation belongs in the route layer. Storage assumes valid data.

#### Route Layer (Zod)
```typescript
// Order matters: .trim() BEFORE .min()
const createWatchListSchema = z.object({
  name: z.string()
    .trim()      // Transform FIRST - "   " becomes ""
    .min(1, "Name is required")  // Validate SECOND - "" fails
    .max(100, "Name must be 100 characters or less"),
  description: z.string()
    .max(500, "Description must be 500 characters or less")
    .optional()
});

app.post("/api/watchlists", requireAuth, csrfProtection, async (req, res) => {
  try {
    // Validate at route layer
    const data = createWatchListSchema.parse(req.body);
    const watchList = await storage.createWatchList(userId, data);
    sendSuccess(res, watchList, 201);
  } catch (error) {
    sendErrorFromException(res, error, 'CreateWatchList');
  }
});
```

#### Storage Layer (Business Rules Only)
```typescript
async createWatchList(userId: number, data: { name: string; description?: string }) {
  // Validate IDs only (defensive)
  this.validateUserId(userId);

  // Business rules that need database state
  const count = await this.db.select({ count: count() })...;
  if (count >= 20) {
    throw new Error('Maximum watch list limit reached (20 lists per user)');
  }

  // Data already validated by Zod - proceed
  return await this.db.insert(watchLists).values({
    userId,
    name: data.name,  // Already trimmed
    description: data.description || null,
  }).returning();
}
```

### Transform Order Matters!

```typescript
// WRONG - validates then transforms
name: z.string().min(1).trim()
// Input "   " -> min(1) sees length 3 -> PASSES -> trim() -> ""
// Result: Empty string saved to database!

// CORRECT - transforms then validates
name: z.string().trim().min(1)
// Input "   " -> trim() produces "" -> min(1) sees length 0 -> FAILS
// Result: Validation error returned to user
```

### Validation Location Reference

| Layer | Validates | Examples |
|-------|-----------|----------|
| **Route (Zod)** | Input format, types, lengths, required fields | `.trim().min(1).max(100)` |
| **Storage** | IDs are positive integers (defensive) | `validateUserId(userId)` |
| **Storage** | Business rules needing DB state | Max 20 lists, no duplicates |

### Detection Rule for Code Review

```bash
# Find validation that should be in routes
grep -rn "\.trim()\|\.length === 0\|name.length" server/storage*.ts

# Find Zod schemas with wrong transform order
grep -rn "min(1).*\.trim()\|min(.\+).*\.trim()" server/routes/
```

---

## CSRF Protection - SINGLE SOURCE OF TRUTH

**This is the CANONICAL section for CSRF protection patterns.**

Previously documented in 8+ files across the codebase. All other CSRF documentation should reference this section.

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
  csrfProtection,  // MANDATORY for all mutating operations
  requireAuth,
  async (req, res) => {
    await storage.updateNotificationPreferences(req.session.userId, req.body);
    res.json({ success: true });
  }
);

// DELETE endpoint with CSRF protection
app.delete('/api/watchlists/:id',
  csrfProtection,  // MANDATORY - protects against malicious deletions
  requireAuth,
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

### Client-Side CSRF Implementation

```typescript
// client/src/lib/queryClient.ts
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

---

## Rate Limiting & DDoS Protection

### Environment-Aware Rate Limiting

#### Problem Identified
Initial rate limiting configuration was too restrictive for development, causing legitimate requests to be blocked:
- **Issue**: 5 requests per 15 minutes for all `/api/auth/*` endpoints
- **Root Cause**: Rate limiter counts ALL auth requests, including `/api/auth/user` (authentication check)
- **Impact**: Frontend calls `/api/auth/user` on every page load, quickly exhausting the limit during development

#### Solution
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

## Session Management

### Secure Session Configuration

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

## Environment Variables & Secret Management

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

### Troubleshooting

#### Rate Limit Issues
**Symptoms**: "Too many requests" (429) errors
**Solutions**:
1. Clear Redis rate limit: `redis-cli DEL "ratelimit:127.0.0.1"`
2. Check rate limit constants in `server/utils/constants.ts`
3. Verify `NODE_ENV` is set correctly

#### CSRF Token Issues
**Symptoms**: "CSRF token missing" (403) errors
**Solutions**:
1. Verify client is including token in headers
2. Check session is active (cookies are being sent)
3. Clear browser cookies and restart session
4. Check `apiRequest` function is being used for all API calls

#### Session Issues
**Symptoms**: User logged out unexpectedly
**Solutions**:
1. Check Redis is running (production)
2. Verify `SESSION_SECRET` is set and consistent
3. Check cookie settings (secure flag, sameSite)
4. Verify session max age hasn't expired

---

## Dependency Security & Error Monitoring

### Dependency Vulnerability Management

#### NPM Audit Workflow

**Regular Security Scanning**:
```bash
# Run audit (moderate+ severity)
npm audit --audit-level=moderate

# Automated fix (when safe)
npm audit fix

# Force update with peer dependency conflicts
npm install --legacy-peer-deps
```

**Vulnerability Prioritization**:
- **P0 (Critical)**: Direct dependencies, high severity, actively exploited
- **P1 (High)**: Direct dependencies, moderate severity, public PoCs exist
- **P2 (Important)**: Transitive dependencies, moderate severity, or direct dependencies with low severity
- **P3 (Low)**: Low severity, difficult to exploit, limited impact

#### Handling Transitive Dependencies

When a vulnerability is in a transitive dependency (dependency of a dependency):

##### Option 1: npm Overrides (Recommended for Security Patches)
```json
// package.json
{
  "overrides": {
    "body-parser": "2.2.1"  // Force specific version
  },
  "_comments": {
    "overrides": "body-parser override forces 2.2.1 to fix GHSA-wqch-xfxh-vrr4. Remove when express updates naturally."
  }
}
```

**When to use overrides**:
- ✅ Security patches (patch version bumps: 2.2.0 → 2.2.1)
- ✅ Parent package hasn't updated yet
- ✅ Immediate mitigation needed
- ❌ Major version changes (breaking changes)
- ❌ When you can wait for parent package update

**Override best practices**:
1. Document WHY in `_comments` section
2. Include CVE/GHSA reference
3. Note date applied
4. Set reminder to remove when parent updates
5. Monitor parent package releases

##### Option 2: Wait for Parent Update
```bash
# Monitor for parent package updates
npm outdated express body-parser

# Check parent package release notes
# When parent updates, remove override and update parent
```

**When to wait**:
- Low severity vulnerability
- Parent package actively maintained
- No active exploits
- Can accept temporary risk

#### Version Documentation Pattern

**Always document security updates in package.json**:

```json
{
  "dependencies": {
    "@sentry/node": "^10.28.0",
    "@sentry/react": "^10.28.0"
  },
  "_comments": {
    "sentry-versions": "@sentry/node and @sentry/react updated to ^10.28.0 to fix GHSA-6465-jgvq-jhgp (sensitive headers leak when sendDefaultPii enabled). Patch applied 2025-12-02.",
    "overrides": "esbuild override forces ^0.27.0 to fix CVE GHSA-67mh-4wv8-2f99 (dev server vulnerability). Vite and drizzle-kit depend on older vulnerable versions."
  }
}
```

**Documentation checklist**:
- [ ] Include CVE/GHSA reference
- [ ] Note what vulnerability was fixed
- [ ] Record date applied
- [ ] Explain version constraint choice
- [ ] Document removal plan (for overrides)

---

### Sentry Error Monitoring Security

#### Configuration Security

**File**: `server/config/sentry.ts`

#### ❌ CRITICAL - Never Enable sendDefaultPii Without Review

```typescript
// ❌ DANGEROUS - Exposes sensitive headers
Sentry.init({
  sendDefaultPii: true,  // ⚠️ SECURITY RISK
  // This sends Authorization headers, Cookies, session tokens to Sentry!
});
```

**What sendDefaultPii exposes**:
- Authorization headers (Bearer tokens, API keys)
- Cookie headers (session IDs, auth cookies)
- User-Agent strings (fingerprinting data)
- Client IP addresses
- Custom headers (may contain secrets)

**Vulnerability context**:
- **GHSA-6465-jgvq-jhgp**: Sentry versions 10.11.0-10.26.0 leaked sensitive headers when `sendDefaultPii: true`
- **Fixed in**: 10.27.0+
- **Current version**: 10.28.0+
- **Defense-in-depth**: Keep disabled even with patched version

#### ✅ CORRECT - Document Security Decision

```typescript
// server/config/sentry.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: isProduction ? 0.1 : 1.0,

  // SECURITY: sendDefaultPii is intentionally NOT enabled to prevent exposure
  // of personally identifiable information (PII) in error reports. This includes
  // sensitive HTTP headers like Authorization, Cookie, and session tokens.
  //
  // Context: Sentry vulnerability GHSA-6465-jgvq-jhgp (fixed in 10.27.0+) leaked
  // sensitive headers when sendDefaultPii was true. Even though we're now on a
  // patched version, we maintain defense-in-depth by keeping this disabled.
  //
  // If PII collection becomes necessary for debugging:
  // 1. Ensure Sentry version >= 10.27.0 (current: 10.28.0+)
  // 2. Implement additional header filtering in beforeSend hook
  // 3. Document security review and approval
  // 4. Consider using Sentry's data scrubbing rules as additional layer
  //
  // sendDefaultPii: false, // (false by default, explicitly documented here)

  beforeSend(event, hint) {
    // Filter operational errors
    // Additional header filtering would go here if PII enabled
    return event;
  }
});
```

#### Header Filtering Pattern (If PII Ever Needed)

```typescript
// Advanced pattern: Selective PII with header filtering
Sentry.init({
  sendDefaultPii: true,  // Only if absolutely necessary!

  beforeSend(event, hint) {
    // Strip sensitive headers
    if (event.request?.headers) {
      const sensitiveHeaders = [
        'authorization',
        'cookie',
        'x-api-key',
        'x-auth-token',
        'x-session-id',
        'set-cookie'
      ];

      for (const header of sensitiveHeaders) {
        if (event.request.headers[header]) {
          event.request.headers[header] = '[REDACTED]';
        }
      }
    }

    return event;
  }
});
```

#### Sentry Security Checklist

- [ ] **Configuration Review**
  - [ ] `sendDefaultPii` is false (or explicitly filtered)
  - [ ] Sentry version >= 10.27.0 (GHSA-6465-jgvq-jhgp patched)
  - [ ] Security decision documented in comments
  - [ ] `beforeSend` hook filters sensitive data

- [ ] **Version Documentation**
  - [ ] package.json `_comments` documents security patch
  - [ ] CVE/GHSA reference included
  - [ ] Patch date recorded

- [ ] **Monitoring**
  - [ ] Error reports reviewed for data leaks
  - [ ] Sentry dashboard access restricted (RBAC)
  - [ ] Regular dependency updates scheduled

- [ ] **Development vs Production**
  - [ ] Development: More verbose logging acceptable
  - [ ] Production: Strict PII filtering enforced
  - [ ] Test Sentry in staging before production

#### Real-World Example: Sentry Headers Leak (2025-12-02)

**Scenario**: npm audit detected GHSA-6465-jgvq-jhgp in @sentry/node 10.26.0

**Response**:
1. **Assessed Impact**: Checked if `sendDefaultPii` enabled (it wasn't)
2. **Prioritized**: P2 (important but not actively exploitable)
3. **Updated**: `@sentry/node` 10.26.0 → 10.28.0
4. **Documented**: Added comments in package.json and sentry.ts
5. **Verified**: npm audit clean, TypeScript/ESLint pass
6. **Codified**: Added patterns to this document

**Lessons Learned**:
- ✅ Defense-in-depth: Patch even when not actively vulnerable
- ✅ Document decisions: Future developers need context
- ✅ Process matters: Systematic approach > ad-hoc fixes
- ✅ Codify learnings: Turn incidents into institutional knowledge

**Time to resolution**: < 30 minutes (assessment + fix + documentation)

---

## Security Checklist

### Pre-Deployment Security Audit

- [ ] **Authentication**
  - [ ] Passwords hashed with bcrypt (min 12 rounds)
  - [ ] Session secrets are cryptographically random
  - [ ] Account lockout after failed attempts
  - [ ] Password complexity requirements enforced (12+ chars, special characters)

- [ ] **Authorization**
  - [ ] All routes have appropriate auth checks
  - [ ] Admin routes protected with role checks
  - [ ] IDOR vulnerabilities checked

- [ ] **Input Validation**
  - [ ] All inputs validated with Zod schemas
  - [ ] File uploads restricted by type/size
  - [ ] Integer parsing uses safe helpers (`parseIntSafe`, `parseIntOptional`)

- [ ] **Output Security**
  - [ ] Password hashes never exposed
  - [ ] Errors sanitized in production
  - [ ] No console.log in production code

- [ ] **CSRF Protection**
  - [ ] CSRF tokens on state-changing requests
  - [ ] SameSite cookie attribute set
  - [ ] Auth endpoints have CSRF protection
  - [ ] No global CSRF middleware

- [ ] **Rate Limiting**
  - [ ] Auth endpoints rate limited
  - [ ] API endpoints rate limited
  - [ ] Password reset strictly limited
  - [ ] Environment-aware limits configured

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
- [API_PATTERNS.md](API_PATTERNS.md) - API security patterns
- [ERROR_HANDLING_PATTERNS.md](ERROR_HANDLING_PATTERNS.md) - Error handling patterns
- [Pre-commit Hook](.git/hooks/pre-commit) - Security checks
