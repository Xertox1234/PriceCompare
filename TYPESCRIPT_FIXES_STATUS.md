# TypeScript Fixes Status

**Last Updated**: 2025-11-27
**Current Error Count**: 34 (down from 44)
**Progress**: 23% reduction (10 errors fixed)

## Completed Phases

### Phase 1: Infrastructure & API Deprecations (21 errors fixed)
**Commit**: `4fdf4d0` - "fix(types): Fix TypeScript errors - Phase 1"

1. ✅ **tsconfig.json** - Added `target: "ES2022"` for top-level await (5 errors)
2. ✅ **E2E tests** - Fixed productOffers schema (3 errors)
   - `url` → `productUrl`
   - `inStock` → `availability`
   - Added `productOfferId` to priceHistory
3. ✅ **Sentry v10 migration** (6 errors)
   - `startTransaction` → `startSpan`
   - `Handlers` → `setupExpressErrorHandler`
   - Added `Application` type for Express app
4. ✅ **WebSocket Server types** (7 errors)
   - Added `import type { Server } from 'socket.io'` to 3 handlers

### Phase 2: Validation & Middleware (8 errors fixed)
**Commit**: `3daebb9` - "fix(types): Fix TypeScript errors - Phase 2"

1. ✅ **Request limits middleware** (1 error)
   - Added `return` before `next()`
2. ✅ **Price analytics Zod errors** (5 errors)
   - Changed `queryParams.error` → `queryParams.error.message`
3. ✅ **Enhanced forum routes** (2 errors)
   - Changed `validation.errors` → `validation.errors?.join('; ')`

### Phase 3: Seed Data Schema (7 errors fixed)
**Commit**: `f572cda` - "fix(types): Fix TypeScript errors - Phase 3"

1. ✅ **Retailer schema updates** (5 errors)
   - `url` → `website`
   - `logoUrl` → `logo`
   - Added `InsertRetailer` type annotations
2. ✅ **ProductOffer schema** (2 errors)
   - `url` → `productUrl`
   - `inStock` → `availability: 'in_stock'`

## Remaining Errors (34 total)

### Category 1: Forum Storage Type Errors (12 errors)
**Files**:
- `server/enhanced-forum-storage.ts` (8 errors)
- `server/forum-storage.ts` (4 errors)

**Issues**:
```
- Property 'isBanned' does not exist on users table (2 errors)
- Property 'lastLoginAt' does not exist on users table (2 errors)
- Type mismatch: UserWithProfile assignment (2 errors)
- Type mismatch: ForumTopicWithDetails array (1 error)
- Argument type: null | undefined not assignable to number (2 errors)
- No overload matches this call (2 errors)
- Implicit 'any' type (1 error)
```

**Root Cause**: Schema evolution - forum storage expecting fields that were removed or renamed in schema migrations.

**Fix Strategy**:
1. Check if `isBanned` and `lastLoginAt` exist in current schema
2. If not, update forum storage to use correct fields or remove references
3. Fix type mismatches by aligning with actual schema types

### Category 2: WebSocket/Mock Type Errors (9 errors)
**Files**:
- `server/websocket/__tests__/mock-types.ts` (5 errors)
- `server/websocket/__tests__/test-utils.ts` (1 error)
- `server/websocket/index.ts` (3 errors)

**Issues**:
```
- Property 'incr/expire/get/set/del' not assignable to string index type (5 errors)
- Argument type mismatch for acknowledgements (1 error)
- SocketRequestWithSession missing Session properties (2 errors)
- Type parameter mismatch for emit (1 error)
```

**Root Cause**: Redis mock interface incompatible with ioredis typing.

**Fix Strategy**:
1. Use proper ioredis type for mock: `Partial<Redis>` or create custom interface
2. Fix Session type extension to properly extend express-session
3. Fix Socket.IO type parameters for emit/acknowledgements

### Category 3: Middleware Type Errors (5 errors)
**Files**:
- `server/middleware/performance.ts` (3 errors)
- `server/middleware/error-handler.ts` (2 errors)
- `server/middleware/account-lockout.ts` (1 error)

**Issues**:
```
- Response.end() parameter type mismatch (3 errors in performance.ts)
- Missing return statements (2 errors)
- String | undefined not assignable to string (1 error)
```

**Root Cause**: Express Response overload resolution issues.

**Fix Strategy**:
1. Add proper overload types for Response.end()
2. Add explicit returns in error handlers
3. Add null checks or use optional chaining

### Category 4: Miscellaneous Errors (8 errors)
**Files**:
- `server/routes/community-routes.ts` (1 error)
- `server/cache-initialization.ts` (2 errors)
- `server/discourse-sso.ts` (2 errors)
- `server/agents/affiliate-agent.ts` (1 error)
- `server/websocket/middleware/error-handler.ts` (1 error)

**Issues**: Various type mismatches and null handling issues.

## Next Steps - Action Plan

### Recommended Order (Easiest → Hardest)

#### Step 1: Fix Simple Middleware Errors (3 errors, ~15 min)
**File**: `server/middleware/error-handler.ts`, `server/middleware/account-lockout.ts`
- Add missing `return` statements
- Add null checks for string | undefined

#### Step 2: Fix Miscellaneous Route Errors (8 errors, ~30 min)
**Files**: Various route and utility files
- Fix community-routes WatchListImportData type
- Fix discourse-sso remaining errors
- Fix cache-initialization errors
- Fix affiliate-agent error

#### Step 3: Fix WebSocket Mock Types (9 errors, ~45 min)
**Files**: `server/websocket/__tests__/*.ts`, `server/websocket/index.ts`
- Create proper Redis mock interface extending `Partial<Redis>`
- Fix SocketRequestWithSession to properly extend Session
- Fix Socket.IO emit type parameters

#### Step 4: Fix Forum Storage Errors (12 errors, ~60 min)
**Files**: `server/enhanced-forum-storage.ts`, `server/forum-storage.ts`
- Audit schema for `isBanned`, `lastLoginAt` fields
- Update forum storage to match current schema
- Fix type assignments for UserWithProfile and ForumTopicWithDetails

#### Step 5: Fix Performance Middleware (3 errors, ~20 min)
**File**: `server/middleware/performance.ts`
- Research correct Response.end() overload signature
- Add proper type annotations

#### Step 6: Add npm run check to Pre-Commit Hook
**File**: `.git/hooks/pre-commit`
- Add TypeScript check before allowing commits
- Prevent future type errors from being committed

## Commands Reference

```bash
# Check current error count
npm run check 2>&1 | grep -c "error TS"

# List errors by file
npm run check 2>&1 | grep "error TS" | sed 's/(.*//' | sort | uniq -c | sort -rn

# Check specific file errors
npm run check 2>&1 | grep "FILENAME.*error TS"

# Run specific test
npm test path/to/test.spec.ts

# Commit fixes
git add -A
git commit -m "fix(types): [description]"
git push origin add_scraping
```

## Schema Field Reference (Common Mistakes)

### Retailers Table
- ❌ `url` → ✅ `website`
- ❌ `logoUrl` → ✅ `logo`

### ProductOffers Table
- ❌ `url` → ✅ `productUrl`
- ❌ `inStock` → ✅ `availability` (enum: 'in_stock', 'out_of_stock', 'preorder')
- ❌ `currency` → ✅ (removed field)

### PriceHistory Table
- ✅ Must include `productOfferId` field

### Users Table (Verify Current Schema)
- ❓ Check if `isBanned` exists
- ❓ Check if `lastLoginAt` exists
- ✅ `passwordHash` - NEVER expose (security)

## CI/CD Status

Last push: `f572cda` (Phase 3 fixes)
Waiting for: Type checking step on CI to confirm 34 errors also exist on CI

## Notes for Next Session

1. **Context Reset Needed**: This conversation has covered 3 phases of fixes
2. **Fresh Approach**: Start with Step 1 (simple middleware) to build momentum
3. **Schema Verification**: Need to verify users table schema before touching forum storage
4. **Test After Each Fix**: Run `npm run check` after each category to track progress
5. **Commit Frequently**: Small, focused commits are easier to review and revert if needed

## Success Criteria

- [ ] All 34 TypeScript errors resolved
- [ ] `npm run check` returns 0 errors
- [ ] CI type checking step passes
- [ ] Pre-commit hook includes type checking
- [ ] All tests still pass
