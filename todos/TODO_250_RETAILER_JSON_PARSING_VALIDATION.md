# TODO 250: Fix Unsafe JSON Parsing in Retailer Storage

**Priority**: P1
**File(s)**: `server/storage/domains/retailer-storage.ts`, `server/agents/coordinator-agent.ts`, `server/services/advanced-cache.ts`
**Estimated Time**: 1 hour
**Status**: Not Started

## Problem Statement

JSON parsing in storage and service layers uses `JSON.parse()` with type assertions but lacks proper error handling and validation. Malformed JSON could cause uncaught exceptions.

## Root Cause

Several locations use patterns like:
```typescript
JSON.parse(row.affiliateConfig) as Record<string, unknown>
JSON.parse(job.targetData) as Record<string, unknown>
JSON.parse(value) as T
```

While SAFETY comments exist for some, the parsing itself can throw and needs error handling.

## Solution Approach

1. Create a safe JSON parsing utility with error handling
2. Add optional Zod validation for known JSON structures
3. Replace unsafe `JSON.parse()` calls with safe wrapper

## Implementation Steps

### Step 1: Create Safe JSON Parser Utility

- [ ] Add `safeJsonParse<T>()` function to `server/utils/json-helpers.ts`
- [ ] Include try-catch with proper error logging
- [ ] Support optional Zod schema validation

```typescript
// server/utils/json-helpers.ts
import { z, ZodSchema } from 'zod';

interface ParseResult<T> {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
}

export function safeJsonParse<T>(
  jsonString: string,
  context: string,
  schema?: ZodSchema<T>
): ParseResult<T> {
  try {
    const parsed = JSON.parse(jsonString);
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        return { success: false, error: `Validation failed: ${result.error.message}` };
      }
      return { success: true, data: result.data };
    }
    return { success: true, data: parsed as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`JSON parse failed in ${context}:`, message);
    return { success: false, error: message };
  }
}
```

### Step 2: Update Retailer Storage

- [ ] Replace `JSON.parse(row.affiliateConfig)` with safe parser
- [ ] Add proper error handling for parse failures
- [ ] Return null or default value on parse error

### Step 3: Update Coordinator Agent

- [ ] Replace `JSON.parse(job.targetData)` with safe parser
- [ ] Handle parse failures gracefully in job processing

### Step 4: Update Advanced Cache

- [ ] Replace `JSON.parse(value)` with safe parser
- [ ] Invalidate cache entries with corrupted JSON

## Files to Update

1. `server/storage/domains/retailer-storage.ts` (line 403)
2. `server/agents/coordinator-agent.ts` (line 437)
3. `server/services/advanced-cache.ts` (lines 325, 546)

## Checklist

- [ ] Implementation complete
- [ ] Tests for JSON parse error handling
- [ ] No unhandled JSON.parse exceptions
- [ ] Graceful degradation on parse failures

## Success Criteria

- [ ] All JSON parsing uses safe wrapper
- [ ] Parse errors are logged with context
- [ ] No uncaught exceptions from malformed JSON
- [ ] Existing functionality preserved
