/**
 * Test date utilities for timezone-safe date creation
 *
 * These utilities ensure consistent date behavior across all timezones
 * by using UTC noon times, preventing date shifts that occur with midnight dates.
 */

/**
 * Create a timezone-safe test date using UTC noon
 *
 * This function creates dates at 12:00:00 UTC (noon), which ensures the date
 * stays consistent across all timezone conversions (-12 to +14).
 *
 * @param {number} year - Full year (e.g., 2025)
 * @param {number} month - 1-based month (1 = January, 12 = December)
 * @param {number} day - Day of month (1-31)
 * @returns {Date} UTC date at noon
 *
 * @example
 * // Create Jan 15, 2025 at noon UTC
 * const date = createTestDate(2025, 1, 15);
 *
 * @example
 * // Create Dec 31, 2024 at noon UTC (year boundary)
 * const yearEnd = createTestDate(2024, 12, 31);
 */
export function createTestDate(year, month, day) {
  // Convert 1-based month to 0-based for Date.UTC()
  // Date.UTC(year, monthIndex, day, hour, minute, second)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/**
 * Create a timezone-safe test date with custom time
 *
 * Use this when you need a specific time for testing time-sensitive functionality.
 * For most date-only tests, use createTestDate() instead.
 *
 * @param {number} year - Full year (e.g., 2025)
 * @param {number} month - 1-based month (1 = January, 12 = December)
 * @param {number} day - Day of month (1-31)
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @param {number} second - Second (0-59)
 * @returns {Date} UTC date at specified time
 *
 * @example
 * // Create Jan 15, 2025 at 3:30:00 PM UTC
 * const date = createTestDateTime(2025, 1, 15, 15, 30, 0);
 */
export function createTestDateTime(year, month, day, hour = 12, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

/**
 * Create a timezone-safe ISO date string for testing
 *
 * Returns an ISO 8601 string with UTC timezone (Z suffix).
 * Useful for testing APIs that accept ISO date strings.
 *
 * @param {number} year - Full year (e.g., 2025)
 * @param {number} month - 1-based month (1 = January, 12 = December)
 * @param {number} day - Day of month (1-31)
 * @returns {string} ISO 8601 date string with UTC timezone
 *
 * @example
 * // Returns "2025-01-15T12:00:00.000Z"
 * const isoDate = createTestDateISO(2025, 1, 15);
 */
export function createTestDateISO(year, month, day) {
  return createTestDate(year, month, day).toISOString();
}

/**
 * ANTI-PATTERNS - Do not use these in tests
 *
 * ❌ WRONG - Date-only string (timezone-sensitive):
 *    new Date('2025-01-15')  // Midnight UTC → Jan 14 in PST
 *
 * ❌ WRONG - Local timezone constructor:
 *    new Date(2025, 0, 15)  // Local midnight, inconsistent
 *
 * ✅ CORRECT - Use this utility:
 *    createTestDate(2025, 1, 15)  // Noon UTC, consistent everywhere
 *
 * ✅ ALSO CORRECT - Direct Date.UTC() with noon time:
 *    new Date(Date.UTC(2025, 0, 15, 12, 0, 0))
 */

/**
 * Common test dates for convenience
 *
 * Pre-defined dates for common test scenarios.
 * All dates use noon UTC for timezone safety.
 */
export const TEST_DATES = {
  /** Jan 1, 2025 - Year boundary */
  YEAR_START: createTestDate(2025, 1, 1),

  /** Dec 31, 2024 - Year boundary */
  YEAR_END: createTestDate(2024, 12, 31),

  /** Jan 15, 2025 - Mid-month */
  MID_JANUARY: createTestDate(2025, 1, 15),

  /** Feb 28, 2024 - Leap year boundary */
  LEAP_YEAR_FEB_28: createTestDate(2024, 2, 28),

  /** Feb 29, 2024 - Leap year day */
  LEAP_YEAR_FEB_29: createTestDate(2024, 2, 29),

  /** Mar 1, 2024 - After leap day */
  LEAP_YEAR_MAR_1: createTestDate(2024, 3, 1)
};
