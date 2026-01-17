import type { Page } from 'playwright';
import { logger } from './logger';

/**
 * Anti-Bot Detection Types
 *
 * Categorizes different types of bot detection mechanisms encountered during scraping.
 */
export type AntiBotType = 'captcha' | 'rate_limit' | 'access_denied' | 'cloudflare' | 'none';

/**
 * Result of anti-bot detection check
 */
export interface AntiBotDetection {
  detected: boolean;
  type: AntiBotType;
  message?: string;
}

/**
 * Timeout for CAPTCHA element visibility check (ms)
 * Short timeout since we're just checking for presence, not waiting for load
 */
const CAPTCHA_ELEMENT_TIMEOUT_MS = 1000;

/**
 * Base backoff delays by anti-bot type (ms)
 * These are the starting delays before exponential backoff is applied
 */
const BASE_BACKOFF_DELAYS: Record<AntiBotType, number> = {
  cloudflare: 60000, // 1 minute base
  rate_limit: 300000, // 5 minutes base
  access_denied: 600000, // 10 minutes base
  captcha: 120000, // 2 minutes base
  none: 0,
};

/**
 * Maximum backoff delay (ms) - capped at 1 hour
 */
const MAX_BACKOFF_MS = 3600000;

/**
 * Maximum jitter added to backoff (ms)
 */
const MAX_JITTER_MS = 10000;

/**
 * Detect if the page is showing anti-bot measures
 *
 * Checks for common anti-bot patterns:
 * - Cloudflare challenge pages
 * - Access denied / forbidden pages
 * - CAPTCHA / robot verification
 * - Rate limiting pages
 * - CAPTCHA elements in DOM
 *
 * @param page - Playwright Page object to analyze
 * @returns Detection result with type and message
 */
export async function detectAntiBot(page: Page): Promise<AntiBotDetection> {
  const title = await page.title().catch(() => '');
  const titleLower = title.toLowerCase();

  // Cloudflare challenge detection
  if (titleLower.includes('just a moment') || titleLower.includes('checking your browser')) {
    return {
      detected: true,
      type: 'cloudflare',
      message: 'Cloudflare challenge detected',
    };
  }

  // Access denied detection
  if (
    titleLower.includes('access denied') ||
    titleLower.includes('forbidden') ||
    titleLower.includes('blocked')
  ) {
    return {
      detected: true,
      type: 'access_denied',
      message: 'Access denied page detected',
    };
  }

  // Robot/CAPTCHA check via title
  if (
    titleLower.includes('robot') ||
    titleLower.includes('captcha') ||
    titleLower.includes('verify you are human')
  ) {
    return {
      detected: true,
      type: 'captcha',
      message: 'CAPTCHA or robot check detected',
    };
  }

  // Rate limiting detection
  if (titleLower.includes('rate limit') || titleLower.includes('too many requests')) {
    return {
      detected: true,
      type: 'rate_limit',
      message: 'Rate limiting detected',
    };
  }

  // Check for common CAPTCHA elements in DOM
  try {
    const captchaLocator = page.locator(
      '[class*="captcha"], [id*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'
    );
    const hasCaptcha = await captchaLocator
      .first()
      .isVisible({ timeout: CAPTCHA_ELEMENT_TIMEOUT_MS })
      .catch(() => false);

    if (hasCaptcha) {
      return {
        detected: true,
        type: 'captcha',
        message: 'CAPTCHA element found on page',
      };
    }
  } catch {
    // Ignore timeout errors - element not found is expected for normal pages
    logger.debug('CAPTCHA element check timed out (expected for normal pages)');
  }

  return { detected: false, type: 'none' };
}

/**
 * Calculate backoff delay based on anti-bot type and attempt number
 *
 * Uses exponential backoff with jitter:
 * - Base delay depends on anti-bot type
 * - Exponential increase: base * 2^attempt
 * - Random jitter added to prevent thundering herd
 * - Capped at 1 hour maximum
 *
 * @param type - Type of anti-bot detection
 * @param attempt - Current retry attempt (0-indexed)
 * @returns Backoff delay in milliseconds
 */
export function getAntiBotBackoffMs(type: AntiBotType, attempt: number): number {
  const base = BASE_BACKOFF_DELAYS[type] || BASE_BACKOFF_DELAYS.cloudflare;

  // Exponential backoff: base * 2^attempt
  const exponential = base * Math.pow(2, attempt);

  // Add random jitter (0 to MAX_JITTER_MS)
  const jitter = Math.random() * MAX_JITTER_MS;

  // Cap at maximum delay
  return Math.min(exponential + jitter, MAX_BACKOFF_MS);
}

/**
 * Format backoff duration for human-readable error messages
 *
 * @param backoffMs - Backoff duration in milliseconds
 * @returns Human-readable duration string (e.g., "5m 30s")
 */
export function formatBackoffDuration(backoffMs: number): string {
  const totalSeconds = Math.round(backoffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0 && seconds > 0) {
    return `${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}
