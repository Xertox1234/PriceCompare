/**
 * OpenAPI 3.0 Schema Generator for Standardized API Responses
 *
 * Generates OpenAPI/Swagger specifications for API endpoints
 * following the standardized response envelope format.
 *
 * Usage:
 * ```typescript
 * import { generateOpenAPISpec, successResponse, errorResponse } from './openapi-generator';
 *
 * const spec = generateOpenAPISpec({
 *   title: 'PriceCompare API',
 *   version: '1.0.0',
 *   endpoints: [...]
 * });
 * ```
 */

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
}

export interface OpenAPISchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: OpenAPISchema;
  [key: string]: unknown;
}

export interface OpenAPIEndpoint {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header';
    required?: boolean;
    schema: OpenAPISchema;
    description?: string;
  }>;
  requestBody?: {
    required?: boolean;
    content: {
      'application/json': {
        schema: OpenAPISchema;
      };
    };
  };
  responses: Record<
    string,
    {
      description: string;
      content?: {
        'application/json': {
          schema: OpenAPISchema;
        };
      };
    }
  >;
  security?: Array<Record<string, string[]>>;
}

/**
 * Base schemas for standardized response envelopes
 */

export const paginationMetaSchema: OpenAPISchema = {
  type: 'object',
  properties: {
    page: {
      type: 'integer',
      minimum: 1,
      description: 'Current page number',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      description: 'Items per page',
    },
    total: {
      type: 'integer',
      minimum: 0,
      description: 'Total number of items',
    },
    totalPages: {
      type: 'integer',
      minimum: 0,
      description: 'Total number of pages',
    },
    hasMore: {
      type: 'boolean',
      description: 'Whether more pages exist',
    },
    nextPage: {
      type: 'integer',
      nullable: true,
      description: 'Next page number (null if last page)',
    },
    prevPage: {
      type: 'integer',
      nullable: true,
      description: 'Previous page number (null if first page)',
    },
  },
  required: ['page', 'limit', 'total', 'totalPages'],
};

export const apiResponseMetaSchema: OpenAPISchema = {
  type: 'object',
  properties: {
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Response timestamp (ISO 8601)',
    },
    version: {
      type: 'string',
      description: 'API version',
    },
    requestId: {
      type: 'string',
      description: 'Request correlation ID',
    },
  },
  required: ['timestamp', 'version'],
};

/**
 * Generate success response schema
 */
export function successResponse(dataSchema: OpenAPISchema, meta?: boolean): OpenAPISchema {
  const properties: Record<string, unknown> = {
    success: {
      type: 'boolean',
      enum: [true],
      description: 'Indicates successful response',
    },
    data: dataSchema,
  };

  if (meta) {
    properties.meta = apiResponseMetaSchema;
  }

  return {
    type: 'object',
    properties,
    required: ['success', 'data'],
  };
}

/**
 * Generate error response schema
 */
export function errorResponse(includeDetails: boolean = false): OpenAPISchema {
  const properties: Record<string, unknown> = {
    success: {
      type: 'boolean',
      enum: [false],
      description: 'Indicates error response',
    },
    error: {
      type: 'string',
      description: 'Human-readable error message',
    },
  };

  if (includeDetails) {
    properties.details = {
      type: 'string',
      description: 'Detailed error information (development only)',
    };
  }

  return {
    type: 'object',
    properties,
    required: ['success', 'error'],
  };
}

/**
 * Generate paginated response schema
 */
export function paginatedResponse(itemSchema: OpenAPISchema): OpenAPISchema {
  return {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        enum: [true],
        description: 'Indicates successful response',
      },
      data: {
        type: 'array',
        items: itemSchema,
        description: 'Array of items for current page',
      },
      meta: paginationMetaSchema,
    },
    required: ['success', 'data', 'meta'],
  };
}

/**
 * Common response schemas
 */

export const standardResponses = {
  200: (dataSchema: OpenAPISchema) => ({
    description: 'Successful response',
    content: {
      'application/json': {
        schema: successResponse(dataSchema),
      },
    },
  }),

  201: (dataSchema: OpenAPISchema) => ({
    description: 'Resource created successfully',
    content: {
      'application/json': {
        schema: successResponse(dataSchema),
      },
    },
  }),

  204: {
    description: 'No content - operation successful',
  },

  400: {
    description: 'Bad request - invalid input',
    content: {
      'application/json': {
        schema: errorResponse(),
      },
    },
  },

  401: {
    description: 'Unauthorized - authentication required',
    content: {
      'application/json': {
        schema: errorResponse(),
      },
    },
  },

  403: {
    description: 'Forbidden - insufficient permissions',
    content: {
      'application/json': {
        schema: errorResponse(),
      },
    },
  },

  404: {
    description: 'Not found - resource does not exist',
    content: {
      'application/json': {
        schema: errorResponse(),
      },
    },
  },

  409: {
    description: 'Conflict - resource already exists',
    content: {
      'application/json': {
        schema: errorResponse(),
      },
    },
  },

  500: {
    description: 'Internal server error',
    content: {
      'application/json': {
        schema: errorResponse(true), // Include details in dev
      },
    },
  },
};

/**
 * Generate complete OpenAPI specification
 */
export function generateOpenAPISpec(config: {
  info: OpenAPIInfo;
  servers?: Array<{ url: string; description?: string }>;
  endpoints: OpenAPIEndpoint[];
  tags?: Array<{ name: string; description?: string }>;
}): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  // Group endpoints by path
  for (const endpoint of config.endpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }

    paths[endpoint.path][endpoint.method] = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
      parameters: endpoint.parameters,
      requestBody: endpoint.requestBody,
      responses: endpoint.responses,
      security: endpoint.security,
    };
  }

  return {
    openapi: '3.0.0',
    info: config.info,
    servers: config.servers || [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    tags: config.tags,
    paths,
    components: {
      schemas: {
        PaginationMeta: paginationMetaSchema,
        ApiResponseMeta: apiResponseMetaSchema,
        ErrorResponse: errorResponse(),
        ErrorResponseWithDetails: errorResponse(true),
      },
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie authentication',
        },
      },
    },
  };
}

/**
 * Example: Generate spec for product endpoints
 */
export function generateProductEndpointsSpec(): Record<string, unknown> {
  const productSchema: OpenAPISchema = {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      category: { type: 'string', nullable: true },
      brand: { type: 'string', nullable: true },
      model: { type: 'string', nullable: true },
      image: { type: 'string', nullable: true },
    },
    required: ['id', 'name'],
  };

  const endpoints: OpenAPIEndpoint[] = [
    {
      path: '/api/products/search',
      method: 'get',
      summary: 'Search products',
      tags: ['Products'],
      parameters: [
        {
          name: 'query',
          in: 'query',
          schema: { type: 'string' },
          description: 'Search query',
        },
        {
          name: 'category',
          in: 'query',
          schema: { type: 'string' },
          description: 'Filter by category',
        },
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        '200': {
          description: 'Paginated product search results',
          content: {
            'application/json': {
              schema: paginatedResponse(productSchema),
            },
          },
        },
        '400': standardResponses[400],
        '500': standardResponses[500],
      },
    },
    {
      path: '/api/products/{id}',
      method: 'get',
      summary: 'Get product by ID',
      tags: ['Products'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Product ID',
        },
      ],
      responses: {
        '200': standardResponses[200](productSchema),
        '404': standardResponses[404],
        '500': standardResponses[500],
      },
    },
  ];

  return generateOpenAPISpec({
    info: {
      title: 'PriceCompare API',
      version: '1.0.0',
      description: 'API for price comparison and product discovery',
      contact: {
        name: 'PriceCompare Team',
        email: 'api@pricecompare.com',
      },
    },
    tags: [
      { name: 'Products', description: 'Product search and details' },
      { name: 'Alerts', description: 'Price alert management' },
      { name: 'Auth', description: 'Authentication and authorization' },
    ],
    endpoints,
  });
}

/**
 * Write OpenAPI spec to JSON file
 *
 * NOTE: This function is intended for BUILD-TIME SCRIPT usage only.
 * Do NOT call from runtime server code. Use in scripts/generate-openapi.ts
 * or similar build-time automation.
 *
 * @example
 * // scripts/generate-openapi.ts
 * import { generateOpenAPISpec, writeOpenAPISpec } from '../server/utils/openapi-generator';
 *
 * const spec = generateOpenAPISpec({ ... });
 * writeOpenAPISpec(spec, 'openapi.json');
 */
export function writeOpenAPISpec(spec: Record<string, unknown>, filename: string = 'openapi.json'): void {
  // BUILD-TIME ONLY: Dynamic require acceptable for build scripts
  const fs = require('fs');
  const path = require('path');

  const outputPath = path.join(process.cwd(), 'docs', filename);
  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');

  // BUILD-TIME ONLY: console.log acceptable for build script output
  console.log(`OpenAPI spec written to: ${outputPath}`);
}
