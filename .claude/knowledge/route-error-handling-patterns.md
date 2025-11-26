# Route Error Handling Patterns

**Status**: Active Pattern (Codified 2025-11-25)
**Scope**: All route files in `server/routes/`
**Enforcement**: Code review agent checks

---

## Overview

This document codifies the standardized error handling patterns discovered during the comprehensive route error handling refactoring completed on 2025-11-25. These patterns are MANDATORY for all route files.

## Background

**Refactoring Statistics:**
- 22 route files standardized
- 140+ manual error handlers replaced
- 23 manual 404 responses standardized
- ~400 lines of boilerplate removed
- 100% consistency achieved

**Problem**: Prior to this refactoring, route files had inconsistent error handling with 4-5 lines of repetitive boilerplate per error handler.

**Solution**: Centralized error handling helpers that reduce boilerplate to 1 line while ensuring consistency and security.

---

## Mandatory Helpers

### 1. handleRouteError()

**Purpose**: Standardized error response for all route error handlers.

**Usage**:
```typescript
catch (error: unknown) {
  handleRouteError(res, error, 'OperationName');
}
```

**What it does**:
- Calls `createErrorResponse()` internally
- Automatically logs errors via logger
- Sends sanitized error response
- Determines correct status code (400 for validation, 500 for others)
- Includes validation details in development mode

**Import**:
```typescript
import { handleRouteError } from "./helpers";
```

**Optional status override**:
```typescript
catch (error: unknown) {
  handleRouteError(res, error, 'OperationName', 500);  // Force 500
}
```

---

### 2. notFound()

**Purpose**: Standardized 404 not-found responses.

**Usage**:
```typescript
if (!resource) {
  notFound(res, 'Resource');
  return;
}
```

**What it does**:
- Returns 404 status code
- Sends consistent JSON response: `{ error: "Resource not found" }`
- Ensures all 404s use same format

**Import**:
```typescript
import { notFound } from "./helpers";
```

---

## Anti-Patterns to Flag

### Anti-Pattern 1: Manual createErrorResponse

```typescript
// ❌ WRONG - Verbose, 4-5 lines
catch (error: unknown) {
  logger.error('Operation failed:', { error: error instanceof Error ? error.message : String(error) });
  const errorResponse = createErrorResponse(error, 'OperationName');
  res.status(errorResponse.status).json({ error: errorResponse.error });
}

// ✅ CORRECT - 1 line
catch (error: unknown) {
  handleRouteError(res, error, 'OperationName');
}
```

**Why it's wrong**: Violates DRY, easy to forget logging, inconsistent format

---

### Anti-Pattern 2: Manual 404 Responses

```typescript
// ❌ WRONG - Inconsistent format (uses "message" instead of "error")
if (!product) {
  res.status(404).json({ message: "Product not found" });
  return;
}

// ❌ WRONG - Custom error messages
if (!watchlist) {
  res.status(404).json({ error: "Watch list not found or cannot be deleted" });
  return;
}

// ✅ CORRECT - Consistent helper
if (!product) {
  notFound(res, 'Product');
  return;
}
```

**Why it's wrong**: API clients expect consistent format, frontend error handling breaks

---

### Anti-Pattern 3: Conditional Details Spreading

```typescript
// ❌ WRONG - Unnecessary complexity
catch (error: unknown) {
  const errorResponse = createErrorResponse(error, 'OpName');
  res.status(errorResponse.status).json({
    error: errorResponse.error,
    ...(errorResponse.details && { details: errorResponse.details })
  });
}

// ✅ CORRECT - Helper includes details automatically
catch (error: unknown) {
  handleRouteError(res, error, 'OpName');
}
```

**Why it's wrong**: Helper already handles details, adds complexity

---

### Anti-Pattern 4: Using console.error

```typescript
// ❌ WRONG - Redundant logging
catch (error: unknown) {
  console.error('Failed to get alerts:', error);
  handleRouteError(res, error, 'GetAlerts');
}

// ✅ CORRECT - Helper logs automatically
catch (error: unknown) {
  handleRouteError(res, error, 'GetAlerts');
}
```

**Why it's wrong**: handleRouteError logs internally, console.error lacks structure

---

### Anti-Pattern 5: Silent Failures

```typescript
// ❌ WRONG - Returns empty array, hides error
catch (error: unknown) {
  logger.error('Error fetching categories', { error });
  res.json([]);
}

// ✅ CORRECT - Return proper error
catch (error: unknown) {
  handleRouteError(res, error, 'GetCategories');
}

// ✅ ACCEPTABLE - Document intentional graceful degradation
catch (error: unknown) {
  // GRACEFUL DEGRADATION: Non-critical feature, don't block UX
  logger.warn('Categories fetch failed, returning empty', { error });
  res.json([]);
}
```

**Why it's wrong**: Masks backend issues, prevents client retry/notification

---

### Anti-Pattern 6: Custom Status Codes Bypassing Validation Detection

```typescript
// ❌ WRONG - Hardcoded 500, ignores validation errors (should be 400)
catch (error: unknown) {
  const errorResponse = createErrorResponse(error, 'OpName');
  res.status(500).json({ error: errorResponse.error });
}

// ✅ CORRECT - Auto-detects validation errors
catch (error: unknown) {
  handleRouteError(res, error, 'OpName');
}
```

**Why it's wrong**: Validation errors get 500 instead of 400, breaks REST conventions

---

## Operation Name Conventions

**Format**: PascalCase describing the action

**Good examples**:
- `'CreateProduct'` - Creating product
- `'GetUserAlerts'` - Fetching user alerts
- `'UpdateWatchList'` - Updating watch list
- `'DeletePriceAlert'` - Deleting price alert
- `'GetPriceHistory'` - Fetching price history
- `'ExportWatchLists'` - Exporting watch lists
- `'ImportProducts'` - Importing products

**Bad examples**:
- `'operation'` - Too generic
- `'get_user_alerts'` - Wrong case
- `'fetch data'` - Has space
- `'API Call'` - Too vague

---

## Complete Route Example

**Before refactoring**:
```typescript
app.get("/api/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const product = await storage.getProduct(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error: unknown) {
    console.error('Failed to get product:', error);
    const errorResponse = createErrorResponse(error, 'GetProduct');
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      ...(errorResponse.details && { details: errorResponse.details })
    });
  }
});
```

**After refactoring**:
```typescript
app.get("/api/products/:id", async (req, res) => {
  try {
    const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
    const product = await storage.getProduct(id);

    if (!product) {
      notFound(res, 'Product');
      return;
    }

    res.json(product);
  } catch (error: unknown) {
    handleRouteError(res, error, 'GetProduct');
  }
});
```

**Improvements**:
- 18 lines → 12 lines (33% reduction)
- Safe integer parsing with validation
- Consistent error response format
- Automatic logging
- Clear, maintainable code

---

## Code Review Checklist

When reviewing route files (`server/routes/*.ts`), verify:

- [ ] All catch blocks use `handleRouteError(res, error, 'OpName')`
- [ ] All 404 responses use `notFound(res, 'ResourceName')`
- [ ] No manual `createErrorResponse` calls in catch blocks
- [ ] No manual `res.status(404).json({...})` calls
- [ ] No `console.error` in error handlers
- [ ] No silent failures (returning empty arrays/objects on error)
- [ ] Proper imports: `import { handleRouteError, notFound } from "./helpers"`
- [ ] Operation names follow PascalCase convention

---

## Benefits Summary

1. **Consistency**: All routes return errors in identical format
2. **DRY**: 4-5 lines reduced to 1 line per error handler
3. **Security**: Automatic error sanitization prevents information leakage
4. **Maintainability**: Change error format globally in one place
5. **Type Safety**: Proper TypeScript `unknown` error handling
6. **Logging**: Automatic structured logging via helpers
7. **Testing**: Easier to test consistent error responses

---

## Related Documentation

- [ERROR_HANDLING_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/ERROR_HANDLING_PATTERNS.md) - Full error handling guide
- [helpers.ts](/Users/williamtower/projects/PriceCompare/server/routes/helpers.ts) - Helper implementation
- [error-sanitizer.ts](/Users/williamtower/projects/PriceCompare/server/utils/error-sanitizer.ts) - Underlying sanitization logic
- [code-review-specialist.md](/Users/williamtower/projects/PriceCompare/.claude/agents/code-review-specialist.md) - Review agent configuration

---

## Enforcement

**Pre-commit hook**: Warns about missing `createErrorResponse` usage
**Code review agent**: Flags all anti-patterns listed above
**Manual review**: All route PRs must follow these patterns

**Zero tolerance**: All new code MUST use these helpers. Legacy code should be refactored when touched.
