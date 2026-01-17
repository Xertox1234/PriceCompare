# TODO 245: Add Anti-Bot Detection Handling in Scrapers

**Created**: 2026-01-16
**Priority**: Medium
**Category**: Scraping Reliability
**Effort**: 2-3 hours

## Problem

When retailers detect automated scraping (CAPTCHA, rate limiting, access denied), the scraper has no special handling strategy. It simply fails or extracts no data.

**📍 File**: `server/agents/extraction-agent.ts`

**Risk Level**: Medium (Reliability/Business)

## Current Behavior

When anti-bot measures are triggered:
1. Page loads with CAPTCHA or "Access Denied" message
2. Scraper fails to find price selectors
3. Returns `{ success: false, reason: 'No price data found' }`
4. No special logging or backoff

## Required Changes

### 1. Create anti-bot detection utility

Create `server/utils/antibot-detection.ts`:

```typescript
import type { Page } from 'playwright';
import { logger } from './logger';

export interface AntiBotDetection {
  detected: boolean;
  type: 'captcha' | 'rate_limit' | 'access_denied' | 'cloudflare' | 'none';
  message?: string;
}

/**
 * Detect if the page is showing anti-bot measures
 */
export async function detectAntiBot(page: Page): Promise<AntiBotDetection> {
  const title = await page.title().catch(() => '');
  const url = page.url();
  
  // Check page title
  const titleLower = title.toLowerCase();
  
  // Cloudflare challenge
  if (titleLower.includes('just a moment') || 
      titleLower.includes('checking your browser')) {
    return { detected: true, type: 'cloudflare', message: 'Cloudflare challenge detected' };
  }
  
  // Access denied
  if (titleLower.includes('access denied') || 
      titleLower.includes('forbidden') ||
      titleLower.includes('blocked')) {
    return { detected: true, type: 'access_denied', message: 'Access denied page detected' };
  }
  
  // Robot/CAPTCHA check
  if (titleLower.includes('robot') || 
      titleLower.includes('captcha') ||
      titleLower.includes('verify you are human')) {
    return { detected: true, type: 'captcha', message: 'CAPTCHA or robot check detected' };
  }
  
  // Rate limiting
  if (titleLower.includes('rate limit') || 
      titleLower.includes('too many requests')) {
    return { detected: true, type: 'rate_limit', message: 'Rate limiting detected' };
  }
  
  // Check for common CAPTCHA elements
  try {
    const hasCaptcha = await page.locator('[class*="captcha"], [id*="captcha"], iframe[src*="recaptcha"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    
    if (hasCaptcha) {
      return { detected: true, type: 'captcha', message: 'CAPTCHA element found on page' };
    }
  } catch {
    // Ignore timeout errors
  }
  
  return { detected: false, type: 'none' };
}

/**
 * Calculate backoff delay based on anti-bot type
 */
export function getAntiBotBackoffMs(type: AntiBotDetection['type'], attempt: number): number {
  const baseDelays: Record<AntiBotDetection['type'], number> = {
    cloudflare: 60000,      // 1 minute base
    rate_limit: 300000,     // 5 minutes base
    access_denied: 600000,  // 10 minutes base
    captcha: 120000,        // 2 minutes base
    none: 0,
  };
  
  const base = baseDelays[type] || 60000;
  // Exponential backoff with jitter
  const exponential = base * Math.pow(2, attempt);
  const jitter = Math.random() * 10000; // 0-10 seconds jitter
  
  return Math.min(exponential + jitter, 3600000); // Cap at 1 hour
}
```

### 2. Integrate into extraction agent

```typescript
import { detectAntiBot, getAntiBotBackoffMs } from '../utils/antibot-detection';

// After page navigation, before extraction:
const antiBotResult = await detectAntiBot(page);

if (antiBotResult.detected) {
  logger.warn('Anti-bot measures detected', {
    url,
    type: antiBotResult.type,
    message: antiBotResult.message,
    retailer: retailerDomain,
  });
  
  // Record for monitoring
  void ExtractionMonitoring.recordAntiBot(retailerDomain, antiBotResult.type);
  
  // Calculate backoff
  const backoffMs = getAntiBotBackoffMs(antiBotResult.type, 0);
  
  throw new Error(
    `Anti-bot detected (${antiBotResult.type}). Backoff: ${Math.round(backoffMs / 1000)}s`
  );
}
```

### 3. Add anti-bot tracking to ExtractionMonitoring

```typescript
// In server/agents/extraction-monitoring.ts
static async recordAntiBot(retailer: string, type: string): Promise<void> {
  // Track anti-bot detections for alerting
  const key = `antibot:${retailer}:${type}`;
  // Increment counter, alert if threshold exceeded
}
```

## Testing

- [ ] Unit test detection patterns
- [ ] Test with mock pages containing CAPTCHA elements
- [ ] Verify backoff calculation
- [ ] Integration test with known challenge pages (if available)

## Acceptance Criteria

- [ ] Anti-bot detection utility created
- [ ] Extraction agent detects and logs anti-bot measures
- [ ] Appropriate backoff delays applied
- [ ] Monitoring tracks anti-bot events per retailer
- [ ] Alerts can be configured for repeated anti-bot detections
