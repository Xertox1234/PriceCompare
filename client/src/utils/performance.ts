// Performance monitoring utilities
export function measurePerformance(name: string, fn: () => void) {
  if (typeof window === 'undefined') return fn();
  
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`${name} took ${end - start} milliseconds`);
  }
  
  return result;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Bundle size monitoring
export function reportBundleSize() {
  if (typeof window === 'undefined') return;
  
  // Use navigation API to get resource timing
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const jsResources = resources.filter(r => r.name.includes('.js'));
  
  const totalSize = jsResources.reduce((sum, resource) => {
    return sum + (resource.transferSize || 0);
  }, 0);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`Total JS bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
  }
}

// Core Web Vitals monitoring
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return;
  
  // Largest Contentful Paint
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1] as PerformanceEventTiming;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('LCP:', lastEntry.startTime);
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] });
  
  // First Input Delay
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('FID:', (entry as any).processingStart - entry.startTime);
      }
    });
  }).observe({ entryTypes: ['first-input'] });
}