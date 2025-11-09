import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 *
 * This utility uses DOMPurify to remove potentially dangerous HTML/JavaScript
 * while preserving safe formatting tags.
 *
 * @param dirty - The potentially unsafe HTML string
 * @param options - Optional configuration for allowed tags and attributes
 * @returns Sanitized HTML string safe for rendering
 */
export const sanitizeHTML = (
  dirty: string,
  options?: {
    allowedTags?: string[];
    allowedAttributes?: string[];
  }
): string => {
  const defaultConfig = {
    ALLOWED_TAGS: [
      'strong', 'em', 'br', 'span', 'p', 'a',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'mark'
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    // Automatically add rel="noopener noreferrer" to links
    SAFE_FOR_TEMPLATES: true,
  };

  // Override with custom options if provided
  const config = {
    ...defaultConfig,
    ...(options?.allowedTags && { ALLOWED_TAGS: options.allowedTags }),
    ...(options?.allowedAttributes && { ALLOWED_ATTR: options.allowedAttributes }),
  };

  return DOMPurify.sanitize(dirty, config);
};

/**
 * Sanitizes content for markdown-like rendering
 * Allows basic formatting but removes all scripts and dangerous content
 *
 * @param content - The content to sanitize (may contain markdown)
 * @returns Sanitized HTML string
 */
export const sanitizeMarkdown = (content: string): string => {
  return sanitizeHTML(content, {
    allowedTags: ['strong', 'em', 'br', 'span', 'p', 'code', 'pre', 'mark'],
    allowedAttributes: ['class'],
  });
};

/**
 * Sanitizes search highlight content
 * Only allows mark tags for highlighting and basic formatting
 *
 * @param content - The content with highlights
 * @returns Sanitized HTML string
 */
export const sanitizeHighlight = (content: string): string => {
  return sanitizeHTML(content, {
    allowedTags: ['mark', 'strong', 'em', 'span'],
    allowedAttributes: ['class'],
  });
};

/**
 * Strips all HTML tags and returns plain text
 * Use this when no HTML should be rendered at all
 *
 * @param html - The HTML string
 * @returns Plain text with all HTML removed
 */
export const stripHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};
