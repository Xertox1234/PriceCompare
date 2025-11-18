# React + TypeScript Best Practices Research 2025

This document compiles authoritative best practices for React + TypeScript development based on official documentation, OWASP standards, and recognized industry experts as of 2025.

---

## 1. CSRF Protection in React Applications

### Official Sources
- **OWASP CSRF Prevention Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- **MDN CSRF Security**: https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF
- **React CSRF Protection Guide**: https://www.stackhawk.com/blog/react-csrf-protection-guide-examples-and-how-to-enable-it/

### Key Recommendations

#### Cookie-to-Header Pattern (OWASP Recommended)
The most widely adopted pattern for SPAs in 2025:

1. **Server-side**: Set CSRF token in a cookie accessible via JavaScript (NOT HttpOnly)
   - Cookie name: `XSRF-TOKEN` or `CSRF-TOKEN`
   - Cookie attributes: `SameSite=Lax` or `Strict`, `Secure=true`

2. **Client-side**: Read token from cookie and attach as custom header
   - Header name: `X-XSRF-TOKEN` or `X-CSRF-TOKEN`
   - Include on all state-changing requests (POST, PUT, PATCH, DELETE)

3. **Server-side**: Validate that header token matches cookie token

```typescript
// Fetch wrapper with automatic CSRF protection
async function secureFetch(url: string, options: RequestInit = {}) {
  // Get CSRF token from cookie
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('XSRF-TOKEN='))
    ?.split('=')[1];

  // Add token to headers for state-changing methods
  const method = options.method?.toUpperCase() || 'GET';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    options.headers = {
      ...options.headers,
      'X-XSRF-TOKEN': token || '',
      'Content-Type': 'application/json',
    };
  }

  return fetch(url, options);
}
```

#### SameSite Cookie Defense-in-Depth

**Current Browser Support (2025)**:
- Chrome, Edge, Opera: Default to `SameSite=Lax`
- Firefox, Safari: Still require explicit setting

**SameSite Values**:
- `Strict`: Blocks cookies on all cross-site requests (most secure, but breaks legitimate flows)
- `Lax`: Allows cookies on top-level navigation (GET), blocks CSRF-prone methods (recommended balance)
- `None`: No protection (requires `Secure` flag)

**Critical Note**: SameSite is NOT a complete CSRF defense. OWASP recommends it as "defense-in-depth" alongside anti-CSRF tokens, as it cannot protect against cross-origin, same-site attacks.

#### Layered Defense Strategy (2025 Standard)

1. SameSite cookies (`Lax` or `Strict`)
2. CSRF tokens (cookie-to-header pattern)
3. Custom headers requirement (verify `X-Requested-With` or similar)
4. Content-Type validation (reject non-JSON POST if API expects JSON)
5. Origin/Referer validation

---

## 2. React Hook Performance Optimization

### Official Sources
- **Kent C. Dodds (React Team Alumni)**: https://kentcdodds.com/blog/usememo-and-usecallback
- **React Official Docs**: https://react.dev/reference/react/useMemo
- **React Compiler (2025)**: https://react.dev/learn/react-compiler

### Key Principles

#### When to Use `useMemo`

**DO use for**:
1. Expensive calculations that are synchronously computed
2. Creating objects/arrays passed to `React.memo` components
3. Transforming large datasets
4. Complex derived state

**DON'T use for**:
1. Simple calculations (`a + b`, `a * 2`)
2. Values only used once in render
3. Premature optimization ("just in case")

#### When to Use `useCallback`

**DO use for**:
1. Functions passed to `React.memo` components
2. Functions in `useEffect`/`useMemo` dependency arrays
3. Event handlers in large lists (virtualized lists)
4. Callbacks for debouncing/throttling

**DON'T use for**:
1. Simple event handlers not passed as props
2. Functions not used in dependencies
3. Every function "just in case"

#### Kent C. Dodds' Golden Rule

> "Performance optimizations are not free. They ALWAYS come with a cost but do NOT always come with a benefit to offset that cost."

**Before using `useMemo`/`useCallback`, ask**:
- "Will this actually prevent something expensive from happening?"
- If unsure → DON'T memoize (easier to add later than debug broken memoization)

#### Dependency Array Best Practices

**Rules**:
1. Always include ALL dependencies
2. Use ESLint (`eslint-plugin-react-hooks`) to enforce
3. React uses `Object.is()` for shallow comparison
4. If a variable/function used inside the hook can change, it MUST be in the array

```typescript
// WRONG - missing dependency
useEffect(() => {
  console.log(userId);
}, []); // ESLint error!

// CORRECT
useEffect(() => {
  console.log(userId);
}, [userId]);

// CORRECT - useCallback in dependencies
const handleClick = useCallback(() => {
  console.log(count);
}, [count]);

useEffect(() => {
  handleClick();
}, [handleClick]); // Now safe - handleClick only changes when count changes
```

#### React Compiler (2025-2027 Migration)

React 19 introduced the React Compiler (formerly "React Forget"), which automatically memoizes code at build-time. However:
- Adoption will take 3+ years across the ecosystem
- Knowledge of `useMemo`/`useCallback` remains essential during transition
- Legacy codebases will still require manual optimization

#### Performance Testing First

**Recommended workflow**:
1. Use React DevTools Profiler to identify bottlenecks
2. Measure before optimizing (use `performance.now()` or DevTools)
3. Apply AHA Programming principle (Avoid Hasty Abstractions)
4. Optimize only when "screaming at you"

---

## 3. Input Validation for Financial Applications

### Official Sources
- **Zod Official Docs**: https://zod.dev/
- **React Hook Form + Zod**: https://www.contentful.com/blog/react-hook-form-validation-zod/
- **react-currency-input-field**: https://cchanxzy.github.io/react-currency-input-field/

### Best Practices for Price Inputs

#### Client-Side Libraries (2025)

**Recommended**: `react-currency-input-field` (7.6kB minified, 3.1kB gzipped)
- TypeScript native
- Zero dependencies
- Supports abbreviations (1k → 1,000, 2.5m → 2,500,000)
- Prefix/suffix support (£, $, €)
- Built-in validation helpers

```typescript
import CurrencyInput from 'react-currency-input-field';

<CurrencyInput
  id="price-input"
  name="price"
  placeholder="$0.00"
  defaultValue={0}
  decimalsLimit={2}
  prefix="$"
  onValueChange={(value, name) => {
    console.log(value); // "1234.56"
  }}
/>
```

#### TypeScript Pattern for Number Inputs

```typescript
// Safe number input hook
function useNumberInput(initialValue: number = 0) {
  const [value, setValue] = useState<number>(initialValue);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Handle empty string
    if (inputValue === '') {
      setValue(0);
      return;
    }

    // Convert and validate
    const numValue = Number(inputValue);
    if (!isNaN(numValue)) {
      setValue(numValue);
    }
  };

  return { value, onChange: handleChange, setValue };
}
```

#### Validation with Zod + React Hook Form

**2025 Best Practices**:

1. **Enable TypeScript Strict Mode** (required for Zod)
2. **Define centralized schemas** for reusability
3. **Use type inference** with `z.infer<typeof schema>`
4. **Leverage runtime validation** for client-server consistency

```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Centralized schema
const priceSchema = z.object({
  price: z
    .number({
      required_error: "Price is required",
      invalid_type_error: "Price must be a number",
    })
    .positive("Price must be positive")
    .max(999999.99, "Price too large")
    .multipleOf(0.01, "Price must have max 2 decimal places"),

  currency: z.enum(['USD', 'EUR', 'GBP'], {
    errorMap: () => ({ message: "Invalid currency" }),
  }),
});

// Type inference
type PriceFormData = z.infer<typeof priceSchema>;

// Component usage
function PriceForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<PriceFormData>({
    resolver: zodResolver(priceSchema),
  });

  const onSubmit = (data: PriceFormData) => {
    // data is fully typed and validated
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        type="number"
        step="0.01"
        {...register('price', { valueAsNumber: true })}
      />
      {errors.price && <p>{errors.price.message}</p>}
    </form>
  );
}
```

#### Regex Pattern for Price Validation

```typescript
// Accept only numbers and one decimal point
const pricePattern = /^[0-9]*\.?[0-9]*$/;

// With length constraints
const pricePatternWithMax = /^\d{1,6}(\.\d{1,2})?$/; // Max 6 digits, 2 decimals
```

#### Zod Schema Reusability

**Key advantage**: Use same schema client-side and server-side

```typescript
// shared/schemas/price.ts
export const priceSchema = z.object({
  amount: z.number().positive().max(999999.99),
  currency: z.enum(['USD', 'EUR', 'GBP']),
});

// Client: React form validation
const form = useForm({ resolver: zodResolver(priceSchema) });

// Server: API request validation
app.post('/api/prices', (req, res) => {
  const result = priceSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }
  // Process validated data
});
```

---

## 4. Type Safety: Union Types vs Enums

### Official Sources
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types
- **Tidy TypeScript - Avoid Enums**: https://fettblog.eu/tidy-typescript-avoid-enums/
- **Discriminated Unions**: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions

### Union Types vs Enums: 2025 Consensus

#### **Recommendation: Prefer Union Types by Default**

**Why union types win**:
1. **Zero runtime cost** - Completely erased at compile time
2. **Smaller bundle size** - No generated JavaScript code
3. **Better tree-shaking** - No objects to exclude
4. **More TypeScript-aligned** - Pure type-level construct
5. **Better exhaustiveness checking** - TypeScript detects all cases covered

**When enums still make sense**:
1. Iteration required (need to loop over values)
2. Reverse mapping needed (number → name lookup)
3. Working with numeric constants
4. Legacy codebase consistency

#### Union Type Pattern

```typescript
// RECOMMENDED: String literal union
type NotificationType = 'info' | 'success' | 'warning' | 'error';

// Type-safe function
function showNotification(type: NotificationType) {
  // TypeScript narrows the type
  switch (type) {
    case 'info':
      return 'ℹ️';
    case 'success':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
    // No default needed - TypeScript knows all cases covered
  }
}

// Usage
showNotification('info'); // ✓
showNotification('invalid'); // ✗ TypeScript error
```

#### Enum Pattern (for comparison)

```typescript
// ALTERNATIVE: Enum (generates runtime code)
enum NotificationType {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

// Compiles to JavaScript object (increased bundle size):
var NotificationType;
(function (NotificationType) {
    NotificationType["Info"] = "info";
    NotificationType["Success"] = "success";
    NotificationType["Warning"] = "warning";
    NotificationType["Error"] = "error";
})(NotificationType || (NotificationType = {}));
```

### Discriminated Unions for Notifications

**Best practice for notification systems with different shapes**:

```typescript
// Base notification with discriminator
type BaseNotification = {
  id: string;
  timestamp: Date;
  read: boolean;
};

// Discriminated union with 'type' as discriminator
type Notification =
  | {
      type: 'price_drop';
      productId: number;
      oldPrice: number;
      newPrice: number;
    } & BaseNotification
  | {
      type: 'comment_reply';
      postId: number;
      commentId: number;
      author: string;
    } & BaseNotification
  | {
      type: 'system';
      message: string;
      severity: 'info' | 'warning' | 'error';
    } & BaseNotification;

// Type-safe rendering with exhaustiveness checking
function renderNotification(notification: Notification) {
  switch (notification.type) {
    case 'price_drop':
      return `Price dropped from $${notification.oldPrice} to $${notification.newPrice}`;

    case 'comment_reply':
      return `${notification.author} replied to your comment`;

    case 'system':
      return notification.message;

    default:
      // Exhaustiveness check with 'never'
      const _exhaustive: never = notification;
      throw new Error(`Unhandled notification type: ${_exhaustive}`);
  }
}
```

### Exhaustiveness Checking (TypeScript 4.9+)

**Modern pattern with `satisfies never`**:

```typescript
function handleNotification(notification: Notification) {
  switch (notification.type) {
    case 'price_drop':
      return handlePriceDrop(notification);
    case 'comment_reply':
      return handleCommentReply(notification);
    case 'system':
      return handleSystem(notification);
    default:
      // TypeScript 4.9+ elegant exhaustiveness check
      notification satisfies never;
      throw new Error('Unhandled notification type');
  }
}
```

**Benefits**:
- Compile-time error if new type added without handling
- Forces developers to update all switch statements
- Prevents runtime bugs from unhandled cases

---

## 5. Accessibility: Notification Systems

### Official Sources
- **MDN aria-label**: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label
- **WCAG 2.2** (legal standard as of 2024): 4,605 ADA lawsuits in 2024
- **ARIA 1.3 Specification**: https://www.w3.org/TR/wai-aria-1.3/
- **Sara Soueidan - ARIA Live Regions**: https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/
- **React Aria useToast**: https://react-spectrum.adobe.com/react-aria/useToast.html

### ARIA Live Regions for Toast Notifications

#### Best Practices (2025 Standards)

**1. Use Appropriate ARIA Attributes**

```typescript
// For status/success messages (non-critical)
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  15 records were saved successfully
</div>

// For error/critical messages
<div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
>
  Payment failed. Please try again.
</div>
```

**Key differences**:
- **`polite`**: Waits for user to pause before announcing (recommended for most notifications)
- **`assertive`**: Interrupts immediately (use sparingly for critical errors only)

**Warning**: Assertive mode interrupts everything. If multiple messages appear simultaneously, only the last one will be announced. Prefer `polite` unless truly critical.

#### 2. Live Region Persistence (Critical)

**Anti-pattern** (common mistake):
```typescript
// ❌ WRONG - Dynamically adding/removing live region
{showToast && (
  <div role="alert" aria-live="assertive">
    {message}
  </div>
)}
```

**Correct pattern**:
```typescript
// ✅ CORRECT - Live region always exists in DOM
<div
  role="alert"
  aria-live="assertive"
  style={{
    position: 'absolute',
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden'
  }}
>
  {message}
</div>
```

**Best practice**: Have exactly TWO live regions on page:
- One `polite` region for status updates
- One `assertive` region for critical alerts

Both should be inserted on page load and persist throughout session.

#### 3. Timeout Requirements

**Accessibility standards**:
- **Minimum timeout**: 5 seconds (give users time to read)
- **Interactive toasts**: No auto-dismiss if contains buttons/links
- **Pause on interaction**: Auto-pause timers when user focuses/hovers

```typescript
function useAccessibleToast() {
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<number>();

  const showToast = (message: string, duration = 5000) => {
    // Minimum 5 seconds
    const safeDuration = Math.max(duration, 5000);

    if (!isPaused) {
      timeoutRef.current = window.setTimeout(() => {
        hideToast();
      }, safeDuration);
    }
  };

  return {
    showToast,
    onMouseEnter: () => {
      setIsPaused(true);
      clearTimeout(timeoutRef.current);
    },
    onMouseLeave: () => {
      setIsPaused(false);
      // Resume countdown
    },
  };
}
```

#### 4. ARIA Labels for Icon-Only Buttons

```typescript
// ✅ CORRECT - aria-label for icon button
<button
  onClick={dismissNotification}
  aria-label="Dismiss notification"
>
  <XIcon /> {/* Icon without text */}
</button>

// ❌ WRONG - Screen readers can't understand icon
<button onClick={dismissNotification}>
  <XIcon />
</button>
```

**Hierarchy of labeling** (order of precedence):
1. `aria-labelledby` - References visible text in DOM (preferred if visible label exists)
2. `aria-label` - Provides invisible label (use for icon-only elements)
3. Native text content - Best when feasible
4. `title` attribute - Least preferred (not announced by all screen readers)

#### 5. React Aria Implementation (Recommended)

For production-grade accessibility, use React Aria's `useToast`:

```typescript
import { useToast } from '@react-aria/toast';

// Follows ARIA alertdialog pattern
// Renders in landmark region
// Keyboard and screen reader users can easily jump to announcements
```

#### 6. Reduced Motion Support

```typescript
// Respect user's motion preferences
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<div
  className={prefersReducedMotion ? 'toast-static' : 'toast-animated'}
  role="status"
  aria-live="polite"
>
  {message}
</div>
```

CSS:
```css
@media (prefers-reduced-motion: reduce) {
  .toast-animated {
    animation: none;
    transition: none;
  }
}
```

#### 7. Additional Accessibility Rules

**DO**:
- Use keyboard navigation (Enter/Space to dismiss)
- Provide visible focus indicators
- Ensure sufficient color contrast (WCAG AA: 4.5:1 for text)
- Test with actual screen readers (NVDA, VoiceOver, TalkBack)

**DON'T**:
- Show toasts on page load (wait for user action)
- Use `display: none` or `aria-hidden="true"` on live regions
- Auto-dismiss toasts with actionable content
- Rely solely on color to convey meaning (add icons/text)

---

## 6. Error Boundaries with Sentry Integration

### Official Sources
- **Sentry React Error Boundary**: https://docs.sentry.io/platforms/javascript/guides/react/features/error-boundary/
- **Sentry React Docs**: https://docs.sentry.io/platforms/javascript/guides/react/

### Enhanced Sentry Integration Patterns (2025)

#### Basic Setup with Context and Tags

```typescript
import * as Sentry from '@sentry/react';

function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error} resetError={resetError} />
      )}
      beforeCapture={(scope, error, errorInfo) => {
        // Add custom tags for filtering in Sentry
        scope.setTag('location', 'checkout');
        scope.setTag('feature', 'payment');
        scope.setTag('userType', user?.role || 'anonymous');

        // Add custom context
        scope.setContext('component', {
          name: errorInfo.componentStack,
          props: errorInfo.componentStack,
        });

        scope.setContext('state', {
          cartItems: cart.length,
          totalAmount: cart.total,
        });

        // Set user context
        scope.setUser({
          id: user?.id,
          email: user?.email,
          username: user?.username,
        });

        // Add breadcrumbs
        scope.addBreadcrumb({
          category: 'ui.click',
          message: 'User clicked checkout button',
          level: 'info',
        });
      }}
      showDialog={false} // Don't show default dialog
      onError={(error, componentStack, eventId) => {
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
          console.error('Error caught by boundary:', error);
          console.error('Component stack:', componentStack);
        }

        // Custom analytics
        analytics.trackError({
          errorId: eventId,
          errorMessage: error.message,
        });
      }}
    >
      <Routes />
    </Sentry.ErrorBoundary>
  );
}
```

#### Multiple Error Boundaries for Granular Tracking

```typescript
// App-level boundary
<Sentry.ErrorBoundary
  beforeCapture={(scope) => {
    scope.setTag('boundary', 'app-root');
  }}
  fallback={<AppErrorFallback />}
>
  {/* Feature-level boundary */}
  <Sentry.ErrorBoundary
    beforeCapture={(scope) => {
      scope.setTag('boundary', 'checkout-flow');
      scope.setTag('feature', 'checkout');
    }}
    fallback={<CheckoutErrorFallback />}
  >
    <CheckoutPage />
  </Sentry.ErrorBoundary>
</Sentry.ErrorBoundary>
```

#### Custom Error Boundary with Sentry

For more control, create custom class component:

```typescript
import React, { Component, ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: React.ReactNode;
  fallback: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class CustomErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Send to Sentry with full context
    Sentry.withScope((scope) => {
      // Add React-specific context
      scope.setContext('react', {
        componentStack: errorInfo.componentStack,
      });

      // Add custom tags
      scope.setTag('error_boundary', 'custom');

      // Capture exception
      Sentry.captureException(error);
    });

    // Log to console in dev
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught:', error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}
```

#### Key Features (2025)

1. **Automatic sourcemap support** - Sentry unmangles production errors
2. **Component stack traces** - See exactly which component tree failed
3. **Release tracking** - Tag errors with release versions
4. **Breadcrumbs** - Track user actions leading to error
5. **User context** - Know which users are affected

#### Testing Error Boundaries

**Important**: React rethrows errors in development mode, which can interfere with error boundary testing.

```typescript
// Test in production build
npm run build
npm start

// Or disable React's error rethrowing in tests
if (process.env.NODE_ENV === 'test') {
  // Error boundaries work normally in test mode
}
```

---

## 7. React Query: Multiple Queries Best Practices

### Official Sources
- **TanStack Query Docs**: https://tanstack.com/query/latest/docs/react/guides/parallel-queries
- **React Query v5**: Latest version as of 2025

### Parallel Queries Patterns

#### 1. Fixed Number of Queries (Simple)

When query count doesn't change between renders:

```typescript
function Dashboard() {
  // Multiple useQuery hooks in parallel
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  // Handle loading states
  if (usersQuery.isLoading || productsQuery.isLoading || ordersQuery.isLoading) {
    return <Loading />;
  }

  // Handle errors
  const error = usersQuery.error || productsQuery.error || ordersQuery.error;
  if (error) {
    return <Error error={error} />;
  }

  return (
    <div>
      <Users data={usersQuery.data} />
      <Products data={productsQuery.data} />
      <Orders data={ordersQuery.data} />
    </div>
  );
}
```

**Note**: This pattern breaks in Suspense mode (first query suspends before others execute).

#### 2. Dynamic Number of Queries (useQueries Hook)

For variable query counts, use `useQueries`:

```typescript
function UserProfiles({ userIds }: { userIds: number[] }) {
  const userQueries = useQueries({
    queries: userIds.map((id) => ({
      queryKey: ['user', id],
      queryFn: () => fetchUserById(id),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })),
  });

  // Check if any query is loading
  const isLoading = userQueries.some((query) => query.isLoading);

  // Check if all queries succeeded
  const isSuccess = userQueries.every((query) => query.isSuccess);

  // Get all errors
  const errors = userQueries
    .filter((query) => query.isError)
    .map((query) => query.error);

  if (isLoading) return <Loading />;
  if (errors.length > 0) return <Errors errors={errors} />;

  return (
    <div>
      {userQueries.map((query, index) => (
        <UserCard key={userIds[index]} user={query.data} />
      ))}
    </div>
  );
}
```

#### 3. Wrap in Custom Hooks (Recommended)

Encapsulate query logic for reusability:

```typescript
// Custom hook for dashboard data
function useDashboardData() {
  const queries = useQueries({
    queries: [
      {
        queryKey: ['users'],
        queryFn: fetchUsers,
      },
      {
        queryKey: ['products'],
        queryFn: fetchProducts,
      },
      {
        queryKey: ['stats'],
        queryFn: fetchStats,
      },
    ],
  });

  return {
    users: queries[0].data,
    products: queries[1].data,
    stats: queries[2].data,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    errors: queries.filter((q) => q.isError).map((q) => q.error),
  };
}

// Clean component usage
function Dashboard() {
  const { users, products, stats, isLoading, isError } = useDashboardData();

  if (isLoading) return <Loading />;
  if (isError) return <Error />;

  return <DashboardUI users={users} products={products} stats={stats} />;
}
```

#### 4. Dependent Queries

When one query depends on another's result:

```typescript
function UserPosts({ userId }: { userId: number }) {
  // First query - fetch user
  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  // Second query - depends on first
  const postsQuery = useQuery({
    queryKey: ['posts', userId],
    queryFn: () => fetchUserPosts(userId),
    enabled: !!userQuery.data, // Only run when user data exists
  });

  if (userQuery.isLoading) return <Loading />;
  if (userQuery.isError) return <Error error={userQuery.error} />;

  return (
    <div>
      <UserHeader user={userQuery.data} />
      {postsQuery.isLoading ? (
        <PostsLoading />
      ) : (
        <Posts data={postsQuery.data} />
      )}
    </div>
  );
}
```

#### 5. Handling Loading States (Best Practices)

```typescript
function MultiQueryComponent() {
  const results = useQueries({
    queries: [
      { queryKey: ['data1'], queryFn: fetchData1 },
      { queryKey: ['data2'], queryFn: fetchData2 },
      { queryKey: ['data3'], queryFn: fetchData3 },
    ],
  });

  // Different loading state strategies:

  // Wait for ALL queries to finish
  const allLoaded = results.every((result) => result.isSuccess);

  // Show partial data as it loads
  const someLoaded = results.some((result) => result.isSuccess);

  // Progressive loading
  return (
    <div>
      {results[0].data && <Section1 data={results[0].data} />}
      {results[1].data && <Section2 data={results[1].data} />}
      {results[2].data && <Section3 data={results[2].data} />}
    </div>
  );
}
```

#### 6. Suspense Mode (React 18+)

For Suspense compatibility, MUST use `useQueries`:

```typescript
import { Suspense } from 'react';
import { useQueries } from '@tanstack/react-query';

function SuspenseComponent() {
  const results = useQueries({
    queries: [
      {
        queryKey: ['data1'],
        queryFn: fetchData1,
        suspense: true, // Enable Suspense
      },
      {
        queryKey: ['data2'],
        queryFn: fetchData2,
        suspense: true,
      },
    ],
  });

  // In Suspense mode, this only renders when ALL queries are ready
  return <div>{/* Render with data */}</div>;
}

// Wrap with Suspense boundary
function App() {
  return (
    <Suspense fallback={<Loading />}>
      <SuspenseComponent />
    </Suspense>
  );
}
```

#### 7. Performance Optimizations

```typescript
// Enable background refetching
const queries = useQueries({
  queries: data.map((item) => ({
    queryKey: ['item', item.id],
    queryFn: () => fetchItem(item.id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false, // Disable refetch on window focus
  })),
});

// Prefetch queries for better UX
const queryClient = useQueryClient();

function prefetchUserData(userId: number) {
  queryClient.prefetchQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });
}
```

---

## Summary of Key Takeaways

### CSRF Protection
- Use cookie-to-header pattern (OWASP recommended)
- Layer defenses: SameSite + CSRF tokens + custom headers
- Create reusable fetch wrapper

### React Hooks
- Don't optimize prematurely - measure first
- Use ESLint to enforce dependency arrays
- Ask "Will this prevent something expensive?" before memoizing
- React Compiler will automate this (but not for 3+ years)

### Input Validation
- Use Zod + React Hook Form for type-safe validation
- Centralize schemas for client/server reuse
- Leverage `react-currency-input-field` for financial inputs
- Enable TypeScript strict mode

### Type Safety
- Prefer union types over enums (zero runtime cost)
- Use discriminated unions for complex states
- Implement exhaustiveness checking with `never`
- TypeScript 4.9+: `value satisfies never`

### Accessibility
- Use persistent live regions (don't dynamically add/remove)
- Minimum 5-second timeout for toasts
- Pause timers on focus/hover
- Respect `prefers-reduced-motion`
- Test with real screen readers

### Error Boundaries
- Use `beforeCapture` to add context and tags
- Implement multiple boundaries for granular tracking
- Test in production builds (React rethrows in dev)
- Leverage Sentry's sourcemap support

### React Query
- Use `useQueries` for dynamic query counts
- Wrap queries in custom hooks for reusability
- Handle loading states strategically (all, some, progressive)
- Use `enabled` option for dependent queries
- Suspense mode requires `useQueries`

---

## Additional Resources

### Official Documentation
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [React Official Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Zod Documentation](https://zod.dev/)
- [Sentry React SDK](https://docs.sentry.io/platforms/javascript/guides/react/)
- [ARIA 1.3 Specification](https://www.w3.org/TR/wai-aria-1.3/)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)

### Industry Experts
- [Kent C. Dodds Blog](https://kentcdodds.com/blog)
- [Sara Soueidan (Accessibility)](https://www.sarasoueidan.com/blog/)
- [React Spectrum (Adobe)](https://react-spectrum.adobe.com/react-aria/)

### Testing Tools
- **Screen Readers**: NVDA (Windows), VoiceOver (Mac), TalkBack (Android)
- **React DevTools**: Profiler for performance analysis
- **Sentry**: Error monitoring and tracking
- **ESLint**: `eslint-plugin-react-hooks` for dependency array enforcement

---

*Research compiled: November 2025*
*Next review recommended: May 2026*
