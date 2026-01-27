# TODO 291: Fix Pre-existing TypeScript Errors

**Priority**: P2
**File(s)**: `client/src/pages/products.tsx`, `server/test/routes/compare-routes-simple.test.ts`
**Estimated Time**: 1 hour
**Status**: Not Started
**Tags**: `typescript`, `type-safety`, `tech-debt`

## Problem Statement

The codebase has pre-existing TypeScript errors that `npm run check` reports. These were discovered during the TODO 290 code review but are unrelated to that feature.

## Evidence

**Error 1**: `client/src/pages/products.tsx:335`
```
error TS2322: Type '{ id: number; brand: string | null; name: string; ... }[]'
is not assignable to type 'ProductWithOffers[]'.
```

**Error 2**: `server/test/routes/compare-routes-simple.test.ts:103`
```
error TS2322: Type 'TestAgent<Test>' is not assignable to type 'SuperAgentTest'.
```

## Root Cause Analysis

### Error 1: ProductWithOffers Type Mismatch
The `products.tsx` file is passing an array of basic `Product` objects where `ProductWithOffers[]` is expected. The `ProductWithOffers` type includes additional fields like `offers`, `lowestPrice`, etc.

### Error 2: Supertest Type Mismatch
The `supertest` library's types (`TestAgent<Test>`) don't match the expected `SuperAgentTest` type. This is likely due to:
- Version mismatch between `@types/supertest` and `supertest`
- Incorrect import pattern

## Implementation Steps

### Step 1: Fix products.tsx Type Error

- [ ] Investigate what data is being passed at line 335
- [ ] Either:
  - Transform `Product[]` to `ProductWithOffers[]` with empty offers
  - Update the receiving component to accept `Product[]`
  - Use proper type assertion with validation

### Step 2: Fix Supertest Type Error

- [ ] Check `@types/supertest` version compatibility
- [ ] Update import pattern if needed:
```typescript
// Current (likely)
import request from 'supertest';
let agent: request.SuperAgentTest;

// Alternative
import { agent as superagent, SuperAgentTest } from 'supertest';
```
- [ ] Consider using type assertion as workaround

### Step 3: Verify All Errors Fixed

- [ ] Run `npm run check` with zero errors
- [ ] Ensure tests still pass

## Technical Details

```bash
# Commands to reproduce
npm run check 2>&1 | grep "error TS"

# Expected output after fix
# (no errors)
```

## Checklist

- [ ] products.tsx type error fixed
- [ ] compare-routes-simple.test.ts type error fixed
- [ ] `npm run check` passes with no errors
- [ ] All tests still pass
- [ ] No `any` type workarounds used

## Success Criteria

- [ ] `npm run check` exits with code 0
- [ ] No TypeScript errors in CI pipeline
- [ ] Type safety maintained (no `any` escape hatches)

---

**Source**: Code Review of TODO 290 (2026-01-26)
**Discovered By**: code-review-specialist-v1.2
