import { z } from 'zod';

/**
 * Validation schemas for AI responses
 *
 * These schemas ensure that OpenAI responses are properly formatted
 * and contain all required fields, preventing runtime errors from
 * malformed AI outputs.
 */

// Schema for individual trend analysis from ProductDiscoveryAgent
export const aiTrendAnalysisSchema = z.object({
  originalQuery: z.string().min(1, 'Original query cannot be empty'),
  normalizedName: z.string(),
  category: z.string().min(1, 'Category is required'),
  confidence: z.number().min(0).max(100, 'Confidence must be 0-100'),
  isProduct: z.boolean(),
  reason: z.string().max(150, 'Reason should be concise (<150 chars)')
});

// Schema for array of trend analyses
export const aiTrendAnalysisArraySchema = z.array(aiTrendAnalysisSchema);

// Type inference for TypeScript
export type AITrendAnalysis = z.infer<typeof aiTrendAnalysisSchema>;

// Schema for search query generation from SearchOrchestrationAgent
export const aiSearchQueriesSchema = z.array(
  z.string()
    .min(2, 'Query too short')
    .max(100, 'Query too long')
).min(1, 'Must generate at least one query').max(10, 'Too many queries');

// Type inference
export type AISearchQueries = z.infer<typeof aiSearchQueriesSchema>;

/**
 * Validates AI trend analysis response with detailed error reporting
 * @param data - Raw data from AI response
 * @returns Validated trend analysis array
 * @throws ZodError with detailed validation errors
 */
export function validateTrendAnalysis(data: unknown): AITrendAnalysis[] {
  return aiTrendAnalysisArraySchema.parse(data);
}

/**
 * Validates AI search query generation response
 * @param data - Raw data from AI response
 * @returns Validated search queries array
 * @throws ZodError with detailed validation errors
 */
export function validateSearchQueries(data: unknown): AISearchQueries {
  return aiSearchQueriesSchema.parse(data);
}

/**
 * Safe validation that returns success/error result instead of throwing
 * @param data - Raw data from AI response
 * @returns { success: true, data } or { success: false, error }
 */
export function safeTrendAnalysis(data: unknown) {
  return aiTrendAnalysisArraySchema.safeParse(data);
}

/**
 * Safe validation for search queries
 * @param data - Raw data from AI response
 * @returns { success: true, data } or { success: false, error }
 */
export function safeSearchQueries(data: unknown) {
  return aiSearchQueriesSchema.safeParse(data);
}
