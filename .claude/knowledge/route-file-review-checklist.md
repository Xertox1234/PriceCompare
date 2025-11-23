# Route File Review Checklist

## Quick Reference for Reviewing server/routes/*.ts Files

This checklist captures critical patterns that MUST be checked when reviewing route files, based on lessons learned from code review sessions.

## 1. Import Path Validation ⚠️

**CRITICAL**: Files in `server/routes/` directory require '../' prefix for server imports

### ✅ CORRECT Imports
```typescript
// Route file: server/routes/community-routes.ts
import { log } from '../utils/logger';
import { createErrorResponse } from '../utils/error-sanitizer';
import { parseIntSafe, parseIntOptional } from '../utils/validation-helpers';
import { storage } from '../storage';
import { communityService } from '../services/community-service';
import { csrfProtection } from '../middleware/csrf';
```

### ❌ WRONG Imports (Common after file moves)
```typescript
// These will cause MODULE_NOT_FOUND errors
import { log } from './utils/logger';  // Missing ../
import { storage } from './storage';    // Missing ../
import { communityService } from './services/community-service'; // Missing ../
```

**Root Cause**: When files are moved from `server/` to `server/routes/`, all relative imports need to change from `./` to `../`

## 2. Error Handling Standardization 🛡️

**MANDATORY**: ALL catch blocks must use `createErrorResponse` utility

### ✅ CORRECT Pattern (2 lines, DRY)
```typescript
import { createErrorResponse } from '../utils/error-sanitizer';

// In route handler
try {
  const result = await someOperation();
  res.json(result);
} catch (error) {
  const errorResponse = createErrorResponse(error, 'CreateDealSpotting');
  res.status(errorResponse.status).json(errorResponse);
}
```

### ❌ WRONG Patterns to Flag
```typescript
// WRONG: Raw error exposure
catch (error) {
  res.status(500).json({ error: error.message });
}

// WRONG: Manual verbose handling (5+ lines)
catch (error) {
  console.error('Operation failed:', error);
  res.status(500).json({
    error: error.message,
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
}

// WRONG: Custom error construction
catch (error) {
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong'
  });
}
```

**Benefits**:
- Consistent error format across API
- No sensitive information leakage
- Maintains DRY principle (Don't Repeat Yourself)
- Reduces 5 lines to 2 lines per catch block

## 3. Integer Parsing Safety 🔢

**ZERO TOLERANCE**: Never use raw `parseInt()` or `Number()`

### ✅ CORRECT Patterns
```typescript
import { parseIntSafe, parseIntOptional } from '../utils/validation-helpers';

// Required integer with validation
const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });

// Optional integer with default
const page = parseIntOptional(req.query.page, { min: 1, max: 1000, default: 1 });
const limit = parseIntOptional(req.query.limit, { min: 1, max: 100, default: 10 });

// Required with specific range
const priority = parseIntSafe(req.body.priority, 'priority', { min: 1, max: 5 });
```

### ❌ WRONG Patterns to Flag
```typescript
// WRONG: No validation, can return NaN
const page = parseInt(req.query.page);

// WRONG: Still unsafe with fallback
const limit = parseInt(req.query.limit) || 10;

// WRONG: Number constructor
const priority = Number(req.body.priority);

// WRONG: Unary plus operator
const userId = +req.params.id;

// WRONG: Manual validation after parsing
const page = parseInt(req.query.page);
if (isNaN(page) || page < 1) {
  return res.status(400).json({ error: 'Invalid page' });
}
```

## 4. Database Access Pattern 💾

**REQUIRED**: All database operations through storage abstraction

### ✅ CORRECT
```typescript
import { storage } from '../storage';

// Use storage methods
const product = await storage.getProductById(id);
const results = await storage.searchProducts(query);
```

### ❌ WRONG
```typescript
import { db } from '../db';
import { products } from '@shared/schema';

// Direct database queries in routes
const product = await db.select().from(products).where(eq(products.id, id));
```

## 5. Common Review Findings

Based on actual code reviews, here are patterns that frequently need correction:

1. **After file moves**: 100% of imports need updating from './' to '../'
2. **Error handling**: Often 20+ catch blocks need standardization in a single file
3. **parseInt usage**: Common in pagination, IDs, and numeric parameters
4. **Repetitive code**: If you see the same pattern 3+ times, it needs abstraction

## Review Priority

When reviewing route files, check in this order:

1. **🔴 Critical**: Import paths (app won't run if wrong)
2. **🔴 Critical**: parseInt safety (security/reliability issue)
3. **🟡 Important**: Error handling standardization (security/UX)
4. **🟡 Important**: Database abstraction (architecture)
5. **🟢 Good Practice**: DRY principles, code organization

## Quick Command Reference

### Find Issues
```bash
# Find wrong imports in route files
grep -r "from '\./utils" server/routes/
grep -r "from '\./services" server/routes/
grep -r "from '\./storage" server/routes/

# Find raw parseInt usage
grep -r "parseInt(" server/routes/
grep -r "Number(" server/routes/

# Find manual error handling
grep -r "res.status(500)" server/routes/
grep -r "error.message" server/routes/
```

### Fix Issues
```bash
# Update imports (example for community-routes.ts)
sed -i '' "s/from '\.\/utils/from '..\/utils/g" server/routes/community-routes.ts
sed -i '' "s/from '\.\/services/from '..\/services/g" server/routes/community-routes.ts

# Note: Manual review still required for error handling and parseInt fixes
```

## Remember

- **These patterns save time**: One review caught and fixed 20+ error handling blocks
- **Consistency matters**: Standardized patterns make the codebase maintainable
- **Security first**: These patterns prevent common vulnerabilities
- **DRY principle**: If you're writing the same code repeatedly, you're doing it wrong