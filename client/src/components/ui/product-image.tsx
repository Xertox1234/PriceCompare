import { useState, useCallback } from 'react';
import { cn, getProductImageUrl, handleImageError } from '@/lib/utils';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/constants';
import { Skeleton } from './skeleton';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallback?: string;
  showSkeleton?: boolean;
}

/**
 * Product image component with built-in fallback handling
 *
 * Usage:
 * <ProductImage src={product.image} alt={product.name} className="h-48 w-full object-cover" />
 */
export function ProductImage({
  src,
  alt,
  className = '',
  containerClassName = '',
  fallback = DEFAULT_PRODUCT_IMAGE,
  showSkeleton = true,
}: ProductImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const imageSrc = hasError ? fallback : getProductImageUrl(src);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      setHasError(true);
      setIsLoading(false);
      handleImageError(event, fallback);
    },
    [fallback]
  );

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      {showSkeleton && isLoading && <Skeleton className="absolute inset-0 h-full w-full" />}
      <img
        src={imageSrc}
        alt={alt}
        className={cn(
          'transition-opacity duration-200',
          isLoading ? 'opacity-0' : 'opacity-100',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
}
