import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /**
   * Size variant for the spinner
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Optional text to display below the spinner
   */
  message?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * LoadingSpinner - A reusable loading indicator for lazy-loaded components
 * 
 * Used as the fallback for React.Suspense when code-splitting routes.
 * Provides visual feedback during chunk loading.
 * 
 * @example
 * ```tsx
 * <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
 *   <LazyLoadedPage />
 * </Suspense>
 * ```
 */
export function LoadingSpinner({ 
  size = 'md', 
  message,
  className 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div 
      className={cn(
        'flex flex-col items-center justify-center min-h-[200px]',
        className
      )}
      role="status"
      aria-label={message || 'Loading...'}
    >
      <Loader2 
        className={cn(
          'animate-spin text-primary',
          sizeClasses[size]
        )} 
      />
      {message && (
        <span className="mt-3 text-sm text-muted-foreground">
          {message}
        </span>
      )}
    </div>
  );
}

/**
 * PageLoadingFallback - Full-page loading skeleton for route transitions
 * 
 * Matches the layout structure to minimize layout shift when the actual
 * page content loads.
 */
export function PageLoadingFallback() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page title skeleton */}
      <Skeleton className="h-8 w-48 mb-6" />
      
      {/* Content grid skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * ChartLoadingFallback - Skeleton for chart components
 * 
 * Used when lazy-loading chart-heavy pages like analytics and price history.
 */
export function ChartLoadingFallback() {
  return (
    <div className="space-y-6">
      {/* Chart title */}
      <Skeleton className="h-6 w-40" />
      
      {/* Chart area */}
      <Skeleton className="h-[300px] w-full rounded-xl" />
      
      {/* Legend */}
      <div className="flex gap-4 justify-center">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

/**
 * ProductGridLoadingFallback - Skeleton for product grid pages
 */
export function ProductGridLoadingFallback() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-4 w-32 mb-6" />
      
      {/* Title skeleton */}
      <Skeleton className="h-10 w-64 mb-8" />
      
      {/* Filter bar skeleton */}
      <div className="flex gap-4 mb-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      
      {/* Product grid skeleton */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default LoadingSpinner;
