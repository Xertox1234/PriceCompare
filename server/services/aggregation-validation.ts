/**
 * Aggregation Validation Utilities
 *
 * Provides Zod schemas and custom error types for price aggregation validation.
 * Ensures data quality and provides clear error messages for debugging.
 */

import { z } from 'zod';

/**
 * Custom error types for price aggregation
 */
export class AggregationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AggregationError';
  }
}

export class ValidationError extends AggregationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class DataQualityError extends AggregationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATA_QUALITY_ERROR', context);
    this.name = 'DataQualityError';
  }
}

export class AggregationTimeoutError extends AggregationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TIMEOUT_ERROR', context);
    this.name = 'AggregationTimeoutError';
  }
}

/**
 * Zod schemas for aggregation inputs
 */

// Product ID validation (must be positive integer)
export const productIdSchema = z.number().int().positive({
  message: 'Product ID must be a positive integer',
});

// Date range validation
export const dateRangeSchema = z.object({
  startDate: z.date({
    required_error: 'Start date is required',
    invalid_type_error: 'Start date must be a valid Date object',
  }),
  endDate: z.date({
    required_error: 'End date is required',
    invalid_type_error: 'End date must be a valid Date object',
  }),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  }
).refine(
  (data) => {
    const diffDays = (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 365; // Max 1 year range
  },
  {
    message: 'Date range cannot exceed 365 days',
    path: ['endDate'],
  }
);

// Year/week/month validation
export const yearSchema = z.number().int().min(2000).max(2100, {
  message: 'Year must be between 2000 and 2100',
});

export const weekSchema = z.number().int().min(1).max(53, {
  message: 'Week must be between 1 and 53',
});

export const monthSchema = z.number().int().min(1).max(12, {
  message: 'Month must be between 1 and 12',
});

export const daySchema = z.number().int().min(1).max(31, {
  message: 'Day must be between 1 and 31',
});

/**
 * Data quality checks
 */

/**
 * Validate that prices array is not empty and contains valid numbers
 */
export function validatePricesArray(
  prices: number[],
  context: { productId?: number; retailerId?: number; date?: string }
): void {
  if (!Array.isArray(prices)) {
    throw new DataQualityError('Prices must be an array', context);
  }

  if (prices.length === 0) {
    throw new DataQualityError('Cannot aggregate empty prices array', context);
  }

  // Check for invalid prices (negative, NaN, Infinity)
  const invalidPrices = prices.filter(p =>
    typeof p !== 'number' || isNaN(p) || !isFinite(p) || p < 0
  );

  if (invalidPrices.length > 0) {
    throw new DataQualityError(
      `Found ${invalidPrices.length} invalid price(s)`,
      { ...context, invalidPrices: invalidPrices.slice(0, 5) } // Show first 5
    );
  }

  // Check for suspiciously high prices (> $1M)
  const suspiciousPrices = prices.filter(p => p > 1000000);
  if (suspiciousPrices.length > 0) {
    throw new DataQualityError(
      `Found ${suspiciousPrices.length} suspiciously high price(s) (> $1M)`,
      { ...context, suspiciousPrices: suspiciousPrices.slice(0, 5) }
    );
  }
}

/**
 * Validate product and retailer IDs
 */
export function validateProductRetailer(
  productId: number | null | undefined,
  retailerId: number | null | undefined,
  context?: Record<string, unknown>
): { productId: number; retailerId: number } {
  if (!productId || productId <= 0) {
    throw new ValidationError('Invalid product ID', { ...context, productId });
  }

  if (!retailerId || retailerId <= 0) {
    throw new ValidationError('Invalid retailer ID', { ...context, retailerId });
  }

  return { productId, retailerId };
}

/**
 * Validate date is not in the future
 */
export function validateNotFutureDate(date: Date, fieldName: string): void {
  const now = new Date();
  if (date > now) {
    throw new ValidationError(`${fieldName} cannot be in the future`, {
      date: date.toISOString(),
      now: now.toISOString(),
    });
  }
}

/**
 * Validate date range is reasonable (not too far in the past)
 */
export function validateReasonableDateRange(startDate: Date, endDate: Date): void {
  const now = new Date();
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(now.getFullYear() - 10);

  if (startDate < tenYearsAgo) {
    throw new ValidationError('Start date cannot be more than 10 years in the past', {
      startDate: startDate.toISOString(),
      tenYearsAgo: tenYearsAgo.toISOString(),
    });
  }

  validateNotFutureDate(endDate, 'End date');
}
