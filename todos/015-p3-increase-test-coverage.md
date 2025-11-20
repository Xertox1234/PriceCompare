---
status: pending
priority: p3
issue_id: "015"
tags: [testing, quality, coverage, long-term]
dependencies: []
estimated_effort: 40-60 hours
---

# Increase Test Coverage to 80%+

## Problem Statement

**QUALITY IMPROVEMENT**: Current test coverage is estimated at 30-40%. Industry best practice for production applications is 80%+ coverage, especially for critical paths like authentication, payment processing, and data access.

**Impact:** Medium - Improves confidence in deployments, prevents regressions, enables safe refactoring

## Current State

- **Total tests**: 758 (755 passing, 3 failing)
- **Estimated coverage**: 30-40% of codebase
- **Well-tested areas**:
  - ✅ Sanitization module (92.85% coverage, 155 tests)
  - ✅ Price history components (30 tests)
  - ✅ Admin user management (9 tests)
  - ✅ Chrome extension utilities (26 tests)

- **Untested/Under-tested areas**:
  - ❌ Authentication flows (login, register, password reset)
  - ❌ Most API endpoints
  - ❌ Middleware (CSRF, rate limiting, caching)
  - ❌ Services (alerts, email, notifications)
  - ❌ Background jobs (price snapshots, analytics)

## Implementation Plan

### Phase 1: Unit Tests (Weeks 5-7)

**Priority areas**:

1. **Authentication** (`server/routes/auth-routes.ts`)
   - User registration validation
   - Login flow
   - Password hashing
   - Session management
   - Password reset flow

2. **Middleware** (20+ test cases)
   - CSRF protection
   - Rate limiting (Redis-based)
   - Account lockout
   - Input sanitization
   - Error handling

3. **Services** (30+ test cases)
   - Price snapshot service
   - Alert service
   - Email service
   - Notification service
   - Search service

### Phase 2: Integration Tests (Weeks 8-9)

**API endpoint testing** with supertest:

```typescript
import request from 'supertest';
import { app } from '../../index';

describe('Product API Integration', () => {
  it('should search products by name', async () => {
    const response = await request(app)
      .get('/api/products/search?query=laptop')
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should respect rate limits', async () => {
    // Make 101 requests
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/products');
    }

    await request(app)
      .get('/api/products')
      .expect(429);
  });
});
```

### Phase 3: E2E Tests (Weeks 10-11)

**Critical user journeys** with Playwright:

1. User registration → login → dashboard
2. Product search → view details → create alert
3. Forum topic creation → reply → moderation
4. Admin user management flow

### Phase 4: Coverage Enforcement (Week 12)

**Configure coverage thresholds**:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
      thresholds: {
        autoUpdate: true
      }
    }
  }
});
```

**Add pre-commit coverage check** (optional):
```bash
# .husky/pre-commit
npm run test:coverage
```

## Success Criteria

- [ ] 80%+ statement coverage
- [ ] 80%+ branch coverage
- [ ] All authentication flows tested
- [ ] All API endpoints have integration tests
- [ ] Critical user journeys have E2E tests
- [ ] CI fails on coverage drop
- [ ] No flaky tests

## Timeline

**Estimated effort**: 40-60 hours over 8 weeks

- Weeks 5-7: Unit tests (24-36 hours)
- Weeks 8-9: Integration tests (12-16 hours)
- Weeks 10-11: E2E tests (4-8 hours)
- Week 12: Coverage enforcement setup (2-3 hours)

## Notes

- This is a **long-term quality improvement**, not blocking production deployment
- Can be done incrementally alongside feature development
- Focus on critical paths first (auth, payments, data access)
- Already have 758 passing tests, good foundation to build on
