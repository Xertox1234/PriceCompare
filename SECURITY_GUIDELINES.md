# Security Coding Guidelines

**Last Updated:** 2025-11-11  
**Status:** Mandatory for all code contributions

---

## 🎯 Purpose

This document codifies security patterns and best practices to prevent recurring security vulnerabilities. All developers must follow these guidelines.

---

## 🔴 Critical Rules (MUST Follow)

### 1. Never Expose Password Hashes

**❌ WRONG:**
```typescript
author: {
  id: users.id,
  username: users.username,
  passwordHash: users.passwordHash,  // NEVER DO THIS
}
```

**✅ CORRECT:**
```typescript
author: {
  id: users.id,
  username: users.username,
  // SECURITY: Never expose password hashes
}
```

**Automated Check:** Fails if `passwordHash:` appears in SELECT queries without a SECURITY comment.

---

### 2. Always Use Type-Safe Session Access

**❌ WRONG:**
```typescript
const userId = (req.session as any)?.userId;
```

**✅ CORRECT:**
```typescript
// Use properly typed session (defined in server/types/express-session.d.ts)
const userId = req.session.userId;
```

**Automated Check:** Fails if `as any` appears without justification comment.

---

### 3. Validate All Integer Parsing

**❌ WRONG:**
```typescript
const id = parseInt(req.params.id);
const topicId = parseInt(req.params.topicId);
```

**✅ CORRECT:**
```typescript
import { parseIntSafe, parseIntOptional } from './utils/validation-helpers';

const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
const categoryId = parseIntOptional(req.query.categoryId, 'categoryId', { min: 1 });
```

**Automated Check:** Warns on `parseInt(` without `parseIntSafe`/`parseIntOptional`.

---

### 4. Sanitize Error Messages in Production

**❌ WRONG:**
```typescript
catch (error) {
  res.status(500).json({ 
    error: error.message  // Leaks implementation details
  });
}
```

**✅ CORRECT:**
```typescript
import { createErrorResponse } from './utils/error-sanitizer';

catch (error) {
  console.error('Operation failed:', error);  // Log full error
  const errorResponse = createErrorResponse(error, 'Operation');
  res.status(errorResponse.status).json({
    error: errorResponse.error,
    details: errorResponse.details  // Only in development
  });
}
```

**Automated Check:** Warns on direct `error.message` usage without sanitization.

---

### 5. Validate All Query Parameters

**❌ WRONG:**
```typescript
app.get("/api/products", async (req, res) => {
  const status = req.query.status as string;  // No validation
});
```

**✅ CORRECT:**
```typescript
import { validateRequest } from './validation';
import { productQuerySchema } from './validation/admin-schemas';

app.get("/api/products",
  validateRequest(productQuerySchema, 'query'),
  async (req, res) => {
    const { status } = req.query;  // Validated by middleware
  }
);
```

**Automated Check:** Warns on endpoints accessing `req.query` without `validateRequest`.

---

### 6. Always Use requireAuth/requireAdmin Middleware

**❌ WRONG:**
```typescript
app.get("/api/admin/stats", async (req, res) => {
  if (req.user?.role !== 'admin') {  // Manual check
    return res.status(403).json({ error: 'Forbidden' });
  }
});
```

**✅ CORRECT:**
```typescript
import { requireAuth, requireAdmin } from './auth';

app.get("/api/admin/stats", 
  requireAuth, 
  requireAdmin,  // Use middleware
  async (req, res) => {
    // User is guaranteed to be admin here
  }
);
```

**Automated Check:** Warns on `/api/admin/` routes without `requireAdmin`.

---

### 7. Verify Webhook Signatures

**❌ WRONG:**
```typescript
app.post("/webhooks/github", async (req, res) => {
  const { event_type, data } = req.body;  // No verification
  // Process webhook...
});
```

**✅ CORRECT:**
```typescript
app.post("/webhooks/github", async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }
  // Process webhook...
});
```

**Automated Check:** Warns on webhook endpoints without signature verification.

---

### 8. Generate Unique Slugs with Collision Detection

**❌ WRONG:**
```typescript
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
await db.insert(topics).values({ title, slug });  // May collide
```

**✅ CORRECT:**
```typescript
let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Check for collisions
const existing = await db.select().from(topics).where(eq(topics.slug, slug)).limit(1);
if (existing.length > 0) {
  const crypto = await import('crypto');
  slug = `${slug}-${crypto.randomBytes(4).toString('hex')}`;
}

await db.insert(topics).values({ title, slug });
```

---

### 9. Implement Resource Limits

**❌ WRONG:**
```typescript
const rateLimitStore = {};  // Unbounded growth

app.use((req, res, next) => {
  rateLimitStore[req.ip] = { count: 1, resetTime: Date.now() + 60000 };
  next();
});
```

**✅ CORRECT:**
```typescript
const MAX_ENTRIES = 10000;
const rateLimitStore = {};

// Implement LRU eviction
if (Object.keys(rateLimitStore).length > MAX_ENTRIES) {
  // Evict oldest entries
}
```

---

## 🟠 Important Patterns

### Input Validation Schema Pattern

Always define Zod schemas for route inputs:

```typescript
// Define schema
export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive().max(1000000),
  categoryId: z.number().int().positive(),
});

// Apply to route
app.post("/api/products",
  validateRequest(createProductSchema, 'body'),
  async (req, res) => {
    const { name, price, categoryId } = req.body;  // Validated
  }
);
```

### Safe Database Query Pattern

```typescript
// SECURITY: Drizzle parameterizes queries - always use parameters
const products = await db.select()
  .from(products)
  .where(eq(products.category, userInput))  // ✅ Safe - parameterized
  .limit(limit);

// Never use string concatenation
// const query = `SELECT * FROM products WHERE category = '${userInput}'`;  // ❌ SQL injection
```

### Rate Limiting Pattern

```typescript
import { rateLimiter } from './middleware/security';

app.post("/api/sensitive-operation",
  rateLimiter({ windowMs: 60000, maxRequests: 10 }),
  async (req, res) => {
    // Protected by rate limiting
  }
);
```

---

## 🧪 Testing Requirements

### Security Tests to Write

1. **Authentication Tests**
   ```typescript
   test('admin endpoint rejects non-admin users', async () => {
     const response = await request(app)
       .get('/api/admin/stats')
       .set('Cookie', regularUserCookie);
     expect(response.status).toBe(403);
   });
   ```

2. **Input Validation Tests**
   ```typescript
   test('rejects invalid integer IDs', async () => {
     const response = await request(app).get('/api/products/NaN');
     expect(response.status).toBe(400);
     expect(response.body.error).toContain('must be a valid integer');
   });
   ```

3. **Rate Limiting Tests**
   ```typescript
   test('rate limiting blocks excessive requests', async () => {
     for (let i = 0; i < 100; i++) {
       await request(app).get('/api/products');
     }
     const response = await request(app).get('/api/products');
     expect(response.status).toBe(429);
   });
   ```

---

## 📋 Pre-Commit Checklist

Before committing code, verify:

- [ ] No `as any` type casts without justification
- [ ] No `parseInt()` without `parseIntSafe`
- [ ] No password hashes in API responses
- [ ] All error messages sanitized for production
- [ ] All query parameters validated with Zod schemas
- [ ] All admin endpoints use `requireAdmin` middleware
- [ ] All webhook endpoints verify signatures
- [ ] Resource limits implemented for in-memory stores
- [ ] TypeScript strict mode passes
- [ ] Security tests written and passing

Run automated checks:
```bash
npm run security:check
```

---

## 🔧 Tools & Configuration

### Required npm Scripts

```json
{
  "scripts": {
    "security:check": "bash scripts/security-checks.sh",
    "security:audit": "npm audit --audit-level=moderate",
    "security:scan": "bash scripts/security-scan.sh"
  }
}
```

### Required Dev Dependencies

```bash
npm install --save-dev eslint-plugin-security @typescript-eslint/eslint-plugin
```

### TypeScript Configuration

Enable strict mode in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

## 🚨 Code Review Requirements

Reviewers MUST check:

1. **Authentication** - All sensitive endpoints protected
2. **Input Validation** - All user inputs validated with Zod
3. **Type Safety** - No `any` types without justification
4. **Error Handling** - Errors sanitized in production
5. **Resource Limits** - No unbounded growth in memory structures
6. **SQL Safety** - All queries use parameterized statements
7. **Webhook Security** - All webhooks verify signatures

---

## 📚 Reference Documentation

- **Validation Helpers:** `server/utils/validation-helpers.ts`
- **Error Sanitization:** `server/utils/error-sanitizer.ts`
- **Session Types:** `server/types/express-session.d.ts`
- **Validation Schemas:** `server/validation/admin-schemas.ts`
- **Security Audit Report:** `SECURITY_AUDIT_REPORT.md`

---

## 🆘 Getting Help

If you're unsure about a security pattern:

1. Check this document first
2. Review existing code in `server/` for examples
3. Run `npm run security:check` to identify issues
4. Consult the Security Audit Report for context

---

## ✅ Quick Reference Card

| Issue | Solution | Import |
|-------|----------|--------|
| Integer parsing | `parseIntSafe()` | `utils/validation-helpers` |
| Error messages | `createErrorResponse()` | `utils/error-sanitizer` |
| Session access | `req.session.userId` | `types/express-session.d.ts` |
| Query validation | `validateRequest(schema, 'query')` | `validation` |
| Admin routes | `requireAuth, requireAdmin` | `auth` |
| Rate limiting | `rateLimiter({ windowMs, maxRequests })` | `middleware/security` |

---

**Remember: Security is not optional. These patterns exist because real vulnerabilities were found and fixed. Don't reintroduce them!**
