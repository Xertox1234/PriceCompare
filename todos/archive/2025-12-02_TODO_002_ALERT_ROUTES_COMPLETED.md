# TODO 002: Fix Alert Routes Test Isolation

**Priority**: P0 - Critical
**File**: `server/__tests__/alert-routes.test.ts`
**Failures**: 29 tests
**Estimated Time**: 2-3 hours
**Status**: Not Started

## Problem Statement

All 29 tests in alert routes test suite failing due to same database isolation issues as watchlist tests. Data persists between tests causing unexpected state.

## Failing Tests

1. ✗ should create alert for authenticated user
2. ✗ should create alert with forum notification enabled
3. ✗ should require authentication (POST /api/alerts)
4. ✗ should require CSRF token
5. ✗ should validate productId
6. ✗ should validate targetPrice
7. ✗ should validate forumNotify boolean
8. ✗ should get user's alerts
9. ✗ should require authentication (GET /api/alerts)
10. ✗ should return empty array when no alerts
11. ✗ should include product details in alert response
12. ✗ should update alert target price
13. ✗ should update forum notification preference
14. ✗ should require authentication (PATCH /api/alerts/:id)
15. ✗ should require CSRF token
16. ✗ should validate targetPrice on update
17. ✗ should not allow updating other user's alerts
18. ✗ should delete alert
19. ✗ should require authentication (DELETE /api/alerts/:id)
20. ✗ should require CSRF token
21. ✗ should not allow deleting other user's alerts
22. ✗ should return 404 for non-existent alert
23. ✗ should trigger alert when price drops below target
24. ✗ should not trigger alert when price above target
25. ✗ should mark alert as triggered
26. ✗ should send notification when alert triggers
27. ✗ should handle multiple alerts for same product
28. ✗ should get alert statistics
29. ✗ should require authentication (GET /api/alerts/stats)

## Root Cause

Identical to watchlist routes issue:
- Database cleanup insufficient
- Foreign key cleanup order wrong
- Data leaking between tests
- Possible notification/email mocking issues

## Implementation Checklist

### Phase 1: Investigate Current State

- [ ] Read test file completely
  ```bash
  code server/__tests__/alert-routes.test.ts
  ```

- [ ] Document current cleanup in `beforeEach`

- [ ] Identify all tables used:
  - [ ] priceAlerts
  - [ ] users
  - [ ] products
  - [ ] productOffers
  - [ ] retailers
  - [ ] notifications (if exists)
  - [ ] priceHistory
  - [ ] Other tables?

- [ ] Check for mocked services:
  - [ ] Email service
  - [ ] Notification service
  - [ ] WebSocket service

### Phase 2: Fix Database Cleanup

- [ ] Use TRUNCATE CASCADE approach (recommended)
  ```typescript
  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.CSRF_SECRET = 'test-csrf-secret';

    // Clean database - order matters for foreign keys
    await db.execute(sql`TRUNCATE TABLE price_alerts RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE notifications RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE price_history RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

    // Set up test data...
  });
  ```

- [ ] Alternative: Manual deletion in correct order
  ```typescript
  beforeEach(async () => {
    // Delete children before parents
    await db.delete(priceAlerts);
    await db.delete(notifications);
    await db.delete(priceHistory);
    await db.delete(productOffers);
    await db.delete(products);
    await db.delete(retailers);
    await db.delete(users);
  });
  ```

### Phase 3: Fix Service Mocks

- [ ] Verify email service is mocked
  ```typescript
  vi.mock('../services/email-service', () => ({
    emailService: {
      sendPriceAlert: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockReturnValue(true),
    }
  }));
  ```

- [ ] Verify notification service is mocked
  ```typescript
  vi.mock('../services/notification-service', () => ({
    createNotification: vi.fn().mockResolvedValue({ id: 1 }),
  }));
  ```

- [ ] Verify WebSocket service is mocked
  ```typescript
  vi.mock('../services/websocket-service', () => ({
    broadcastPriceAlert: vi.fn(),
  }));
  ```

- [ ] Reset mocks in beforeEach
  ```typescript
  beforeEach(async () => {
    vi.clearAllMocks();
    // ... cleanup
  });
  ```

### Phase 4: Fix Test Data Setup

- [ ] Create consistent test user
  ```typescript
  let testUserId: number;
  let testProductId: number;
  let authCookie: string[];

  beforeEach(async () => {
    // ... cleanup ...

    // Create test user
    const [user] = await db.insert(users).values({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashed_password_test',
      role: 'user',
    }).returning();
    testUserId = user.id;

    // Login user to get auth cookie
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password' });

    authCookie = loginResponse.headers['set-cookie'];
  });
  ```

- [ ] Create consistent test products
  ```typescript
  beforeEach(async () => {
    // ... user setup ...

    // Create retailer
    const [retailer] = await db.insert(retailers).values({
      name: 'Test Retailer',
      website: 'https://test.com',
      isActive: true,
    }).returning();

    // Create product
    const [product] = await db.insert(products).values({
      name: 'Test Product',
      description: 'Test Description',
      category: 'Electronics',
    }).returning();
    testProductId = product.id;

    // Create offer with current price
    await db.insert(productOffers).values({
      productId: testProductId,
      retailerId: retailer.id,
      price: '299.99',
      availability: 'in_stock',
      productUrl: 'https://test.com/product',
    });
  });
  ```

### Phase 5: Add Cleanup Verification

- [ ] Verify database is clean after tests
  ```typescript
  afterEach(async () => {
    // Verify cleanup worked
    const alertCount = await db.select({ count: sql<number>`count(*)` })
      .from(priceAlerts);

    const notificationCount = await db.select({ count: sql<number>`count(*)` })
      .from(notifications);

    if (parseInt(alertCount[0].count as string) > 0) {
      console.error(`❌ ${alertCount[0].count} alerts remain after test`);
    }

    if (parseInt(notificationCount[0].count as string) > 0) {
      console.error(`❌ ${notificationCount[0].count} notifications remain`);
    }
  });
  ```

### Phase 6: Fix CSRF and Auth Issues

- [ ] Verify CSRF token setup
  ```typescript
  let csrfToken: string;

  beforeEach(async () => {
    // ... cleanup and setup ...

    // Get CSRF token
    const csrfResponse = await request(app)
      .get('/api/csrf-token')
      .set('Cookie', authCookie);

    csrfToken = csrfResponse.body.csrfToken;
  });
  ```

- [ ] Use CSRF token in POST/PATCH/DELETE requests
  ```typescript
  const response = await request(app)
    .post('/api/alerts')
    .set('Cookie', authCookie)
    .set('x-csrf-token', csrfToken)  // ← Important!
    .send({
      productId: testProductId,
      targetPrice: '249.99',
      forumNotify: false,
    });
  ```

### Phase 7: Run and Verify

- [ ] Run test file
  ```bash
  npm test server/__tests__/alert-routes.test.ts
  ```

- [ ] Check for common errors:
  - [ ] "CSRF token missing" → Fix token setup
  - [ ] "Unauthorized" → Fix auth cookie
  - [ ] Foreign key violations → Fix cleanup order
  - [ ] "Product not found" → Fix test data setup

- [ ] Run multiple times for consistency
  ```bash
  npm test server/__tests__/alert-routes.test.ts
  npm test server/__tests__/alert-routes.test.ts
  npm test server/__tests__/alert-routes.test.ts
  ```

- [ ] Test individual tests
  ```bash
  npm test server/__tests__/alert-routes.test.ts -- -t "should create alert"
  ```

### Phase 8: Document and Finalize

- [ ] Add cleanup comments
  ```typescript
  /**
   * Alert Routes Test Setup
   *
   * Database Cleanup:
   * - TRUNCATE CASCADE for fast, reliable cleanup
   * - Order: notifications → alerts → offers → products → users
   *
   * Mocks:
   * - Email service (prevent actual emails)
   * - Notification service (test notification creation)
   * - WebSocket service (test real-time alerts)
   */
  ```

- [ ] Remove debugging code
- [ ] Verify all console.log removed
- [ ] Update test descriptions if needed

## Testing Commands

```bash
# Run alert tests only
npm test server/__tests__/alert-routes.test.ts

# Verbose output
npm test server/__tests__/alert-routes.test.ts -- --reporter=verbose

# Specific test
npm test server/__tests__/alert-routes.test.ts -- -t "should create alert"

# Run 3 times
for i in {1..3}; do
  echo "Run $i:"
  npm test server/__tests__/alert-routes.test.ts
done
```

## Success Criteria

- [ ] All 29 tests pass
- [ ] Tests pass individually
- [ ] Tests pass as suite
- [ ] Tests pass 3+ times consistently
- [ ] No database cleanup errors
- [ ] No mock-related errors
- [ ] No foreign key violations
- [ ] Mocks are properly reset between tests
- [ ] No actual emails sent during tests
- [ ] No actual notifications created (mocked)

## Common Issues

1. **Email Service Not Mocked**: Tests try to send real emails
2. **Foreign Key Order**: priceAlerts references users and products
3. **Auth State**: User must be logged in for most operations
4. **CSRF Token**: Required for all POST/PATCH/DELETE operations
5. **Price Alert Triggering**: Need product offers with prices
6. **Notification Service**: Must mock to prevent database writes

## Related Files

- `server/__tests__/alert-routes.test.ts` - Main test file
- `server/routes/alert-routes.ts` - Routes being tested
- `server/services/alert-service.ts` - Alert business logic
- `server/services/email-service.ts` - Email notifications (mock me!)
- `server/services/notification-service.ts` - In-app notifications (mock me!)
- `shared/schema.ts` - Database schema

## Notes

- Price alerts trigger when product price drops below target
- Alerts can optionally post to community forum
- Email notifications sent when alert triggers
- In-app notifications created for all alerts
- WebSocket broadcasts for real-time updates

## Dependencies on Other TODOs

- None - Can be done in parallel with TODO 001

## Estimated Timeline

- Phase 1 (Investigation): 30 minutes
- Phase 2-3 (Cleanup & mocks): 60 minutes
- Phase 4-5 (Setup & verification): 30-60 minutes
- Phase 6 (CSRF/Auth): 15-30 minutes
- Phase 7 (Testing): 30 minutes
- Phase 8 (Documentation): 15 minutes

**Total**: 2-3 hours
