---
status: completed
priority: p1
issue_id: "020"
tags: [typescript, type-safety, api, code-review]
dependencies: []
completed_date: 2025-11-23
---

# Change ApiResponse<T = any> to ApiResponse<T = unknown>

## Problem Statement

**TYPE SAFETY ISSUE**: The `ApiResponse<T = any>` generic default weakens type safety across the entire API layer. Using `any` as a default allows unsafe operations without TypeScript warnings.

**Impact:** Type errors slip through at compile time, causing runtime bugs.

## Findings

Discovered during comprehensive code audit by kieran-typescript-reviewer agent on 2025-11-23.

**Location:** `shared/types.ts` line 11

**Evidence:**
```typescript
// Current - weakens type safety
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Usage allows unsafe operations:
const response: ApiResponse = await fetch(...);
response.data.nonExistentProperty; // No TypeScript error!
```

## Proposed Solutions

### Option 1: Change to unknown (Recommended)

**Effort:** Small (15 minutes)

**Implementation:**
```typescript
// Fixed - forces type checking
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Now requires type narrowing:
const response: ApiResponse = await fetch(...);
if (response.data && typeof response.data === 'object') {
  // Must type check before use
}
```

### Option 2: Make T Required

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
// Forces explicit type at every usage
```

## Recommended Action

Change default from `any` to `unknown` to enforce type safety while maintaining backward compatibility.

## Technical Details

- **Affected Files**: `shared/types.ts`
- **Related Components**: All API consumers
- **Database Changes**: None

## Acceptance Criteria

- [ ] ApiResponse default changed to `unknown`
- [ ] TypeScript compilation passes
- [ ] No unsafe `any` usage in new code

## Work Log

### 2025-11-23 - TypeScript Audit Discovery
**By:** Claude Code Review System (kieran-typescript-reviewer agent)
**Actions:**
- Identified `any` default weakening type safety
- Categorized as P1 type safety issue

## Notes

Source: Comprehensive code audit performed on 2025-11-23
