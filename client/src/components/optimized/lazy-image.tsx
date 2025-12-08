import { useState, useCallback } from 'react';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
  placeholder?: React.ReactNode;
}

export function LazyImage({
  src,
  alt,
  className = '',
  fallback = '/api/placeholder/300/200',
  placeholder,
}: LazyImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    triggerOnce: true,
    rootMargin: '50px',
  });

  const handleLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const shouldLoad = isIntersecting;
  const imageSrc = imageError ? fallback : src;

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {shouldLoad ? (
        <>
          <img
            src={imageSrc}
            alt={alt}
            className={`transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            } ${className}`}
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
          />
          {!imageLoaded && (
            <div className="absolute inset-0">
              {placeholder || <Skeleton className="h-full w-full" />}
            </div>
          )}
        </>
      ) : (
        <div className="h-full w-full">{placeholder || <Skeleton className="h-full w-full" />}</div>
      )}
    </div>
  );
}
