# TODO 268: Fix Browser Memory Leak Risk in Extraction Agent

**Priority**: P1 (CRITICAL - Memory Leak)
**File(s)**: `server/agents/extraction-agent.ts`
**Estimated Time**: 1 hour
**Status**: Not Started
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

The extraction agent stores browser instance on class property (`this.browser`) but only cleans up in the `finally` block. If `newContext()` fails after browser launch, the browser instance leaks.

## Root Cause

Lines 253-256 launch browser and assign to instance property. Lines 258-271 create context which can throw. If context creation fails, the browser is never closed because the finally block assumes context exists.

## Evidence

```typescript
// Lines 253-256 - Browser assigned to instance property
this.browser = await chromium.launch({
  headless: true,
  args: [...SCRAPER.BROWSER_ARGS],
});

// Lines 258-271 - Context creation can fail AFTER browser is assigned
const context = await this.browser.newContext({...}); // Can throw!

// Lines 361-366 - cleanup only happens if context exists
try {
  // ... extraction code
} finally {
  await context.close();  // context may not exist!
  await this.browser.close();
  this.browser = null;
}
```

## Impact

Memory growth of ~50-100MB per leaked browser instance. At scale with retry logic (3 retries per task), could cause OOM within hours under load.

## Solution Approach

Restructure to use local browser variable and wrap browser launch + context creation in outer try-finally.

## Implementation Steps

### Step 1: Refactor Browser Lifecycle

- [ ] Remove `this.browser` class property (line 61)
- [ ] Use local `browser` variable in `extractProductData`
- [ ] Wrap entire browser lifecycle in try-finally

## Technical Details

```typescript
private async extractProductData(
  url: string,
  retailerDomain: string
): Promise<ExtractedProductData> {
  // ... validation code ...

  // Use local variable, not class property
  const browser = await chromium.launch({
    headless: true,
    args: [...SCRAPER.BROWSER_ARGS],
  });

  try {
    const context = await browser.newContext({
      userAgent: '...',
      viewport: { width: 1920, height: 1080 },
      // ... options
    });

    try {
      const page = await context.newPage();
      // ... extraction code ...
      return extractedData;
    } finally {
      await context.close();
    }
  } finally {
    // Browser ALWAYS closed, even if context creation fails
    await browser.close();
  }
}
```

## Checklist

- [ ] Remove `private browser: Browser | null` class property
- [ ] Refactor to nested try-finally pattern
- [ ] Add test for context creation failure scenario
- [ ] Verify no regression in extraction tests

## Success Criteria

- [ ] Browser always closed even when context creation fails
- [ ] No memory growth under repeated extraction failures
- [ ] All existing extraction tests pass
- [ ] TypeScript compiles without errors

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: performance-oracle, code-simplicity-reviewer
