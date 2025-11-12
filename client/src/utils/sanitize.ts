/**
 * HTML Sanitization Utility
 *
 * Sanitizes user-generated HTML content to prevent XSS attacks.
 * Uses DOMPurify when available in the browser.
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - Untrusted HTML string
 * @param options - Sanitization options
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(
  dirty: string,
  options: {
    allowedTags?: string[];
    allowedAttributes?: string[];
    allowDataAttributes?: boolean;
  } = {}
): string {
  // Default configuration for forum posts
  const defaultAllowedTags = [
    'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
    'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'span', 'div'
  ];

  const defaultAllowedAttributes = [
    'href', 'title', 'alt', 'src', 'class', 'id',
    'target', 'rel', 'width', 'height'
  ];

  const allowedTags = options.allowedTags || defaultAllowedTags;
  const allowedAttributes = options.allowedAttributes || defaultAllowedAttributes;

  // Try to use DOMPurify if available (client-side)
  if (typeof window !== 'undefined') {
    try {
      // DOMPurify is loaded via CDN or npm package
      const DOMPurify = (window as any).DOMPurify;

      if (DOMPurify && DOMPurify.sanitize) {
        return DOMPurify.sanitize(dirty, {
          ALLOWED_TAGS: allowedTags,
          ALLOWED_ATTR: allowedAttributes,
          ALLOW_DATA_ATTR: options.allowDataAttributes || false,
          ALLOW_ARIA_ATTR: true,
          RETURN_DOM: false,
          RETURN_DOM_FRAGMENT: false,
          RETURN_DOM_IMPORT: false,
          FORCE_BODY: true,
          SANITIZE_DOM: true,
          KEEP_CONTENT: true,
        });
      }
    } catch (error) {
      console.warn('DOMPurify not available, using fallback sanitizer');
    }
  }

  // Fallback: Basic sanitization (escapes all HTML)
  return escapeHtml(dirty);
}

/**
 * Escape HTML special characters
 * Basic fallback when DOMPurify is not available
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize text for safe display (removes all HTML)
 * @param text - Untrusted text
 * @returns Text with HTML entities escaped
 */
export function sanitizeText(text: string): string {
  return escapeHtml(text);
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 * @param url - Untrusted URL
 * @returns Sanitized URL or empty string if unsafe
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  if (dangerousProtocols.some(protocol => trimmed.startsWith(protocol))) {
    return '';
  }

  // Only allow http, https, and relative URLs
  if (!trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('/') &&
      !trimmed.startsWith('#')) {
    return '';
  }

  return url;
}

/**
 * Load DOMPurify dynamically (if not already loaded)
 * This function can be called on app initialization
 */
export async function loadDOMPurify(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as any).DOMPurify) return; // Already loaded

  try {
    // Try to import from npm package first
    const DOMPurify = await import('dompurify');
    (window as any).DOMPurify = DOMPurify.default || DOMPurify;
  } catch (error) {
    // Fallback to CDN
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js';
      script.integrity = 'sha512-HpEGpWBk2RQXZ4AqR4B5HGZf3VHhKIqfNYNI5t0FP9GQx1HfPZ/+dB1wAb8jYVW0qUgG9p5mBSUbYGN3H/Y0A==';
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load DOMPurify from CDN'));
      document.head.appendChild(script);
    });
  }
}
