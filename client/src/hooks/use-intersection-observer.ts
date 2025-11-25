import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Generic intersection observer hook that detects when an element enters the viewport
 *
 * @template T - The element type to observe (defaults to HTMLElement)
 * @param options - Configuration options for the observer
 * @returns Object containing a ref for the target element and intersection state
 *
 * @example
 * // For a div element
 * const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
 *   threshold: 0.5,
 *   triggerOnce: true
 * });
 *
 * return <div ref={ref}>{isIntersecting && <Content />}</div>;
 */
export function useIntersectionObserver<T extends Element = HTMLElement>({
  threshold = 0,
  rootMargin = '0px',
  triggerOnce = true,
}: UseIntersectionObserverOptions = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const targetRef = useRef<T>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        
        if (isVisible && !hasTriggered) {
          setIsIntersecting(true);
          if (triggerOnce) {
            setHasTriggered(true);
          }
        } else if (!triggerOnce) {
          setIsIntersecting(isVisible);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce, hasTriggered]);

  return { ref: targetRef, isIntersecting };
}