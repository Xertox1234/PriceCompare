import type { Request, Response, NextFunction } from 'express';

export function cacheMiddleware(duration = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Don't cache authenticated requests
    if (req.user) {
      return next();
    }

    // Set cache headers
    res.setHeader('Cache-Control', `public, max-age=${duration}`);
    res.setHeader('Vary', 'Accept-Encoding');

    next();
  };
}

export function apiCacheMiddleware(req: Request, res: Response, next: NextFunction) {
  // Cache public API endpoints for 5 minutes
  if (req.path.startsWith('/api/products') || req.path.startsWith('/api/retailers')) {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  }

  next();
}
