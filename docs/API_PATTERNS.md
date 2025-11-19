# API & Route Patterns

This document codifies API and route patterns to ensure consistent, secure, and maintainable endpoints in the PriceCompare codebase.

## Table of Contents
- [Route Organization](#route-organization)
- [Middleware Pipeline](#middleware-pipeline)
- [Request Validation](#request-validation)
- [Response Patterns](#response-patterns)
- [Authentication & Authorization](#authentication--authorization)
- [Pagination Patterns](#pagination-patterns)
- [File Upload Patterns](#file-upload-patterns)
- [Caching Patterns](#caching-patterns)
- [Rate Limiting](#rate-limiting)
- [API Versioning](#api-versioning)

---

## Route Organization

### File Structure Pattern

#### ✅ CORRECT - Modular Route Files
```typescript
// server/routes/index.ts - Central registration
import { Express } from 'express';
import { registerAuthRoutes } from './auth-routes';
import { registerProductRoutes } from './product-routes';
import { registerAdminRoutes } from './admin-routes';

export function registerRoutes(app: Express) {
  // Health check first (no auth)
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Register route modules
  registerAuthRoutes(app);
  registerProductRoutes(app);
  registerAdminRoutes(app);

  // 404 handler last
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// server/routes/product-routes.ts - Domain-specific routes
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { csrfProtection } from '../middleware/security';
import { validateRequest } from '../middleware/validation';
import { productSchema } from '@shared/schema';

export function registerProductRoutes(app: Express) {
  const router = Router();

  // Public routes
  router.get('/products', getProducts);
  router.get('/products/:id', getProduct);

  // Protected routes
  router.post('/products',
    requireAuth,
    csrfProtection,
    validateRequest(productSchema),
    createProduct
  );

  router.put('/products/:id',
    requireAuth,
    csrfProtection,
    validateRequest(productSchema.partial()),
    updateProduct
  );

  router.delete('/products/:id',
    requireAuth,
    requireAdmin,
    csrfProtection,
    deleteProduct
  );

  app.use('/api', router);
}
```

### Storage Layer Pattern

#### ❌ WRONG - Direct DB Access in Routes
```typescript
// THIS WILL TRIGGER PRE-COMMIT WARNING!
import { db } from '../db';

router.get('/api/products/:id', async (req, res) => {
  // Direct database access in route - BAD!
  const product = await db.select()
    .from(products)
    .where(eq(products.id, id));
  res.json(product);
});
```

#### ✅ CORRECT - Use Storage Abstraction
```typescript
// server/storage.ts - Database abstraction layer
export interface IStorage {
  getProductById(id: number): Promise<Product | null>;
  createProduct(data: CreateProductInput): Promise<Product>;
  updateProduct(id: number, data: UpdateProductInput): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
}

export class Storage implements IStorage {
  async getProductById(id: number): Promise<Product | null> {
    const [product] = await db.select({
      id: products.id,
      name: products.name,
      price: products.price,
      // Explicit field selection
    }).from(products)
      .where(eq(products.id, id))
      .limit(1);

    return product || null;
  }
  // ... other methods
}

export const storage = new Storage();

// server/routes/product-routes.ts - Route using storage
import { storage } from '../storage';

router.get('/api/products/:id', async (req, res) => {
  const id = parseIntSafe(req.params.id, 'productId');
  const product = await storage.getProductById(id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(product);
});
```

---

## Middleware Pipeline

### Correct Middleware Order (CRITICAL)

#### ✅ CORRECT - Proper Pipeline Order
```typescript
// server/index.ts
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import passport from 'passport';

const app = express();

// 1. Request tracking / monitoring (FIRST!)
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// 2. Compression
app.use(compression());

// 3. Body parsing & limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. CORS (before routes)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// 5. Security headers
app.use(helmet());

// 6. Request sanitization
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // XSS protection

// 7. Rate limiting (after sanitization)
app.use('/api/', apiRateLimiter);
app.use('/api/auth/', authRateLimiter);

// 8. Session management
app.use(session({
  secret: process.env.SESSION_SECRET!,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// 9. Passport initialization (after session)
app.use(passport.initialize());
app.use(passport.session());

// 10. CSRF token attachment
app.use(attachCsrfToken);

// 11. Request logging
app.use(requestLogger);

// 12. Routes
registerRoutes(app);

// 13. Error handlers (LAST!)
app.use(Sentry.Handlers.errorHandler());
app.use(globalErrorHandler);
```

---

## Request Validation

### Zod Validation Middleware

#### ✅ CORRECT - Reusable Validation
```typescript
// middleware/validation.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateRequest<T extends z.ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and transform data
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        }, {} as Record<string, string>);

        return res.status(400).json({
          error: 'Validation failed',
          fields: errors,
        });
      }
      next(error);
    }
  };
}

export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors,
        });
      }
      next(error);
    }
  };
}

// Usage in routes
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  categoryId: z.number().int().positive(),
});

router.post('/api/products',
  requireAuth,
  csrfProtection,
  validateRequest(createProductSchema),
  async (req, res) => {
    // req.body is now typed and validated
    const product = await storage.createProduct(req.body);
    res.json(product);
  }
);
```

### Parameter Validation

#### ✅ CORRECT - Safe Parameter Parsing
```typescript
// utils/validation-helpers.ts
export function parseIntSafe(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): number {
  const parsed = parseInt(String(value), 10);

  if (isNaN(parsed)) {
    throw new ValidationError(`${fieldName} must be a valid integer`, {
      [fieldName]: 'Invalid integer',
    });
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new ValidationError(`${fieldName} must be at least ${options.min}`, {
      [fieldName]: `Minimum value is ${options.min}`,
    });
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new ValidationError(`${fieldName} must not exceed ${options.max}`, {
      [fieldName]: `Maximum value is ${options.max}`,
    });
  }

  return parsed;
}

// Route usage
router.get('/api/products/:id', async (req, res, next) => {
  try {
    const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
    const product = await storage.getProductById(id);

    if (!product) {
      throw new NotFoundError('Product', id);
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});
```

---

## Response Patterns

### Consistent Response Format

#### ✅ CORRECT - Standardized Responses
```typescript
// types/api.ts
interface SuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// utils/response.ts
export function successResponse<T>(data: T, meta?: any): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

export function errorResponse(
  error: string,
  code?: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error,
    ...(code && { code }),
    ...(details && { details }),
  };
}

// Route usage
router.get('/api/products', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const { products, total } = await storage.getProducts(page, limit);

  res.json(successResponse(products, {
    page,
    limit,
    total,
  }));
});
```

### Status Code Standards

#### ✅ CORRECT - Proper HTTP Status Codes
```typescript
// Success codes
res.status(200).json(data); // OK - GET success
res.status(201).json(data); // Created - POST success
res.status(204).end(); // No Content - DELETE success

// Client error codes
res.status(400).json({ error: 'Bad Request' }); // Validation error
res.status(401).json({ error: 'Unauthorized' }); // Not authenticated
res.status(403).json({ error: 'Forbidden' }); // Not authorized
res.status(404).json({ error: 'Not Found' }); // Resource not found
res.status(409).json({ error: 'Conflict' }); // Duplicate entry
res.status(422).json({ error: 'Unprocessable Entity' }); // Business logic error
res.status(429).json({ error: 'Too Many Requests' }); // Rate limited

// Server error codes
res.status(500).json({ error: 'Internal Server Error' }); // Server error
res.status(502).json({ error: 'Bad Gateway' }); // Upstream error
res.status(503).json({ error: 'Service Unavailable' }); // Maintenance
res.status(504).json({ error: 'Gateway Timeout' }); // Timeout
```

---

## Authentication & Authorization

### Protected Route Pattern

#### ✅ CORRECT - Layered Security
```typescript
// middleware/auth.ts
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

export function requireOwnership(resourceGetter: (req: Request) => Promise<{ userId?: number }>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const resource = await resourceGetter(req);

      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      if (resource.userId !== req.session.userId && req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      req.resource = resource; // Attach for route handler
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Usage
router.put('/api/watchlists/:id',
  requireAuth,
  requireOwnership(async (req) => {
    const id = parseIntSafe(req.params.id, 'watchlistId');
    return storage.getWatchlistById(id);
  }),
  csrfProtection,
  validateRequest(updateWatchlistSchema),
  async (req, res) => {
    // User owns this watchlist or is admin
    const updated = await storage.updateWatchlist(req.params.id, req.body);
    res.json(updated);
  }
);
```

---

## Pagination Patterns

### Cursor vs Offset Pagination

#### ✅ CORRECT - Flexible Pagination
```typescript
// Offset pagination (simple, allows jumping to pages)
router.get('/api/products', async (req, res) => {
  const page = parseIntOptional(req.query.page) || 1;
  const limit = Math.min(
    parseIntOptional(req.query.limit) || 50,
    100 // Max limit
  );
  const offset = (page - 1) * limit;

  const [products, total] = await Promise.all([
    db.select()
      .from(products)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(products.createdAt)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(products)
      .then(r => r[0].count),
  ]);

  res.json({
    data: products,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
});

// Cursor pagination (efficient for large datasets)
router.get('/api/feed', async (req, res) => {
  const limit = parseIntOptional(req.query.limit) || 50;
  const cursor = req.query.cursor; // Base64 encoded cursor

  let query = db.select()
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .limit(limit + 1); // Fetch one extra to check hasNext

  if (cursor) {
    const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query = query.where(
      or(
        lt(posts.createdAt, decodedCursor.createdAt),
        and(
          eq(posts.createdAt, decodedCursor.createdAt),
          gt(posts.id, decodedCursor.id)
        )
      )
    );
  }

  const items = await query;
  const hasNext = items.length > limit;
  const results = hasNext ? items.slice(0, -1) : items;

  const nextCursor = hasNext
    ? Buffer.from(JSON.stringify({
        createdAt: results[results.length - 1].createdAt,
        id: results[results.length - 1].id,
      })).toString('base64')
    : null;

  res.json({
    data: results,
    meta: {
      nextCursor,
      hasNext,
    },
  });
});
```

---

## File Upload Patterns

### Secure File Uploads

#### ✅ CORRECT - Validated Uploads
```typescript
// middleware/upload.ts
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Memory storage for cloud upload
const storage = multer.memoryStorage();

export const uploadImage = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Single file
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, and WebP allowed.'));
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return cb(new Error('Invalid file extension'));
    }

    cb(null, true);
  },
});

// Route with upload
router.post('/api/products/:id/image',
  requireAuth,
  uploadImage.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new ValidationError('No image provided', {
          image: 'Image is required',
        });
      }

      // Generate unique filename
      const filename = `${crypto.randomBytes(16).toString('hex')}${path.extname(req.file.originalname)}`;

      // Upload to cloud storage (S3, Cloudinary, etc.)
      const imageUrl = await uploadToCloud(req.file.buffer, filename);

      // Save URL to database
      await storage.updateProduct(req.params.id, { imageUrl });

      res.json({ imageUrl });
    } catch (error) {
      next(error);
    }
  }
);

// Multiple file uploads
export const uploadMultipleImages = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Max 5 files
  },
  fileFilter: /* same as above */,
});

router.post('/api/products/:id/gallery',
  requireAuth,
  uploadMultipleImages.array('images', 5),
  async (req, res) => {
    const imageUrls = await Promise.all(
      req.files.map(file => uploadToCloud(file.buffer))
    );
    // Save URLs...
  }
);
```

---

## Caching Patterns

### Cache Middleware

#### ✅ CORRECT - Smart Caching
```typescript
// middleware/cache.ts
interface CacheOptions {
  duration?: number; // seconds
  key?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

export function cache(options: CacheOptions = {}) {
  const {
    duration = 300, // 5 minutes default
    key = (req) => `cache:${req.originalUrl}`,
    condition = (req) => req.method === 'GET',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if condition not met
    if (!condition(req)) {
      return next();
    }

    const cacheKey = key(req);

    try {
      // Check cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch (error) {
      log.error('Cache read error:', error);
      // Continue without cache
    }

    // Store original send
    const originalSend = res.json.bind(res);

    // Override json method
    res.json = function(data: any) {
      res.setHeader('X-Cache', 'MISS');

      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redis.setex(cacheKey, duration, JSON.stringify(data))
          .catch(error => log.error('Cache write error:', error));
      }

      return originalSend(data);
    };

    next();
  };
}

// Usage with different cache durations
router.get('/api/products',
  cache({ duration: 300 }), // 5 minutes
  getProducts
);

router.get('/api/products/:id',
  cache({
    duration: 60, // 1 minute
    key: (req) => `product:${req.params.id}`,
  }),
  getProduct
);

// Cache invalidation
export async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Invalidate on update
router.put('/api/products/:id', async (req, res) => {
  const product = await storage.updateProduct(req.params.id, req.body);

  // Invalidate related caches
  await Promise.all([
    invalidateCache(`product:${req.params.id}`),
    invalidateCache('cache:/api/products*'),
  ]);

  res.json(product);
});
```

---

## Rate Limiting

### Tiered Rate Limiting

#### ✅ CORRECT - Different Limits for Different Endpoints
```typescript
// middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// General API limit
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict auth limit
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Rate limit by IP + email for auth
    return `${req.ip}:${req.body?.email || ''}`;
  },
});

// Search rate limit (expensive operation)
export const searchLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:search:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 searches per minute
});

// User-specific rate limiting
export function userRateLimit(max: number, windowMs: number) {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:user:',
    }),
    windowMs,
    max,
    keyGenerator: (req) => {
      // Rate limit by user ID if authenticated
      return req.session?.userId?.toString() || req.ip;
    },
    skip: (req) => {
      // Skip for admin users
      return req.session?.role === 'admin';
    },
  });
}

// Apply different limits
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/search', searchLimiter);
app.use('/api/scrape',
  requireAuth,
  userRateLimit(5, 60000) // 5 per minute per user
);
```

---

## API Versioning

### Version Management

#### ✅ CORRECT - URL Versioning
```typescript
// routes/v1/index.ts
export function registerV1Routes(app: Express) {
  const router = Router();

  // V1 routes
  router.use('/products', productRoutesV1);
  router.use('/users', userRoutesV1);

  app.use('/api/v1', router);
}

// routes/v2/index.ts
export function registerV2Routes(app: Express) {
  const router = Router();

  // V2 routes with breaking changes
  router.use('/products', productRoutesV2);
  router.use('/users', userRoutesV2);

  app.use('/api/v2', router);
}

// Header-based versioning (alternative)
export function versionMiddleware(req: Request, res: Response, next: NextFunction) {
  const version = req.headers['api-version'] || 'v1';

  if (!['v1', 'v2'].includes(version)) {
    return res.status(400).json({
      error: 'Invalid API version',
      supported: ['v1', 'v2'],
    });
  }

  req.apiVersion = version;
  next();
}

// Route handler checking version
router.get('/api/products', versionMiddleware, async (req, res) => {
  if (req.apiVersion === 'v2') {
    // V2 response format
    const products = await storage.getProductsV2();
    res.json({ data: products });
  } else {
    // V1 response format (legacy)
    const products = await storage.getProducts();
    res.json(products);
  }
});
```

---

## API Documentation

### OpenAPI/Swagger Integration

#### ✅ CORRECT - Document Your APIs
```typescript
// swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PriceCompare API',
      version: '1.0.0',
      description: 'Price comparison platform API',
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
      },
    ],
  },
  apis: ['./server/routes/*.ts'], // Path to route files
};

const specs = swaggerJsdoc(options);

// Serve documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Document routes with JSDoc
/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
router.get('/api/products/:id', getProduct);
```

---

## Testing Patterns

### API Testing

#### ✅ CORRECT - Comprehensive Tests
```typescript
// tests/api/products.test.ts
import request from 'supertest';
import { app } from '../../server';

describe('Products API', () => {
  let authCookie: string;

  beforeAll(async () => {
    // Login and get session cookie
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    authCookie = res.headers['set-cookie'][0];
  });

  describe('GET /api/products/:id', () => {
    it('should return product when exists', async () => {
      const res = await request(app)
        .get('/api/products/1')
        .expect(200);

      expect(res.body).toMatchObject({
        id: 1,
        name: expect.any(String),
        price: expect.any(Number),
      });
    });

    it('should return 404 when product not found', async () => {
      const res = await request(app)
        .get('/api/products/999999')
        .expect(404);

      expect(res.body).toMatchObject({
        error: 'Product not found',
      });
    });

    it('should return 400 for invalid ID', async () => {
      const res = await request(app)
        .get('/api/products/invalid')
        .expect(400);

      expect(res.body).toMatchObject({
        error: expect.stringContaining('must be a valid integer'),
      });
    });
  });

  describe('POST /api/products', () => {
    it('should create product when authenticated', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Cookie', authCookie)
        .send({
          name: 'Test Product',
          price: 99.99,
          categoryId: 1,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(Number),
        name: 'Test Product',
        price: 99.99,
      });
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .post('/api/products')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should validate input', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Cookie', authCookie)
        .send({ name: '' }) // Invalid
        .expect(400);

      expect(res.body).toMatchObject({
        error: 'Validation failed',
        fields: expect.any(Object),
      });
    });
  });
});
```

---

## API Checklist

- [ ] **Route Organization**
  - [ ] Routes organized by domain
  - [ ] Central route registration
  - [ ] Storage layer abstraction

- [ ] **Middleware Pipeline**
  - [ ] Correct middleware order
  - [ ] Security middleware applied
  - [ ] Error handler last

- [ ] **Request Validation**
  - [ ] Zod schemas for body/query
  - [ ] Safe parameter parsing
  - [ ] Input sanitization

- [ ] **Response Patterns**
  - [ ] Consistent response format
  - [ ] Proper HTTP status codes
  - [ ] Error responses sanitized

- [ ] **Authentication**
  - [ ] Protected routes use requireAuth
  - [ ] Admin routes check role
  - [ ] CSRF protection on mutations

- [ ] **Performance**
  - [ ] Pagination implemented
  - [ ] Caching where appropriate
  - [ ] Rate limiting configured

- [ ] **Documentation**
  - [ ] OpenAPI/Swagger specs
  - [ ] Example requests/responses
  - [ ] Error codes documented

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [SECURITY_PATTERNS.md](SECURITY_PATTERNS.md) - API security
- [ERROR_HANDLING_PATTERNS.md](ERROR_HANDLING_PATTERNS.md) - Error responses
- [DATABASE_PATTERNS.md](DATABASE_PATTERNS.md) - Data access patterns
- [Pre-commit Hook](.git/hooks/pre-commit) - API checks