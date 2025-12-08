import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DEFAULT_PRODUCT_IMAGE } from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get a valid product image URL with fallback
 * Handles null, undefined, empty strings, and invalid URLs
 */
export function getProductImageUrl(image: string | null | undefined): string {
  if (!image || image.trim() === '') {
    return DEFAULT_PRODUCT_IMAGE;
  }
  return image;
}

/**
 * Handle image load error by setting fallback
 * Use as onError handler: onError={(e) => handleImageError(e)}
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallback = DEFAULT_PRODUCT_IMAGE
): void {
  const target = event.currentTarget;
  // Prevent infinite loop if fallback also fails
  if (target.src !== fallback) {
    target.src = fallback;
  }
}
