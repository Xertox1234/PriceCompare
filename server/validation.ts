import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export function validateRequestBody<T>(schema: z.ZodSchema<T>, body: any): ValidationResult<T> {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(err =>
        `${err.path.join('.')}: ${err.message}`
      );
      return { success: false, errors };
    }
    return { success: false, errors: ['Invalid request body'] };
  }
}

/**
 * Validation middleware factory
 * Creates Express middleware that validates request body, query, or params against a Zod schema
 */
export function validateRequest(schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.issues.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      // Replace the original data with validated and sanitized data
      if (source === 'body') {
        req.body = result.data;
      } else if (source === 'query') {
        req.query = result.data as any;
      } else {
        req.params = result.data as any;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Validation error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * Validate multiple parts of the request at once
 */
export function validateMultiple(schemas: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const errors: Array<{ source: string; path: string; message: string }> = [];

      // Validate body
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          errors.push(...result.error.issues.map(err => ({
            source: 'body',
            path: err.path.join('.'),
            message: err.message,
          })));
        } else {
          req.body = result.data;
        }
      }

      // Validate query
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          errors.push(...result.error.issues.map(err => ({
            source: 'query',
            path: err.path.join('.'),
            message: err.message,
          })));
        } else {
          req.query = result.data as any;
        }
      }

      // Validate params
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          errors.push(...result.error.issues.map(err => ({
            source: 'params',
            path: err.path.join('.'),
            message: err.message,
          })));
        } else {
          req.params = result.data as any;
        }
      }

      if (errors.length > 0) {
        res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Validation error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}