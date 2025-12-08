import UserAgent from 'user-agents';

export class ScraperUtils {
  private static userAgentGenerator = new UserAgent();

  /**
   * Get a random user agent string
   */
  static getRandomUserAgent(): string {
    return this.userAgentGenerator.toString();
  }

  /**
   * Create request headers with anti-detection measures
   */
  static getRequestHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'User-Agent': this.getRandomUserAgent(),
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      ...customHeaders,
    };
  }

  /**
   * Implement exponential backoff delay
   */
  static async delay(ms: number, jitter = true): Promise<void> {
    const delayTime = jitter ? ms + Math.random() * 1000 : ms;
    return new Promise((resolve) => setTimeout(resolve, delayTime));
  }

  /**
   * Rate limiter for requests
   */
  static createRateLimiter(requestsPerSecond: number) {
    let lastRequestTime = 0;
    const minInterval = 1000 / requestsPerSecond;

    return async (): Promise<void> => {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;

      if (timeSinceLastRequest < minInterval) {
        await this.delay(minInterval - timeSinceLastRequest, false);
      }

      lastRequestTime = Date.now();
    };
  }

  /**
   * Clean and normalize product names
   */
  static normalizeProductName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '')
      .toLowerCase();
  }

  /**
   * Extract price from various formats
   */
  static extractPrice(priceText: string): number | null {
    const cleanText = priceText.replace(/[^\d.,]/g, '');
    const match = cleanText.match(/(\d+(?:[.,]\d{2})?)/);

    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }

    return null;
  }

  /**
   * Validate URLs
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate cache key for requests
   */
  static generateCacheKey(url: string, params?: Record<string, unknown>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `scraper_${Buffer.from(url + paramString).toString('base64')}`;
  }
}

export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;

  constructor(maxRequests: number, timeWindowMs: number) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the time window
    this.requests = this.requests.filter((time) => now - time < this.timeWindow);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.timeWindow - (now - oldestRequest);

      if (waitTime > 0) {
        await ScraperUtils.delay(waitTime, false);
      }
    }

    this.requests.push(now);
  }
}
