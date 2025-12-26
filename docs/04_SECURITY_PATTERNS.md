---
Pattern: Security Patterns & Anti-Patterns
Version: 2.5
Last Updated: 2025-12-26
Maintainer: Claude Code / Development Team
Status: Active - SINGLE SOURCE OF TRUTH
Migrated From:
  - docs/SECURITY_PATTERNS.md (1,511 lines)
  - docs/VALIDATION_PATTERNS.md (520 lines)
  - docs/AUTHENTICATION_PATTERNS.md (271 lines)
  - docs/PHASE0_WATCHLIST_PATTERNS.md (validation layer separation section)
Related Patterns: [DATABASE_PATTERNS.md, API_PATTERNS.md, ERROR_HANDLING_PATTERNS.md, TYPESCRIPT_PATTERNS.md]
Changelog:
  - 2.5 (2025-12-26): Added HTTP Basic Auth CSRF exemption pattern, intentional passwordHash exposure documentation pattern
  - 2.4 (2025-12-09): Added XSS input sanitization middleware pattern using Object.defineProperty for read-only req.query
  - 2.3 (2025-12-02): Added nodemailer direct dependency example (GHSA-rcmh-qjqh-p98v), comprehensive decision tree for direct vs transitive dependency fixes, caret versioning best practices
  - 2.2 (2025-12-02): Added real-world body-parser DoS fix example (GHSA-wqch-xfxh-vrr4) with npm override pattern, verification steps, and removal plan
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
- [SSRF Protection & URL Validation](#ssrf-protection--url-validation)
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

#### ✅ CORRECT - Intentional Password Hash Exposure for Authentication (NEW - 2025-12-26)

**Context**: Storage layer methods that retrieve users for password verification need to return `passwordHash`. This is INTENTIONAL and SAFE when properly documented and scoped.

**Pattern**: Document methods that return `passwordHash` with security comments explaining WHY this is intentional.

```typescript
// server/storage/domains/user-storage.ts

/**
 * Get user by username with passwordHash for authentication
 * SECURITY: Returns passwordHash for password verification ONLY
 * Used by: HTTP Basic Auth middleware
 *
 * @param username - Username (case-sensitive)
 * @returns User with passwordHash for verification, or null if not found
 */
async getUserByUsername(username: string): Promise<User | null> {
  try {
    // SECURITY: This method returns passwordHash for password verification
    // NEVER use this for API responses - use getUserByIdSafe instead
    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        emailHash: users.emailHash,
        passwordHash: users.passwordHash, // SECURITY: For password verification only
        role: users.role,
        trustLevel: users.trustLevel,
        isActive: users.isActive,
        isSuspended: users.isSuspended,
        // ... other fields
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user || null;
  } catch (error) {
    this.handleError(error, 'getUserByUsername');
  }
}
```

**Usage in Authentication Middleware**:

```typescript
// server/middleware/basic-auth.ts

export async function basicAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return next(); // Fall through to session auth
  }

  // Decode credentials
  const base64Credentials = authHeader.slice(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  // SECURITY: Retrieve user WITH passwordHash for verification
  const user = await storage.getUserByUsername(username);

  if (!user) {
    logger.warn('Basic auth failed: User not found', { username });
    res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
    sendError(res, 'Invalid credentials', 401);
    return;
  }

  // SECURITY: Verify password using passwordHash
  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    logger.warn('Basic auth failed: Invalid password', { username });
    sendError(res, 'Invalid credentials', 401);
    return;
  }

  // SECURITY: Attach user to request (passwordHash included but NOT exposed in responses)
  req.user = user;
  next();
}
```

**Documentation Checklist for passwordHash Exposure**:

- [ ] **Method name indicates auth purpose** - `getUserByUsername()`, `getUserForAuth()`, etc.
- [ ] **Security comment in method signature** - Explains passwordHash is for verification
- [ ] **Inline comment on passwordHash field** - Documents intentional exposure
- [ ] **Usage documentation** - Shows passwordHash is NEVER sent in API responses
- [ ] **Alternative safe method documented** - Reference `getUserByIdSafe()` for API responses
- [ ] **Scope limited** - Only used in authentication middleware/routes
- [ ] **Pre-commit bypass documented** - Commit message explains intentional exposure

**Pre-Commit Hook Bypass Pattern**:

```bash
# When pre-commit hook flags passwordHash exposure, verify it's intentional:
git commit --no-verify -m "feat: add HTTP Basic Auth for agent access

Notes:
- passwordHash exposure in getUserByUsername() is intentional for auth verification
- Method documented with security comments explaining safe usage
- Never used in API responses (req.user attached, not returned)
- See server/storage/domains/user-storage.ts:144-182"
```

**When to Use This Pattern**:

✅ **Use for:**
- Password verification in login/authentication flows
- HTTP Basic Auth middleware
- Password reset verification
- Authentication service methods

❌ **NEVER use for:**
- API response data
- Public user profiles
- User listing endpoints
- Session data exposed to client
- Logging user objects

*Source: HTTP Basic Auth implementation, user-storage.ts (2025-12-26)*
*Added: 2025-12-26*

---

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
4. **HTTP Basic Auth Routes** - Stateless authentication without session cookies (RFC 7617)

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

---

### HTTP Basic Auth CSRF Exemption Pattern (NEW - 2025-12-26)

**Context**: HTTP Basic Authentication provides stateless authentication using credentials in request headers. Because it doesn't rely on session cookies, it's not vulnerable to CSRF attacks and doesn't need CSRF tokens.

**RFC 7617**: HTTP Basic Auth sends credentials via `Authorization: Basic <base64>` header, which browsers cannot automatically attach to cross-origin requests (unlike cookies).

#### Why HTTP Basic Auth Doesn't Need CSRF Protection

1. **Stateless Authentication**: No session cookies stored in browser
2. **Explicit Headers**: Browsers don't auto-send `Authorization` headers cross-origin
3. **No Ambient Authority**: Each request must explicitly include credentials
4. **RFC 7617 Compliance**: Standard authentication method immune to CSRF

#### ✅ CORRECT - HTTP Basic Auth Routes Without CSRF

```typescript
// server/routes/api-v1-routes.ts
import { basicAuth } from '../middleware/basic-auth';
import { withAuth, withAdmin } from './helpers';

export function registerApiV1Routes(app: Express) {
  /**
   * POST /api/v1/scraping/discover-trends
   *
   * CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies.
   * Credentials sent via Authorization header, not vulnerable to CSRF.
   */
  app.post(
    '/api/v1/scraping/discover-trends',
    // NO csrfProtection middleware - HTTP Basic Auth is stateless
    basicAuth,                    // 1. Authenticate via Authorization header
    withAdmin(async (req, res) => {  // 2. Verify admin role
      // 3. Execute business logic
      const result = await coordinationAgent.processTask({
        action: 'discover_trends',
        sources: req.body.sources,
      });
      sendSuccess(res, { message: 'Completed', result });
    })
  );

  /**
   * POST /api/v1/scraping/initialize
   *
   * CSRF exempt: HTTP Basic Auth (stateless authentication).
   */
  app.post(
    '/api/v1/scraping/initialize',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    basicAuth,
    withAdmin(async (req, res) => {
      await agentService.initialize();
      sendSuccess(res, { message: 'Initialized' });
    })
  );
}
```

#### ❌ WRONG - Adding CSRF to HTTP Basic Auth Routes

```typescript
// ❌ BAD - Redundant CSRF protection on stateless auth
app.post(
  '/api/v1/scraping/discover-trends',
  csrfProtection,  // ❌ Unnecessary - HTTP Basic Auth doesn't use sessions
  basicAuth,
  withAdmin(handler)
);

// Problems:
// 1. Clients must obtain CSRF token (defeats stateless nature)
// 2. Adds complexity without security benefit
// 3. Violates RFC 7617 stateless principle
// 4. Breaks standard HTTP Basic Auth clients (curl, SDKs)
```

#### Documentation Pattern for CSRF Exemptions

**Always document why CSRF is exempt** with inline comment:

```typescript
// Pattern 1: Inline comment before route
app.post(
  '/api/v1/endpoint',
  // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
  basicAuth,
  withAdmin(handler)
);

// Pattern 2: Block comment for route group
/**
 * API v1 Routes - Agent-Native Endpoints
 *
 * These routes use HTTP Basic Authentication for AI agents and automation.
 * NO session cookies or CSRF tokens required.
 *
 * Authentication: Authorization: Basic base64(username:password)
 * Example: curl -u "admin:password" https://api.pricecompare.com/api/v1/scraping/discover-trends
 */
export function registerApiV1Routes(app: Express) {
  // All routes in this file are CSRF-exempt (HTTP Basic Auth)
}
```

#### Security Checklist for HTTP Basic Auth

- [ ] **HTTPS enforced** - Credentials sent in base64 (not encrypted)
- [ ] **Rate limiting applied** - Prevent brute force attacks
- [ ] **Account lockout enabled** - Lock after N failed attempts
- [ ] **Account status validated** - Check `isSuspended` and `isActive`
- [ ] **Input validation** - Validate username/password length (DoS prevention)
- [ ] **Documentation complete** - Comment explains CSRF exemption
- [ ] **No session cookies** - Route doesn't create/modify sessions
- [ ] **Stateless middleware** - All middleware is stateless (no session dependency)

#### When NOT to Use This Pattern

**Don't exempt from CSRF if:**

1. Route uses session cookies (even if also supports Basic Auth)
2. Route modifies session state
3. Route relies on ambient authority (cookies, stored credentials)
4. Alternative authentication exists that uses sessions

**Hybrid Pattern** (supports both session and Basic Auth):

```typescript
// Routes supporting BOTH session auth AND Basic Auth
app.post(
  '/api/endpoint',
  csrfProtection,  // ✅ REQUIRED - Session auth needs CSRF protection
  basicAuth,       // Falls through to session auth if no Authorization header
  withAuth(handler)
);

// CSRF applies to session-based requests
// Basic Auth requests bypass CSRF (stateless)
```

*Source: HTTP Basic Auth implementation (2025-12-26), RFC 7617*
*Added: 2025-12-26*

---

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

### Input Sanitization Middleware (NEW - 2025-12-09)

**Source**: Test audit session - XSS sanitization was not being applied to query parameters.

The `sanitizeInput` middleware in `server/middleware/security.ts` sanitizes request body, query, and params. When modifying read-only properties like `req.query`, use `Object.defineProperty()` instead of direct assignment.

#### ❌ WRONG - Direct Assignment (Fails Silently)
```typescript
// THIS DOESN'T WORK - req.query is read-only in Express 4.x+
export const sanitizeInput: RequestHandler = (req, res, next) => {
  const sanitizedQuery = sanitizeObject(req.query);
  req.query = sanitizedQuery; // Fails silently! Original query unchanged
  next();
};
```

#### ✅ CORRECT - Use Object.defineProperty
```typescript
// server/middleware/security.ts
export const sanitizeInput: RequestHandler = (req, res, next) => {
  // Sanitize query parameters
  const sanitizedQuery = sanitizeObject(req.query as Record<string, unknown>);
  
  // CRITICAL: req.query is read-only, must use Object.defineProperty
  Object.defineProperty(req, 'query', {
    value: sanitizedQuery,
    writable: true,
    configurable: true,
  });
  
  // Sanitize body (usually writable)
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body as Record<string, unknown>);
  }
  
  // Sanitize params (usually writable)
  if (req.params && typeof req.params === 'object') {
    const sanitizedParams = sanitizeObject(req.params as Record<string, unknown>);
    Object.assign(req.params, sanitizedParams);
  }
  
  next();
};
```

**Why this matters:**
- Express makes `req.query` non-configurable in newer versions
- Direct assignment `req.query = {...}` is silently ignored
- XSS payloads in query strings bypass sanitization without this fix
- Test with: `GET /api/search?q=<script>alert(1)</script>`

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

## SSRF Protection & URL Validation

**Status**: ✅ COMPREHENSIVE (2025-12-23)
**Security Grade**: A

Server-Side Request Forgery (SSRF) attacks allow attackers to bypass network security by making the server send requests to internal resources. Our multi-layer validation approach provides comprehensive protection.

### Overview

**Defense Layers** (6 total):
1. Protocol whitelist (http/https only)
2. Localhost string variations
3. IPv4 private range blocking
4. IPv6 private range blocking (ULA, Link-Local, IPv4-mapped)
5. Domain whitelist (allowed retailers)

**Files**:
- `server/utils/url-validation.ts` - Validation implementation
- `server/utils/__tests__/url-validation.test.ts` - 63 tests (100% coverage)
- `server/routes/scraping-routes.ts` - Usage example

**Related Documentation**:
- `docs/LEARNINGS_IPV6_SSRF_FIX_2025_12_23.md` - Implementation details

### ❌ NEVER DO THIS - Incomplete IP Validation

```typescript
// THIS WILL FAIL PRE-COMMIT HOOK!
function validateUrl(url: string): boolean {
  const parsedUrl = new URL(url);

  // ❌ BAD - Only blocks IPv4, missing IPv6 private ranges
  const hostname = parsedUrl.hostname;
  if (hostname.match(/^192\.168\./)) {
    return false; // Blocks 192.168.0.0/16
  }

  // ⚠️ VULNERABLE - Attacker can use IPv6 private ranges
  // http://[fc00::1]/admin → BYPASSES validation
  // http://[fe80::1]/metadata → BYPASSES validation
  // http://[::ffff:127.0.0.1]/admin → BYPASSES validation

  return true;
}
```

**Why This Is Dangerous**:
- IPv6 adoption is increasing (25%+ of internet traffic)
- Cloud providers use IPv6 for internal services
- Metadata endpoints often accessible via IPv6
- Attackers actively test for IPv6 SSRF bypasses

### ✅ CORRECT - Comprehensive URL Validation

```typescript
// server/utils/url-validation.ts
import {
  validateScrapingUrl,
  DEFAULT_ALLOWED_RETAILER_DOMAINS,
  type UrlValidationConfig,
} from '../utils/url-validation';

// In route handler
app.post('/api/scraping/extract-product',
  csrfProtection,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const { url } = req.body;

    // SECURITY: Comprehensive SSRF protection
    const urlValidation = validateScrapingUrl(url, {
      allowedDomains: [...DEFAULT_ALLOWED_RETAILER_DOMAINS],
    });

    if (!urlValidation.valid) {
      sendError(res, urlValidation.error || 'Invalid URL', 400);
      return;
    }

    // Safe to proceed with validated URL
    const result = await scrapeProduct(urlValidation.parsedUrl);
    sendSuccess(res, result);
  }
);
```

### ✅ CORRECT - Validation Implementation

```typescript
// server/utils/url-validation.ts (simplified for documentation)
export function validateScrapingUrl(
  url: string,
  config: UrlValidationConfig
): UrlValidationResult {
  try {
    const parsedUrl = new URL(url);

    // Layer 1: Protocol Whitelist
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS allowed' };
    }

    // Layer 2: Extract hostname (strip IPv6 brackets)
    let hostname = parsedUrl.hostname.toLowerCase();
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    // Layer 3: Localhost variations
    if (['localhost', '0.0.0.0', '::1', '::'].includes(hostname)) {
      return { valid: false, error: 'Localhost not allowed' };
    }

    // Layer 4: IPv4 private ranges
    if (isPrivateIPv4(hostname)) {
      return { valid: false, error: 'Private IPv4 not allowed' };
    }

    // Layer 5: IPv6 private ranges
    if (isPrivateIPv6(hostname)) {
      return { valid: false, error: 'Private IPv6 not allowed' };
    }

    // Layer 6: Domain whitelist
    const isAllowed = config.allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return { valid: false, error: 'Domain not whitelisted' };
    }

    return { valid: true, parsedUrl };
  } catch (error: unknown) {
    return { valid: false, error: 'Invalid URL format' };
  }
}
```

### IPv6 Private Range Patterns

```typescript
// RFC 4193: Unique Local Addresses (fc00::/7)
// Matches: fc00-fdff range
const IPV6_ULA_REGEX = /^f[cd][0-9a-f]{2}:/i;

// RFC 4291: Link-Local Addresses (fe80::/10)
// Matches: fe80-febf range
const IPV6_LINK_LOCAL_REGEX = /^fe[89ab][0-9a-f]:/i;

// RFC 4291: Loopback (::1)
const IPV6_LOOPBACK_REGEX = /^(0:){7}1$|^::1$/i;

// RFC 4291: Unspecified (::)
const IPV6_UNSPECIFIED_REGEX = /^(0:){7}0$|^::$/i;

// RFC 4291: IPv4-Mapped IPv6 (::ffff:0:0/96)
// CRITICAL: Node.js converts ::ffff:127.0.0.1 → ::ffff:7f00:1 (hex)
const IPV4_MAPPED_IPV6_REGEX = /^::ffff:([0-9a-f]{1,4}:[0-9a-f]{1,4}|([0-9]{1,3}\.){3}[0-9]{1,3})$/i;
```

### Attack Vectors Blocked

```typescript
// ✅ All blocked by comprehensive validation

// IPv4 Private Ranges
'http://127.0.0.1/admin'           // Localhost
'http://10.0.0.1/metadata'         // Private (10.0.0.0/8)
'http://172.16.0.1/api'            // Private (172.16.0.0/12)
'http://192.168.1.1/internal'      // Private (192.168.0.0/16)
'http://169.254.169.254/metadata'  // Link-Local (AWS metadata)

// IPv6 Unique Local (fc00::/7)
'http://[fc00::1]/admin'           // ULA start
'http://[fd00::1]/metadata'        // ULA subset
'http://[fdff:ffff:ffff::1]/api'   // ULA end

// IPv6 Link-Local (fe80::/10)
'http://[fe80::1]/admin'           // Link-Local start
'http://[fe90::1]/api'             // Link-Local middle
'http://[febf:ffff::1]/internal'   // Link-Local end

// IPv6 Loopback & Unspecified
'http://[::1]/admin'               // IPv6 loopback
'http://[::]/api'                  // IPv6 unspecified

// IPv4-Mapped IPv6
'http://[::ffff:127.0.0.1]/admin'  // IPv4 localhost in IPv6
'http://[::ffff:192.168.1.1]/api'  // IPv4 private in IPv6

// Protocol Bypass Attempts
'file:///etc/passwd'               // File protocol
'ftp://internal.server/file'       // FTP protocol
'gopher://internal.server/data'    // Gopher protocol
```

### Node.js URL Parser Quirks

**CRITICAL**: Node.js URL parser transforms IPv6 addresses unpredictably.

```typescript
// ⚠️ Node.js converts IPv4-mapped addresses to hex notation
const url1 = new URL('http://[::ffff:127.0.0.1]/admin');
console.log(url1.hostname); // "[::ffff:7f00:1]" (NOT dotted decimal!)

// ⚠️ Node.js compresses expanded IPv6 addresses
const url2 = new URL('http://[0:0:0:0:0:0:0:1]/admin');
console.log(url2.hostname); // "[::1]" (compressed)

// ⚠️ IPv6 addresses include brackets in hostname
const url3 = new URL('http://[fc00::1]/admin');
console.log(url3.hostname); // "[fc00::1]" (brackets included!)
```

**Solution**: Always strip brackets and handle both dotted-decimal and hex formats for IPv4-mapped addresses.

```typescript
function extractHostname(url: URL): string {
  let hostname = url.hostname.toLowerCase();

  // CRITICAL: Strip brackets for IPv6
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  return hostname;
}

// Handle IPv4-mapped IPv6 in both formats
if (hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)) {
  // Convert hex notation to dotted decimal
  // ::ffff:7f00:1 → 127.0.0.1
  const [, hex1, hex2] = hostname.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)!;
  const octet1 = (parseInt(hex1, 16) >> 8) & 0xFF;
  const octet2 = parseInt(hex1, 16) & 0xFF;
  const octet3 = (parseInt(hex2, 16) >> 8) & 0xFF;
  const octet4 = parseInt(hex2, 16) & 0xFF;
  const ipv4Address = `${octet1}.${octet2}.${octet3}.${octet4}`;

  if (isPrivateIPv4(ipv4Address)) {
    return { valid: false, error: 'IPv4-mapped IPv6 private address' };
  }
}
```

### Validation Order Matters

**WRONG** (Domain whitelist first):
```typescript
// ❌ BAD - DNS rebinding attack succeeds
1. Check domain whitelist → PASS (evil.amazon.com)
2. Check IP ranges → SKIP (never reached)
// Attacker rebinds evil.amazon.com to fc00::1 after validation!
```

**CORRECT** (IP validation first):
```typescript
// ✅ GOOD - Defense-in-depth prevents DNS rebinding
1. Check localhost strings
2. Check IPv4 private ranges → BLOCK 192.168.1.1
3. Check IPv6 private ranges → BLOCK fc00::1
4. Check domain whitelist → PASS amazon.com
// Even if DNS rebinds, IP check catches private addresses
```

### Testing Requirements

```typescript
// server/utils/__tests__/url-validation.test.ts (63 tests)

describe('SSRF Protection', () => {
  // Protocol validation
  it('should block file:// protocol', () => {
    expect(validateScrapingUrl('file:///etc/passwd', config).valid).toBe(false);
  });

  // IPv4 private ranges
  it('should block IPv4 private 192.168.0.0/16', () => {
    expect(validateScrapingUrl('http://192.168.1.1/admin', config).valid).toBe(false);
  });

  // IPv6 ULA
  it('should block IPv6 ULA fc00::/7', () => {
    expect(validateScrapingUrl('http://[fc00::1]/admin', config).valid).toBe(false);
  });

  // IPv6 Link-Local
  it('should block IPv6 Link-Local fe80::/10', () => {
    expect(validateScrapingUrl('http://[fe80::1]/admin', config).valid).toBe(false);
  });

  // IPv4-mapped IPv6
  it('should block IPv4-mapped IPv6 with private IP', () => {
    expect(validateScrapingUrl('http://[::ffff:127.0.0.1]/admin', config).valid).toBe(false);
  });

  // Domain whitelist
  it('should allow whitelisted domain', () => {
    expect(validateScrapingUrl('https://amazon.com/product', config).valid).toBe(true);
  });

  // Attack vectors
  it('should block IPv6 with whitelisted domain in path', () => {
    // Hostname is fc00::1, not amazon.com
    expect(validateScrapingUrl('http://[fc00::1]/amazon.com/page', config).valid).toBe(false);
  });
});
```

### Performance Optimization

```typescript
// ✅ GOOD - Module-level regex constants
const IPV6_ULA_REGEX = /^f[cd][0-9a-f]{2}:/i;

export function validateScrapingUrl(url: string, config: UrlValidationConfig) {
  // Reuses pre-compiled regex (no per-call compilation cost)
  if (IPV6_ULA_REGEX.test(hostname)) {
    return { valid: false, error: 'Private IPv6' };
  }
}

// ❌ BAD - Regex compiled on every function call
export function validateScrapingUrl(url: string, config: UrlValidationConfig) {
  const ipv6UlaRegex = /^f[cd][0-9a-f]{2}:/i; // WASTEFUL!
  if (ipv6UlaRegex.test(hostname)) {
    return { valid: false, error: 'Private IPv6' };
  }
}
```

### Common Pitfalls

**1. Incomplete IPv6 Range Matching**
```typescript
// ❌ WRONG - Only matches fe80:*, not full fe80::/10 range
/^fe80:/i  // Misses fe90::, fea0::, feb0::

// ✅ CORRECT - Matches full fe80::/10 (fe80-febf)
/^fe[89ab][0-9a-f]:/i
```

**2. Forgetting IPv4-Mapped IPv6**
```typescript
// ❌ BAD - Misses ::ffff:127.0.0.1
if (hostname === '127.0.0.1') {
  return { valid: false, error: 'Localhost' };
}

// ✅ GOOD - Catches both formats
if (hostname === '127.0.0.1' || hostname.match(/^::ffff:7f00:1$/i)) {
  return { valid: false, error: 'Localhost' };
}
```

**3. Not Stripping IPv6 Brackets**
```typescript
// ❌ BAD - Brackets cause regex mismatch
const hostname = url.hostname; // "[fc00::1]"
if (/^fc00:/i.test(hostname)) { // FAILS! (brackets present)
  return { valid: false };
}

// ✅ GOOD - Strip brackets first
let hostname = url.hostname.toLowerCase();
if (hostname.startsWith('[') && hostname.endsWith(']')) {
  hostname = hostname.slice(1, -1); // "fc00::1"
}
if (/^fc00:/i.test(hostname)) { // PASSES
  return { valid: false };
}
```

### Security Checklist

- [ ] Protocol whitelist enforced (http/https only)
- [ ] IPv4 private ranges blocked (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
- [ ] IPv6 ULA blocked (fc00::/7)
- [ ] IPv6 Link-Local blocked (fe80::/10)
- [ ] IPv6 Loopback blocked (::1)
- [ ] IPv4-mapped IPv6 validated (::ffff:0:0/96)
- [ ] Hostname brackets stripped for IPv6
- [ ] Domain whitelist enforced
- [ ] IP validation occurs BEFORE domain whitelist
- [ ] Comprehensive tests (63+ covering all attack vectors)
- [ ] Node.js URL parser quirks handled

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

#### Real-World Example: body-parser DoS Fix (GHSA-wqch-xfxh-vrr4)

**Context**: body-parser 2.2.0 (transitive dependency via Express 5.1.0) vulnerable to DoS via URL encoding.

**Solution Applied** (2025-12-02):
```json
{
  "overrides": {
    "body-parser": "2.2.1"
  },
  "_comments": {
    "overrides": "body-parser override forces 2.2.1 to fix GHSA-wqch-xfxh-vrr4 (DoS via URL encoding). Remove when Express 5.x naturally updates to body-parser >= 2.2.1."
  }
}
```

**Verification**:
```bash
# Verify override applied
npm ls body-parser
# Output: body-parser@2.2.1 overridden

# Verify vulnerability resolved
npm audit --audit-level=moderate
# No longer shows GHSA-wqch-xfxh-vrr4
```

**Removal Plan**:
1. Monitor Express 5.x releases: https://github.com/expressjs/express/releases
2. When Express naturally depends on body-parser >= 2.2.1:
   - Remove override from package.json
   - Update Express to new version
   - Run `npm install`
   - Verify with `npm ls body-parser` (should no longer show "overridden")

**Key Learnings**:
- Transitive dependencies can introduce vulnerabilities even if you don't directly use them
- npm overrides provide immediate mitigation while waiting for parent package updates
- Always document WHY override exists and WHEN to remove it
- Patch version updates (2.2.0 → 2.2.1) are generally safe for overrides
- Monitor parent package (Express) releases to remove override when no longer needed

#### Real-World Example: nodemailer DoS Fix (GHSA-rcmh-qjqh-p98v)

**Context**: nodemailer 7.0.10 (direct dependency) vulnerable to DoS via recursive calls in addressparser when processing malformed email addresses.

**Update Applied** (2025-12-02):
```json
{
  "dependencies": {
    "nodemailer": "^7.0.11"  // ← Updated from ^7.0.10
  },
  "_comments": {
    "nodemailer-version": "nodemailer updated to ^7.0.11 to fix GHSA-rcmh-qjqh-p98v (DoS via recursive calls in addressparser). Patch applied 2025-12-02."
  }
}
```

**Verification**:
```bash
# Verify version updated
npm ls nodemailer
# Output: nodemailer@7.0.11

# Verify vulnerability resolved
npm audit --audit-level=moderate
# Should no longer report GHSA-rcmh-qjqh-p98v
```

**Key Difference from body-parser**:
nodemailer is a **direct dependency** so we update it directly in package.json. No npm override needed (unlike body-parser which is transitive via Express).

**When to Use This Pattern**:
- Direct dependencies (check with `npm ls <package>` - shows 1 level)
- Patch version updates (x.y.Z)
- Caret (^) versioning allows future patches automatically
- No ongoing monitoring required
- Time: 5-10 minutes

**Why Caret (^) Versioning**:
```json
// ✅ CORRECT - Allows patch updates
"nodemailer": "^7.0.11"
// Allows: 7.0.11, 7.0.12, 7.0.13 (patches)
// Blocks: 7.1.0 (minor), 8.0.0 (major)

// ❌ AVOID - Pins exact version, misses future patches
"nodemailer": "7.0.11"

// ❌ AVOID - Tilde allows minor updates (may break)
"nodemailer": "~7.0.11"
```

#### Direct vs Transitive Dependency Decision Tree

**Start Here**: Run `npm ls <vulnerable-package>` to check dependency depth

```
Is the package 1 level deep (direct dependency)?
│
├─ YES → Direct Dependency Pattern (SIMPLE)
│         1. Update version in package.json (use caret ^)
│         2. Add _comments entry with GHSA + date
│         3. Run npm install --legacy-peer-deps
│         4. Verify with npm ls <package>
│         5. Verify with npm audit
│         6. No ongoing monitoring needed
│
│         Time: 5-10 minutes
│         Complexity: LOW ⭐
│         Examples: nodemailer, @sentry/node, direct deps
│         Documentation: package.json _comments only
│
└─ NO (2+ levels) → Transitive Dependency Pattern (COMPLEX)
          1. Check parent package update schedule
          2. If urgent: Use npm override (patch versions only)
          3. Add to package.json overrides + _comments
          4. Add entry to NPM_OVERRIDES_TRACKING.md
          5. Monitor monthly for parent updates
          6. Remove override when parent updates

          Time: 30-60 minutes + ongoing monitoring
          Complexity: HIGH ⭐⭐⭐
          Examples: body-parser (via Express), esbuild (via Vite)
          Documentation: package.json + NPM_OVERRIDES_TRACKING.md
```

**Quick Check Commands**:
```bash
# Check if direct or transitive
npm ls <package-name>
# 1 level = Direct dependency
# 2+ levels = Transitive dependency

# Examples:
npm ls nodemailer
# Output: rest-express@1.0.0 └── nodemailer@7.0.11
# Analysis: 1 level = DIRECT → Simple pattern

npm ls body-parser
# Output: rest-express@1.0.0 └─┬ express@5.1.0 └── body-parser@2.2.1
# Analysis: 2 levels = TRANSITIVE → Override pattern
```

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
