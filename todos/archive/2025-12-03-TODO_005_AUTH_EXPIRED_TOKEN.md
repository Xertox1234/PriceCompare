# TODO 005: Fix Auth Routes Expired Token Test

**Priority**: P2 - Medium
**File**: `server/routes/__tests__/auth-routes.test.ts`
**Failures**: 1 test
**Estimated Time**: 30 minutes
**Status**: Not Started

## Failing Test

✗ `should reject expired token`

## Likely Issue

Token expiration test has timing issues:
- Token expires at exact boundary
- Test timing is non-deterministic
- Race condition between token creation and expiration check

## Fix Strategy

Use fake timers to control time in tests:

### Recommended Fix: Vitest Fake Timers

```typescript
import { vi } from 'vitest';

it('should reject expired token', async () => {
  // Enable fake timers
  vi.useFakeTimers();

  // Create user
  const [user] = await db.insert(users).values({
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: await hashPassword('password'),
  }).returning();

  // Request password reset (creates token valid for 1 hour)
  await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'test@example.com' });

  // Get the reset token from database
  const [resetToken] = await db.select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));

  // Fast-forward time past expiration (1 hour + 1 second)
  vi.advanceTimersByTime(1000 * 60 * 60 + 1000);

  // Try to use expired token
  const response = await request(app)
    .post('/api/auth/reset-password')
    .set('x-csrf-token', csrfToken)
    .send({
      token: resetToken.token,
      password: 'newpassword123',
    });

  // Verify rejection
  expect(response.status).toBe(400);
  expect(response.body.error).toContain('expired');

  // Restore real timers
  vi.useRealTimers();
});
```

### Alternative: Manually Set Expired Token

```typescript
it('should reject expired token', async () => {
  // Create user
  const [user] = await db.insert(users).values({
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: await hashPassword('password'),
  }).returning();

  // Manually create expired token (expired 1 hour ago)
  const expiredToken = generateToken();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token: expiredToken,
    expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    createdAt: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
  });

  // Try to use expired token
  const response = await request(app)
    .post('/api/auth/reset-password')
    .set('x-csrf-token', csrfToken)
    .send({
      token: expiredToken,
      password: 'newpassword123',
    });

  expect(response.status).toBe(400);
  expect(response.body.error).toContain('expired');
});
```

## Checklist

- [ ] Read current test
  ```bash
  grep -A 30 "should reject expired token" server/routes/__tests__/auth-routes.test.ts
  ```

- [ ] Check how tokens are created
  ```bash
  grep -n "resetToken\|passwordReset" server/routes/__tests__/auth-routes.test.ts
  ```

- [ ] Check token expiration logic
  ```bash
  grep -n "expiresAt\|isExpired" server/services/password-reset-service.ts
  ```

- [ ] Implement fix using fake timers (recommended)
  - [ ] Import `vi` from vitest
  - [ ] Call `vi.useFakeTimers()` at test start
  - [ ] Use `vi.advanceTimersByTime()` to skip ahead
  - [ ] Call `vi.useRealTimers()` at test end

- [ ] Or implement manual expired token approach

- [ ] Test fix
  ```bash
  npm test server/routes/__tests__/auth-routes.test.ts -- -t "should reject expired token"
  ```

- [ ] Run auth tests fully
  ```bash
  npm test server/routes/__tests__/auth-routes.test.ts
  ```

- [ ] Run 5 times to verify no timing issues
  ```bash
  for i in {1..5}; do
    npm test server/routes/__tests__/auth-routes.test.ts -- -t "expired token"
  done
  ```

## Common Issues

1. **Real Time**: Don't rely on `setTimeout` or real time passage
2. **Cleanup**: Always call `vi.useRealTimers()` after test
3. **Token Format**: Ensure token matches expected format
4. **Database State**: Token must exist in database before testing

## Success Criteria

- [ ] Test passes reliably
- [ ] No race conditions
- [ ] No dependence on real time
- [ ] Test runs in <100ms
- [ ] Passes 5+ times consecutively

## Estimated Timeline

- Investigation: 10 minutes
- Implementation: 10 minutes
- Testing: 10 minutes

**Total**: ~30 minutes
