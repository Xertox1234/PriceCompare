import { z } from 'zod';

/**
 * Admin Route Validation Schemas
 * Validates input for admin-only endpoints to prevent malformed or malicious data
 */

// Scraping Routes Validation
export const scrapingInitializeSchema = z.object({
  sources: z.array(z.enum(['google_trends', 'seasonal', 'manual'])).optional().default(['google_trends', 'seasonal']),
  categories: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).optional().default(20),
});

export const scrapingSearchSchema = z.object({
  query: z.string().min(1).max(200),
  retailers: z.array(z.string()).min(1).max(10),
  maxResults: z.number().int().positive().max(50).optional().default(10),
});

export const scrapingJobControlSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel']),
});

// Affiliate Routes Validation
export const affiliateLinkGenerateSchema = z.object({
  productId: z.number().int().positive(),
  retailerId: z.number().int().positive(),
});

export const affiliateLinkBulkGenerateSchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1).max(100),
  retailerId: z.number().int().positive(),
});

export const affiliateConfigUpdateSchema = z.object({
  retailerId: z.number().int().positive(),
  config: z.object({
    affiliateId: z.string().min(1).max(100).optional(),
    trackingCode: z.string().min(1).max(100).optional(),
    commission: z.number().min(0).max(100).optional(),
    enabled: z.boolean().optional(),
  }),
});

// Hybrid Data Routes Validation
export const hybridDataCollectSchema = z.object({
  sources: z.array(z.enum(['google_shopping', 'serpapi', 'scraped'])).min(1),
  query: z.string().min(1).max(200),
  maxResults: z.number().int().positive().max(100).optional().default(20),
  includeReviews: z.boolean().optional().default(false),
});

export const hybridDataConfigSchema = z.object({
  enableGoogleShopping: z.boolean().optional(),
  enableSerpApi: z.boolean().optional(),
  enableScraping: z.boolean().optional(),
  maxConcurrentRequests: z.number().int().positive().max(10).optional(),
  cacheDuration: z.number().int().positive().max(86400).optional(), // Max 24 hours in seconds
});

// Admin User Management Validation
export const adminUserUpdateSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(['user', 'admin', 'moderator']).optional(),
  banned: z.boolean().optional(),
  banReason: z.string().max(500).optional(),
});

// Product Management Validation
export const productCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(100),
  imageUrl: z.string().url().optional(),
  upc: z.string().regex(/^\d{12}$/).optional(), // UPC-A format
  sku: z.string().max(100).optional(),
});

export const productUpdateSchema = z.object({
  productId: z.number().int().positive(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(100).optional(),
  imageUrl: z.string().url().optional(),
  active: z.boolean().optional(),
});

// Retailer Management Validation
export const retailerCreateSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().url(),
  logoUrl: z.string().url().optional(),
  affiliateProgram: z.string().max(100).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
});

export const retailerUpdateSchema = z.object({
  retailerId: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  domain: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  active: z.boolean().optional(),
  affiliateProgram: z.string().max(100).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
});

// Category Management Validation
export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  parentId: z.number().int().positive().nullable().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), // Hex color
});

export const categoryUpdateSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Query parameter validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Type exports for use in route handlers
export type ScrapingInitializeInput = z.infer<typeof scrapingInitializeSchema>;
export type ScrapingSearchInput = z.infer<typeof scrapingSearchSchema>;
export type AffiliateLinkGenerateInput = z.infer<typeof affiliateLinkGenerateSchema>;
export type AffiliateConfigUpdateInput = z.infer<typeof affiliateConfigUpdateSchema>;
export type HybridDataCollectInput = z.infer<typeof hybridDataCollectSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type RetailerCreateInput = z.infer<typeof retailerCreateSchema>;
export type RetailerUpdateInput = z.infer<typeof retailerUpdateSchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
