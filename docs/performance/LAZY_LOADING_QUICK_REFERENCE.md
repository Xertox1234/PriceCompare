# Lazy Loading Quick Reference

**Quick guide for implementing lazy loading patterns in PriceCompare**

## When to Use Lazy Loading

✅ **DO lazy load:**
- Chart components (Recharts - 367KB)
- Below-the-fold content
- Modal/dialog content
- Admin-only features
- Heavy third-party libraries

❌ **DON'T lazy load:**
- Critical above-fold content
- Small components (<10KB)
- Components used on every page
- Navigation/header/footer

## Pattern: Lazy + Suspense + Error Boundary

### 1. Create Lazy Export (`components/lazy/index.ts`)

```typescript
export const LazyMyComponent = lazy(() =>
  import('./MyComponent').then((m) => ({ default: m.MyComponent }))
);
```

### 2. Create Loading Fallback

```typescript
function MyComponentSkeleton() {
  return (
    <Card className="p-6">
      <Skeleton className="h-[400px] w-full" />
    </Card>
  );
}
```

### 3. Use with Suspense

```typescript
import { Suspense } from 'react';
import { LazyMyComponent } from '@/components/lazy';

function MyPage() {
  return (
    <Suspense fallback={<MyComponentSkeleton />}>
      <LazyMyComponent {...props} />
    </Suspense>
  );
}
```

## Pattern: Conditional Lazy Loading

### When to Use
Component only needed in specific scenarios (e.g., expandable sections, tabs)

```typescript
function ProductPage() {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  return (
    <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
      <CollapsibleTrigger>View Analytics</CollapsibleTrigger>
      <CollapsibleContent>
        {analyticsOpen && (
          <Suspense fallback={<ChartSkeleton />}>
            <LazyAnalyticsChart {...props} />
          </Suspense>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

## Pattern: Conditional React Query

### Disable queries until component renders

```typescript
const [sectionOpen, setSectionOpen] = useState(false);

// Query auto-disables when ID is undefined
const { data } = useMyQuery(
  sectionOpen ? id : undefined,
  { staleTime: 5 * 60 * 1000 }
);
```

## Error Boundary Template

```typescript
import { Component, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6">
          <div className="text-center">
            <h3>Failed to load component</h3>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}
```

## Bundle Size Verification

### Check bundle splitting

```bash
cd client && npm run build | grep -E "vendor-|Lazy|\.js"
```

### Expected output

```
LazyMyComponent-abc123.js      50 kB  # Separate chunk ✅
vendor-charts-xyz789.js       367 kB  # Recharts isolated ✅
index-main.js                 597 kB  # Main bundle ✅
```

## Common Mistakes

### ❌ WRONG: Lazy loading critical content

```typescript
// Don't lazy load header/navigation
export const LazyHeader = lazy(() => import('./Header'));
```

### ❌ WRONG: Missing Suspense boundary

```typescript
// Error: lazy() requires Suspense
<LazyMyComponent {...props} />
```

### ❌ WRONG: Always rendering lazy component

```typescript
// Component still in main bundle!
<Suspense fallback={<Loading />}>
  <LazyChart {...props} />
</Suspense>
```

### ✅ CORRECT: Conditional rendering

```typescript
{showChart && (
  <Suspense fallback={<Loading />}>
    <LazyChart {...props} />
  </Suspense>
)}
```

## Performance Metrics

### Monitor in production

1. **Bundle sizes** (Vite output):
   - Main bundle trend
   - Individual chunk sizes

2. **Load times** (DevTools Network tab):
   - Time to first byte (TTFB)
   - First contentful paint (FCP)
   - Time to interactive (TTI)

3. **Chunk load failures** (Error logs):
   - Network errors
   - Browser compatibility issues

## References

- **Full guide**: `/docs/performance/LAZY_LOADING_IMPLEMENTATION.md`
- **React docs**: https://react.dev/reference/react/lazy
- **Vite docs**: https://vitejs.dev/guide/features.html#code-splitting
