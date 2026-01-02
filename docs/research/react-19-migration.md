# React 19 Migration Guide

## Overview

This document outlines the patterns, changes, and best practices for upgrading to React 19, based on our successful migration from React 18.3.1 to React 19.2.0.

## Migration Checklist

### 1. Pre-Migration Analysis

Before upgrading, verify your codebase doesn't use deprecated patterns:

- ✅ **No `propTypes` or `defaultProps`** in function components
- ✅ **No string refs** (e.g., `ref="myRef"`)
- ✅ **No `React.createFactory`**
- ✅ **No Legacy Context API** (`contextTypes`, `getChildContext`)
- ✅ **Using `createRoot`** instead of `ReactDOM.render`
- ✅ **No `ReactDOM.hydrate`** (use `hydrateRoot`)

### 2. Package Updates

```bash
# Core React packages
npm install --save-exact react@^19.0.0 react-dom@^19.0.0

# TypeScript type definitions
npm install --save-exact --save-dev @types/react@^19.0.0 @types/react-dom@^19.0.0

# Testing dependencies (if needed)
npm install --save-dev @testing-library/dom --legacy-peer-deps
```

**Note**: Use `--legacy-peer-deps` for packages that haven't updated their peer dependencies yet (e.g., `react-helmet-async`). These packages still work correctly with React 19.

### 3. Required Code Changes

#### Pattern 1: `act` Import Migration

**Before (React 18):**
```typescript
import { renderHook, act } from '@testing-library/react'
```

**After (React 19):**
```typescript
import { renderHook } from '@testing-library/react'
import { act } from 'react'
```

**Why**: In React 19, `act` is a core React utility and should be imported directly from the `react` package.

**Files to check**:
- All test files using `act`
- Custom test utilities

#### Pattern 2: Test Utilities Export Pattern

**Before:**
```typescript
import { render, RenderOptions } from '@testing-library/react'

export * from '@testing-library/react'
export { customRender as render }
```

**After:**
```typescript
import { render, RenderOptions, screen, fireEvent, waitFor } from '@testing-library/react'

export * from '@testing-library/react'
export { customRender as render, screen, fireEvent, waitFor }
```

**Why**: Explicitly export commonly used testing utilities to ensure proper module resolution with React 19.

**Location**: `client/src/test/test-utils.tsx`

#### Pattern 3: forwardRef Usage (Optional)

React 19 allows `ref` as a regular prop in function components, making `forwardRef` optional for new code.

**Old Pattern (Still Works):**
```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return <button ref={ref} className={className} {...props} />
  }
)
```

**New Pattern (React 19+):**
```typescript
function Button({ className, ref, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} className={className} {...props} />
}
```

**Note**: Existing `forwardRef` code continues to work in React 19. Migration is optional and can be done incrementally.

## Breaking Changes

### 1. Error Handling

**Change**: Uncaught errors are now reported to `window.reportError` instead of being re-thrown.

**Impact**: Low - Most applications won't need changes unless they have custom error handling logic.

### 2. Removed APIs

The following APIs have been completely removed:

- `propTypes` (use TypeScript or another type checker)
- `defaultProps` for function components (use ES6 default parameters)
- Legacy Context API (`contextTypes`, `getChildContext`)
- String refs (use ref callbacks or `useRef`)
- `React.createFactory` (use JSX)
- `ReactDOM.render` (use `createRoot`)
- `ReactDOM.hydrate` (use `hydrateRoot`)
- `ReactDOM.findDOMNode` (use DOM refs)

### 3. Testing Changes

- `act` must be imported from `react` or `react-dom/test-utils`, not from `@testing-library/react`
- `react-test-renderer` is deprecated (migrate to React Testing Library)

## TypeScript Considerations

### Type Changes in React 19

1. **`useRef` now requires an argument**
   ```typescript
   // React 18
   const ref = useRef()

   // React 19
   const ref = useRef<HTMLElement>(null)
   ```

2. **Better type inference for `useReducer`**
   - Types are automatically inferred from initial state
   - Less manual type annotation needed

3. **Ref callbacks must use block statements**
   ```typescript
   // Not allowed
   <div ref={el => doSomething(el)} />

   // Allowed
   <div ref={(el) => { doSomething(el) }} />
   ```

## Configuration Updates

### Vitest Configuration

Ensure test setup file path is correct:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./client/src/test/setup.ts'], // Correct path
  },
})
```

### TypeScript Configuration

No changes required for basic React 19 support. The new JSX transform (enabled by default in modern setups) is mandatory.

## Common Issues & Solutions

### Issue 1: Peer Dependency Warnings

**Problem**: Some packages show peer dependency warnings for React 18.

**Solution**: Use `--legacy-peer-deps` flag. These packages work correctly with React 19 despite the warnings.

```bash
npm install --legacy-peer-deps
```

### Issue 2: Testing Library Not Found

**Problem**: `Cannot find module '@testing-library/dom'`

**Solution**: Install as a dev dependency:

```bash
npm install --save-dev @testing-library/dom
```

### Issue 3: `act` Import Errors

**Problem**: Tests fail with "act is not exported from @testing-library/react"

**Solution**: Import `act` from `react`:

```typescript
import { act } from 'react'
```

## Performance Improvements in React 19

React 19 includes several performance optimizations:

1. **Faster Suspense fallbacks** - Sibling renders are pre-warmed
2. **Improved StrictMode** - `useMemo` and `useCallback` reuse memoized results during double render
3. **Better memory efficiency** - Removed legacy code paths

## Migration Verification

After upgrading, verify the migration was successful:

```bash
# 1. Type checking
npm run check

# 2. Run tests
npm test

# 3. Build for production
npm run build

# 4. Manual testing
npm run dev
```

## Best Practices for React 19

1. **Use `createRoot` for all new code**
   ```typescript
   import { createRoot } from 'react-dom/client'

   createRoot(document.getElementById('root')!).render(<App />)
   ```

2. **Prefer `useRef` with proper typing**
   ```typescript
   const buttonRef = useRef<HTMLButtonElement>(null)
   ```

3. **Use modern Context API**
   ```typescript
   const MyContext = createContext<MyContextType>(defaultValue)
   ```

4. **Leverage automatic batching**
   - React 19 automatically batches updates in all scenarios
   - No need for manual `unstable_batchedUpdates`

5. **Use Error Boundaries for error handling**
   ```typescript
   <ErrorBoundary fallback={<ErrorUI />}>
     <App />
   </ErrorBoundary>
   ```

## Gradual Migration Strategy

For large codebases, consider this phased approach:

### Phase 1: Preparation (No Breaking Changes)
- Audit codebase for deprecated patterns
- Update to React 18.3 first (includes deprecation warnings)
- Fix all deprecation warnings

### Phase 2: Update Dependencies
- Update React and React DOM
- Update TypeScript types
- Install any missing peer dependencies

### Phase 3: Fix Breaking Changes
- Update `act` imports in tests
- Fix any TypeScript errors
- Update test utilities

### Phase 4: Verification
- Run full test suite
- Perform smoke testing
- Monitor production for issues

### Phase 5: Optimization (Optional)
- Refactor `forwardRef` to use ref props
- Take advantage of new React 19 features
- Update documentation

## Resources

- [Official React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [React 19 Release Blog Post](https://react.dev/blog/2024/12/05/react-19)
- [React Testing Library Migration](https://testing-library.com/docs/react-testing-library/migrate-from-enzyme)

## Codebase-Specific Notes

### Our Migration Stats

- **React Version**: 18.3.1 → 19.2.0
- **Files Modified**: 5
- **Breaking Changes Required**: 2
  1. `act` import in test file
  2. Test utilities export pattern
- **Tests**: ✅ All passing
- **Build**: ✅ Successful
- **forwardRef Usage**: 88 instances across 24 files (no changes required)

### Dependencies Using `--legacy-peer-deps`

The following packages required `--legacy-peer-deps` but work correctly:

- `react-helmet-async@2.0.5` (requires React ^16.6.0 || ^17.0.0 || ^18.0.0)

Monitor these packages for React 19 peer dependency updates.

## Conclusion

React 19 is a smooth upgrade if your codebase follows modern React patterns. The key is thorough preparation:

1. ✅ Audit for deprecated patterns before upgrading
2. ✅ Update dependencies systematically
3. ✅ Fix breaking changes (primarily testing-related)
4. ✅ Verify with comprehensive testing
5. ✅ Take advantage of new features gradually

Our migration took approximately 4 minutes with minimal code changes, demonstrating the stability of React 19's upgrade path.
