/**
 * Database Query Helpers
 *
 * Type-safe utilities for handling database query results
 */

/**
 * Safely get the first result from a query array
 * @param results Query results array
 * @returns First result or null if array is empty
 */
export function getFirstResult<T>(results: T[]): T | null {
  return results.at(0) ?? null;
}

/**
 * Assert that first result exists, throw error if not
 * @param results Query results array
 * @param context Context string for error message
 * @returns First result
 * @throws Error if no result found
 */
export function getRequiredFirstResult<T>(results: T[], context: string): T {
  const result = results.at(0);
  if (!result) {
    throw new Error(`Expected result in ${context}, but got empty array`);
  }
  return result;
}

/**
 * Type-safe query execution wrapper that returns first result or null
 * @param queryPromise Promise that resolves to results array
 * @returns First result or null
 */
export async function executeQueryForOne<T>(queryPromise: Promise<T[]>): Promise<T | null> {
  const results = await queryPromise;
  return getFirstResult(results);
}

/**
 * Type-safe query execution wrapper that returns all results
 * @param queryPromise Promise that resolves to results array
 * @returns All results (empty array if none)
 */
export async function executeQueryForMany<T>(queryPromise: Promise<T[]>): Promise<T[]> {
  return queryPromise;
}

/**
 * Safely get count from query result
 * @param results Query results with count field
 * @param defaultValue Default value if count is null/undefined
 * @returns Count value or default
 */
export function getCountFromResult(
  results: Array<{ count: number | string | null | undefined }>,
  defaultValue = 0
): number {
  const result = results.at(0);
  if (!result) return defaultValue;

  const count = result.count;
  if (count === null || count === undefined) return defaultValue;

  return typeof count === 'string' ? parseInt(count, 10) : count;
}

/**
 * Type guard to check if result has expected properties
 * @param result Query result to check
 * @param properties Array of property names that should exist
 * @returns True if all properties exist
 */
export function hasRequiredProperties<T extends Record<string, unknown>>(
  result: unknown,
  properties: Array<keyof T>
): result is T {
  if (!result || typeof result !== 'object') return false;

  return properties.every(prop => prop in result);
}

/**
 * Safe property access with type narrowing
 * @param obj Object to access property from
 * @param key Property key
 * @param defaultValue Default value if property doesn't exist
 * @returns Property value or default
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: T[K]
): T[K] {
  if (!obj) return defaultValue;
  return obj[key] ?? defaultValue;
}

/**
 * Map query results with type safety
 * @param results Query results array
 * @param mapper Mapping function
 * @returns Mapped array
 */
export function mapResults<T, U>(
  results: T[],
  mapper: (item: T, index: number) => U
): U[] {
  return results.map(mapper);
}

/**
 * Filter query results with type guard
 * @param results Query results array
 * @param predicate Type guard predicate
 * @returns Filtered array with narrowed type
 */
export function filterResults<T, S extends T>(
  results: T[],
  predicate: (item: T) => item is S
): S[] {
  return results.filter(predicate);
}
