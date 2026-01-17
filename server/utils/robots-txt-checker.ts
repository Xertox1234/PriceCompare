import robotsParser from 'robots-parser';
import { logger } from './logger';

/**
 * Robot parser result type from robots-parser package
 */
interface RobotParser {
  isAllowed(url: string, ua?: string): boolean | undefined;
  isDisallowed(url: string, ua?: string): boolean | undefined;
  getCrawlDelay(ua?: string): number | undefined;
  getSitemaps(): string[];
  getPreferredHost(): string | null;
}

/**
 * Cache entry for parsed robots.txt
 */
interface RobotsCacheEntry {
  parser: RobotParser;
  expiresAt: number;
}

// Cache robots.txt results to avoid repeated fetches
const robotsCache = new Map<string, RobotsCacheEntry>();
const CACHE_TTL_MS = 3600000; // 1 hour
const MAX_CACHE_SIZE = 500; // Maximum cached origins to prevent unbounded memory growth

/**
 * Clean up expired cache entries
 * Called lazily during cache operations to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [origin, entry] of robotsCache) {
    if (entry.expiresAt < now) {
      robotsCache.delete(origin);
    }
  }
}

/**
 * Set cache entry with size limit enforcement
 * Removes oldest entries if cache exceeds MAX_CACHE_SIZE
 */
function setCacheEntry(origin: string, entry: RobotsCacheEntry): void {
  // First, clean up expired entries
  if (robotsCache.size > MAX_CACHE_SIZE / 2) {
    cleanupExpiredEntries();
  }

  // If still over limit, remove oldest entries (FIFO)
  if (robotsCache.size >= MAX_CACHE_SIZE) {
    const entriesToRemove = robotsCache.size - MAX_CACHE_SIZE + 1;
    const keys = robotsCache.keys();
    for (let i = 0; i < entriesToRemove; i++) {
      const key = keys.next().value;
      if (key) robotsCache.delete(key);
    }
  }

  robotsCache.set(origin, entry);
}

/**
 * Check if scraping a URL is allowed by robots.txt
 *
 * Implements ethical web scraping by checking robots.txt before crawling.
 * Results are cached for 1 hour to minimize requests to origin servers.
 *
 * @param url - The URL to check
 * @param userAgent - The user agent string being used
 * @returns true if allowed, false if disallowed
 *
 * @example
 * ```typescript
 * const allowed = await isScrapingAllowed('https://example.com/product', 'PriceCompare Bot/1.0');
 * if (!allowed) {
 *   throw new Error('Scraping disallowed by robots.txt');
 * }
 * ```
 */
export async function isScrapingAllowed(url: string, userAgent: string): Promise<boolean> {
  // Input validation at function boundary
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    throw new Error('Invalid url: must be non-empty string');
  }
  if (!userAgent || typeof userAgent !== 'string' || userAgent.trim().length === 0) {
    throw new Error('Invalid userAgent: must be non-empty string');
  }

  try {
    const urlObj = new URL(url);
    const origin = urlObj.origin;
    const now = Date.now();

    // Check cache
    const cached = robotsCache.get(origin);
    if (cached && cached.expiresAt > now) {
      return cached.parser.isAllowed(url, userAgent) ?? true;
    }

    // Fetch robots.txt
    const robotsUrl = `${origin}/robots.txt`;
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
      headers: {
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      // No robots.txt or error - allow by default (standard behavior)
      logger.debug(`No robots.txt found for ${origin}, allowing scrape`);
      return true;
    }

    const robotsTxt = await response.text();
    // Type assertion: robots-parser returns untyped object, cast to our RobotParser interface
    const parser = robotsParser(robotsUrl, robotsTxt) as RobotParser;

    // Cache the result with size limit enforcement
    setCacheEntry(origin, {
      parser,
      expiresAt: now + CACHE_TTL_MS,
    });

    const isAllowed = parser.isAllowed(url, userAgent) ?? true;

    if (!isAllowed) {
      logger.warn(`Scraping disallowed by robots.txt`, { url, origin, userAgent });
    }

    return isAllowed;
  } catch (error) {
    // On error, allow scraping (fail open for availability)
    // This follows standard crawler behavior - if robots.txt is unreachable, proceed
    logger.warn(`Error checking robots.txt, allowing scrape`, {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

/**
 * Get crawl delay from robots.txt if specified
 *
 * Returns the Crawl-delay directive value for the given user agent.
 * This should be respected between requests to the same origin.
 *
 * Note: This only returns a value if the origin has been previously
 * checked via isScrapingAllowed() and the result is still cached.
 *
 * @param origin - The origin (protocol + hostname) to check
 * @param userAgent - The user agent string being used
 * @returns Crawl delay in seconds, or null if not specified or not cached
 */
export function getCrawlDelay(origin: string, userAgent: string): number | null {
  try {
    const cached = robotsCache.get(origin);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.parser.getCrawlDelay(userAgent) ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear the robots.txt cache
 *
 * Useful for testing or when robots.txt is known to have changed.
 */
export function clearRobotsCache(): void {
  robotsCache.clear();
  logger.debug('Robots.txt cache cleared');
}

/**
 * Get current cache size
 *
 * Useful for monitoring and debugging.
 */
export function getRobotsCacheSize(): number {
  return robotsCache.size;
}
