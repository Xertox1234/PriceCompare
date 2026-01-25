# TODO 294: Standardize Client-Side Input Validation with Zod

**Priority**: P3
**File(s)**: `client/src/components/auth/login-form.tsx`, `client/src/pages/reset-password.tsx`, `client/src/pages/forgot-password.tsx`
**Estimated Time**: 2 hours
**Status**: Not Started
**Tags**: `code-review`, `security`, `validation`

## Problem Statement

Several forms rely on basic string trimming or custom validation instead of Zod schemas:

| File | Current Validation | Should Use |
|------|-------------------|------------|
| `login-form.tsx:44-46` | `trim()` only | Zod schema |
| `reset-password.tsx:90-103` | Custom function | Zod schema |
| `forgot-password.tsx:51-56` | Basic regex | Zod schema |

This creates:
- Inconsistent validation patterns
- Potential security gaps
- Code duplication (same validation logic in multiple places)

## Evidence

**File**: `client/src/pages/forgot-password.tsx:51-56`
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  setError('Please enter a valid email address');
  return;
}
// Should use: const emailSchema = z.string().email();
```

## Solution Approach

Create shared Zod schemas in `@shared/` for auth forms and reuse them across client and server.

## Implementation Steps

### Step 1: Create Shared Auth Schemas

- [ ] Create `shared/schemas/auth.ts`
- [ ] Define `loginSchema`, `registerSchema`, `forgotPasswordSchema`, `resetPasswordSchema`
- [ ] Export for use in both client and server

### Step 2: Update Auth Components

- [ ] Update `login-form.tsx` to use `loginSchema`
- [ ] Update `forgot-password.tsx` to use `forgotPasswordSchema`
- [ ] Update `reset-password.tsx` to use `resetPasswordSchema`

### Step 3: Update Server Validation

- [ ] Import shared schemas in auth routes
- [ ] Replace any duplicate validation logic

## Technical Details

```typescript
// shared/schemas/auth.ts
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

```typescript
// forgot-password.tsx - Updated
import { forgotPasswordSchema } from '@shared/schemas/auth';

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  const result = forgotPasswordSchema.safeParse({ email });
  if (!result.success) {
    setError(result.error.errors[0].message);
    return;
  }

  // Proceed with API call
};
```

## Checklist

- [ ] Shared schemas created
- [ ] Client forms updated
- [ ] Server validation updated
- [ ] Types exported and used
- [ ] Tests pass

## Success Criteria

- [ ] Single source of truth for auth validation
- [ ] Consistent error messages
- [ ] Type safety across client and server
- [ ] No duplicate validation logic

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: security-sentinel
