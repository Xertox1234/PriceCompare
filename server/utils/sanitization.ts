/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
/**
 * Enhanced Input Sanitization with DOMPurify
 *
 * Provides comprehensive XSS prevention using industry-standard DOMPurify library.
 * Replaces regex-based sanitization with proven, battle-tested HTML sanitization.
 */

import DOMPurify from 'isomorphic-dompurify';
import { logger } from './logger';

/**
 * Sanitization context types
 */
export enum SanitizationContext {
  PLAIN_TEXT = 'plain_text',        // Strip all HTML
  RICH_TEXT = 'rich_text',          // Allow safe HTML subset (forum posts, descriptions)
  LIMITED_HTML = 'limited_html',    // Very restricted HTML (product names, titles)
  URL = 'url',                      // URL validation and sanitization
  SEARCH_QUERY = 'search_query',    // Search input sanitization
}

/**
 * DOMPurify configuration for different contexts
 */
const SANITIZATION_CONFIGS = {
  /**
   * Plain text - strip ALL HTML tags
   * Use for: usernames, simple text fields
   */
  [SanitizationContext.PLAIN_TEXT]: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep text content, just remove tags
  },

  /**
   * Rich text - allow safe HTML subset
   * Use for: forum posts, product descriptions, reviews
   */
  [SanitizationContext.RICH_TEXT]: {
    ALLOWED_TAGS: [
      // Text formatting
      'b', 'i', 'em', 'strong', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
      // Structure
      'p', 'br', 'hr', 'blockquote', 'pre', 'code',
      // Lists
      'ul', 'ol', 'li',
      // Links (with restrictions)
      'a',
      // Headings
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel',
    ],
    // Only allow safe URL schemes
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):)/i,
    // Always add noopener/noreferrer to links
    ADD_ATTR: ['target', 'rel'],
    // Sanitize attributes
    SANITIZE_DOM: true,
  },

  /**
   * Limited HTML - very restricted
   * Use for: product titles, short descriptions
   */
  [SanitizationContext.LIMITED_HTML]: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  },

  /**
   * URL sanitization
   * Use for: link validation
   */
  [SanitizationContext.URL]: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    ALLOWED_URI_REGEXP: /^(?:https?:)/i,
  },

  /**
   * Search query sanitization
   * Use for: search inputs, filters
   */
  [SanitizationContext.SEARCH_QUERY]: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  },
};

/**
 * Sanitize string input based on context
 */
export function sanitizeString(
  input: string,
  context: SanitizationContext = SanitizationContext.PLAIN_TEXT
): string {
  if (typeof input !== 'string') {
    logger.warn('sanitizeString called with non-string input', { type: typeof input });
    return '';
  }

  if (input.length === 0) {
    return '';
  }

  const config = SANITIZATION_CONFIGS[context];

  try {
    // Additional processing for links
    if (context === SanitizationContext.RICH_TEXT) {
      // Add noopener noreferrer to all links automatically
      const sanitized = DOMPurify.sanitize(input, config);
      return sanitized.replace(/<a /g, '<a rel="noopener noreferrer" target="_blank" ');
    }

    return DOMPurify.sanitize(input, config);
  } catch (error) {
    logger.error('DOMPurify sanitization error', {
      error: error instanceof Error ? error.message : String(error),
      context,
      inputLength: input.length,
    });
    // On error, return empty string for safety
    return '';
  }
}

/**
 * Sanitize URL and validate it's safe
 */
export function sanitizeURL(url: string): string | null {
  if (typeof url !== 'string' || !url) {
    return null;
  }

  // Remove any whitespace
  url = url.trim();

  // Check for javascript: protocol and other dangerous schemes
  const dangerousSchemes = /^(javascript|data|vbscript|file|about):/i;
  if (dangerousSchemes.test(url)) {
    logger.warn('Blocked dangerous URL scheme', { url: url.substring(0, 50) });
    return null;
  }

  // Validate URL format
  try {
    const urlObj = new URL(url);

    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }

    return urlObj.href;
  } catch {
    // If URL parsing fails, it's not a valid URL
    // Check if it's a relative URL
    if (url.startsWith('/') && !url.startsWith('//')) {
      // Relative URL is safe
      return url;
    }
    return null;
  }
}

/**
 * Sanitize object recursively
 * Applies sanitization to all string values in an object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  context: SanitizationContext = SanitizationContext.PLAIN_TEXT
): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item =>
      typeof item === 'object' ? sanitizeObject(item as Record<string, unknown>, context) :
      typeof item === 'string' ? sanitizeString(item, context) :
      item
    ) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value, context);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value as Record<string, unknown>, context);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized as T;
}

/**
 * Sanitize forum post content
 * Special handling for rich text with safe HTML subset
 */
export function sanitizeForumPost(content: string): {
  html: string;
  text: string;
} {
  // Sanitize HTML content
  const html = sanitizeString(content, SanitizationContext.RICH_TEXT);

  // Also create plain text version for search/preview
  const text = sanitizeString(content, SanitizationContext.PLAIN_TEXT);

  return { html, text };
}

/**
 * Sanitize search query
 * Prevents XSS in search results while preserving search intent
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    return '';
  }

  // Trim and sanitize
  const sanitized = sanitizeString(query.trim(), SanitizationContext.SEARCH_QUERY);

  // Limit length to prevent DoS
  const MAX_SEARCH_LENGTH = 200;
  return sanitized.substring(0, MAX_SEARCH_LENGTH);
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') {
    return null;
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const sanitized = email.trim().toLowerCase();

  if (!emailRegex.test(sanitized)) {
    return null;
  }

  // Additional checks for dangerous patterns
  if (sanitized.includes('<') || sanitized.includes('>') || sanitized.includes('"')) {
    return null;
  }

  return sanitized;
}

/**
 * Test suite for XSS prevention
 * Use in tests to verify sanitization works correctly
 */
export const XSS_TEST_CASES = [
  // Script tags
  '<script>alert("XSS")</script>',
  '<script src="evil.js"></script>',
  '<SCRIPT>alert("XSS")</SCRIPT>',

  // Event handlers
  '<img src=x onerror="alert(1)">',
  '<body onload="alert(1)">',
  '<div onclick="alert(1)">Click me</div>',

  // JavaScript protocol
  '<a href="javascript:alert(1)">Click</a>',
  '<iframe src="javascript:alert(1)"></iframe>',

  // Data URIs
  '<a href="data:text/html,<script>alert(1)</script>">Click</a>',

  // SVG attacks
  '<svg onload="alert(1)">',
  '<svg><script>alert(1)</script></svg>',

  // Style-based attacks
  '<style>@import "http://evil.com/xss.css";</style>',
  '<div style="background:url(javascript:alert(1))">',

  // HTML comments
  '<!--<script>alert(1)</script>-->',

  // Encoding attacks
  '<img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;>',
];

/**
 * Test sanitization against common XSS vectors
 * Returns true if all tests pass (no XSS detected)
 */
export function testXSSPrevention(): boolean {
  let allPassed = true;

  for (const testCase of XSS_TEST_CASES) {
    const sanitized = sanitizeString(testCase, SanitizationContext.PLAIN_TEXT);

    // Check if any dangerous patterns remain
    const dangerous = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    for (const pattern of dangerous) {
      if (pattern.test(sanitized)) {
        logger.error('XSS test failed', {
          testCase: testCase.substring(0, 50),
          sanitized,
          pattern: pattern.toString(),
        });
        allPassed = false;
      }
    }
  }

  return allPassed;
}

/**
 * Legacy compatibility: Export functions with old names
 * Can be removed after migration
 */
export const sanitize = sanitizeString;
export const sanitizeHtml = (html: string) => sanitizeString(html, SanitizationContext.RICH_TEXT);
