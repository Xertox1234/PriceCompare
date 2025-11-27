---
Guide: Testing Security Patterns
Version: 1.0
Last Updated: 2025-11-26
Maintainer: Claude Code / Development Team
Status: Active
For: test-engineer + security-auditor collaboration
Related Patterns: [SECURITY_PATTERNS.md, ERROR_HANDLING_PATTERNS.md, API_PATTERNS.md]
---

# Testing Security Patterns

**Collaborative Guide for test-engineer and security-auditor subagents**

This guide provides comprehensive testing patterns for security concerns, enabling test-engineer and security-auditor to collaborate effectively on security validation.

## Table of Contents

1. [Security Test Checklist](#security-test-checklist)
2. [Test Patterns by Security Concern](#test-patterns-by-security-concern)
3. [Testing Framework Integration](#testing-framework-integration)
4. [Security Test Examples](#security-test-examples)

---

## Security Test Checklist

Use this checklist when testing security-critical features:

### Authentication & Authorization
- [ ] Password hash never exposed in any API response
- [ ] Login rate limiting prevents brute force attacks
- [ ] Session tokens properly validated
- [ ] CSRF tokens required for state-changing operations
- [ ] Unauthorized access returns 401/403 with sanitized errors
- [ ] Admin-only routes reject non-admin users

### Input Validation
- [ ] SQL injection attempts rejected
- [ ] XSS payloads sanitized
- [ ] Path traversal attempts blocked
- [ ] Integer overflow handled gracefully
- [ ] Malformed JSON returns 400 with helpful error
- [ ] Large payloads rejected (size limits enforced)

### Error Handling
- [ ] Error messages sanitized in production mode
- [ ] Stack traces never exposed to clients
- [ ] Sensitive data not logged
- [ ] Error responses don't reveal system internals
- [ ] Validation errors provide helpful messages without leaking data

### Data Protection
- [ ] Password fields use bcrypt with proper rounds
- [ ] Sensitive fields excluded from SELECT queries
- [ ] API responses don't leak internal IDs
- [ ] File uploads validated for type and size
- [ ] User data properly scoped (can't access other users' data)

---

## Test Patterns by Security Concern

### Pattern 1: Password Hash Exposure Testing

**What to Test**: Ensure `passwordHash` field never appears in API responses.

```typescript
// ✅ CORRECT - Test password hash is never exposed
describe('User API Security', () => {
  it('should never expose passwordHash in user profile endpoint', async () => {
    const response = await request(app)
      .get('/api/user/profile')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('should never expose passwordHash in search results', async () => {
    const response = await request(app)
      .get('/api/admin/users?search=test')
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    response.body.users.forEach((user: any) => {
      expect(user).not.toHaveProperty('passwordHash');
    });
  });
});
```

### Pattern 2: CSRF Protection Testing

**What to Test**: State-changing operations require valid CSRF tokens.

```typescript
// ✅ CORRECT - Test CSRF protection
describe('CSRF Protection', () => {
  it('should reject POST without CSRF token', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .send({ name: 'Test Product' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('CSRF');
  });

  it('should accept POST with valid CSRF token', async () => {
    const csrfToken = extractCsrfToken(sessionCookie);

    const response = await request(app)
      .post('/api/products')
      .set('Cookie', sessionCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Test Product' });

    expect(response.status).toBe(201);
  });
});
```

### Pattern 3: Input Validation Testing

**What to Test**: Malicious inputs are rejected with appropriate errors.

```typescript
// ✅ CORRECT - Test input validation
describe('Input Validation Security', () => {
  it('should reject SQL injection attempts', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    const response = await request(app)
      .get(`/api/products/search?q=${encodeURIComponent(maliciousInput)}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid');
    // Verify database still intact
    const users = await db.select().from(users);
    expect(users.length).toBeGreaterThan(0);
  });

  it('should sanitize XSS payloads', async () => {
    const xssPayload = '<script>alert("XSS")</script>';

    const response = await request(app)
      .post('/api/comments')
      .set('Cookie', sessionCookie)
      .send({ content: xssPayload });

    expect(response.status).toBe(201);
    expect(response.body.content).not.toContain('<script>');
  });
});
```

### Pattern 4: Authorization Testing

**What to Test**: Users can only access their own data, admins have elevated access.

```typescript
// ✅ CORRECT - Test authorization boundaries
describe('Authorization', () => {
  let user1Cookie: string;
  let user2Cookie: string;
  let adminCookie: string;

  beforeEach(async () => {
    user1Cookie = await loginAsUser('user1@example.com');
    user2Cookie = await loginAsUser('user2@example.com');
    adminCookie = await loginAsAdmin('admin@example.com');
  });

  it('should prevent users from accessing other users\' data', async () => {
    const user1Id = await getUserId(user1Cookie);
    const user2Id = await getUserId(user2Cookie);

    const response = await request(app)
      .get(`/api/users/${user2Id}/watchlists`)
      .set('Cookie', user1Cookie);

    expect(response.status).toBe(403);
  });

  it('should allow admins to access all user data', async () => {
    const user1Id = await getUserId(user1Cookie);

    const response = await request(app)
      .get(`/api/admin/users/${user1Id}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
  });
});
```

### Pattern 5: Rate Limiting Testing

**What to Test**: Rate limits prevent abuse without affecting normal usage.

```typescript
// ✅ CORRECT - Test rate limiting
describe('Rate Limiting', () => {
  it('should allow normal usage within rate limits', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .get('/api/products/search?q=test')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
    }
  });

  it('should block excessive requests', async () => {
    // Exceed rate limit
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(
        request(app)
          .get('/api/products/search?q=test')
          .set('Cookie', sessionCookie)
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
    expect(rateLimited[0].body.error).toContain('Rate limit');
  });
});
```

---

## Testing Framework Integration

### Vitest Configuration for Security Tests

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/security-setup.ts'],
    // Run security tests in isolation
    testMatch: ['**/*.security.test.ts'],
  },
});
```

### Security Test Setup

```typescript
// tests/security-setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { db } from '../server/db';

beforeAll(async () => {
  // Setup test database with security-relevant data
  await seedSecurityTestData();
});

afterEach(async () => {
  // Clean up any test data
  await cleanupTestData();
});

afterAll(async () => {
  // Close connections
  await db.$pool.end();
});
```

---

## Security Test Examples

### Example 1: Complete User Registration Security Test

```typescript
describe('User Registration Security', () => {
  it('should hash passwords before storage', async () => {
    const password = 'TestPassword123!';

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password,
        username: 'testuser'
      });

    expect(response.status).toBe(201);

    // Verify password is hashed in database
    const user = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, 'test@example.com'));

    expect(user[0].passwordHash).not.toBe(password);
    expect(user[0].passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt format
  });

  it('should enforce password strength requirements', async () => {
    const weakPasswords = [
      '123456',
      'password',
      'abc',
      'test'
    ];

    for (const password of weakPasswords) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `test${password}@example.com`,
          password,
          username: 'testuser'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    }
  });
});
```

### Example 2: API Endpoint Security Audit

```typescript
describe('API Security Audit', () => {
  const securityChecks = [
    {
      name: 'User Profile',
      endpoint: '/api/user/profile',
      method: 'GET',
      requiresAuth: true,
      requiresCsrf: false
    },
    {
      name: 'Update Profile',
      endpoint: '/api/user/profile',
      method: 'PUT',
      requiresAuth: true,
      requiresCsrf: true
    },
    {
      name: 'Delete User',
      endpoint: '/api/admin/users/:id',
      method: 'DELETE',
      requiresAuth: true,
      requiresCsrf: true,
      requiresAdmin: true
    }
  ];

  securityChecks.forEach(check => {
    describe(check.name, () => {
      if (check.requiresAuth) {
        it('should require authentication', async () => {
          const response = await request(app)[check.method.toLowerCase()](check.endpoint);
          expect(response.status).toBe(401);
        });
      }

      if (check.requiresCsrf) {
        it('should require CSRF token', async () => {
          const response = await request(app)
            [check.method.toLowerCase()](check.endpoint)
            .set('Cookie', sessionCookie);

          expect(response.status).toBe(403);
        });
      }

      if (check.requiresAdmin) {
        it('should require admin role', async () => {
          const response = await request(app)
            [check.method.toLowerCase()](check.endpoint)
            .set('Cookie', userCookie);

          expect(response.status).toBe(403);
        });
      }
    });
  });
});
```

---

## Best Practices

### 1. Isolate Security Tests

Run security tests separately from unit tests:

```bash
npm run test:security  # Run only *.security.test.ts files
```

### 2. Use Realistic Attack Vectors

Test with real-world attack patterns from OWASP Top 10:

- SQL Injection
- XSS
- CSRF
- Broken Authentication
- Security Misconfiguration

### 3. Test Both Positive and Negative Cases

```typescript
// ✅ Good - Tests both allowed and blocked scenarios
it('should allow valid input', async () => { /* ... */ });
it('should block malicious input', async () => { /* ... */ });
```

### 4. Verify Security Headers

```typescript
it('should set security headers', async () => {
  const response = await request(app).get('/');

  expect(response.headers['x-frame-options']).toBe('DENY');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['strict-transport-security']).toBeDefined();
});
```

---

## Related Documentation

- **[SECURITY_PATTERNS.md](../SECURITY_PATTERNS.md)** - Security anti-patterns and correct patterns
- **[ERROR_HANDLING_PATTERNS.md](../ERROR_HANDLING_PATTERNS.md)** - Error sanitization patterns
- **[API_PATTERNS.md](../API_PATTERNS.md)** - Route security and CSRF protection

---

**Last Updated**: 2025-11-26
**Maintained By**: PriceCompare Development Team
