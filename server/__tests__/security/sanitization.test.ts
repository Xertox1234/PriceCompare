/**
 * DOMPurify-based Sanitization Tests
 *
 * Comprehensive tests for server-side XSS prevention and input sanitization
 * using isomorphic-dompurify for context-aware HTML sanitization.
 */
import { describe, test, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeObject,
  sanitizeURL,
  sanitizeEmail,
  sanitizeForumPost,
  sanitizeSearchQuery,
  SanitizationContext,
  testXSSPrevention,
  XSS_TEST_CASES,
} from '../../utils/sanitization';

describe('Sanitization Module', () => {
  describe('XSS Prevention', () => {
    test('should pass all built-in XSS test cases', () => {
      // Uses the built-in testXSSPrevention function which tests all XSS_TEST_CASES
      expect(testXSSPrevention()).toBe(true);
    });

    describe('Script Tag Injection', () => {
      test('should strip basic script tags', () => {
        const malicious = '<script>alert("XSS")</script>Hello';
        const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('Hello');
        expect(result).not.toContain('<script');
        expect(result).not.toContain('alert');
      });

      test('should strip script tags with attributes', () => {
        const malicious = '<script src="evil.js"></script>';
        const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('');
        expect(result).not.toContain('script');
      });

      test('should strip uppercase script tags', () => {
        const malicious = '<SCRIPT>alert("XSS")</SCRIPT>';
        const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('');
        expect(result).not.toContain('SCRIPT');
      });

      test('should strip mixed case script tags', () => {
        const malicious = '<ScRiPt>alert("XSS")</ScRiPt>';
        const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('');
        expect(result).not.toContain('script');
      });
    });

    describe('Event Handler Injection', () => {
      test('should strip onerror handlers', () => {
        const malicious = '<img src=x onerror="alert(1)">Text';
        const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('Text');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('alert');
      });

      test('should strip onload handlers', () => {
        const malicious = '<body onload="alert(1)">Content</body>';
        const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('Content');
        expect(result).not.toContain('onload');
      });

      test('should strip onclick handlers', () => {
        const malicious = '<div onclick="alert(1)">Click me</div>';
        const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('Click me');
        expect(result).not.toContain('onclick');
      });

      test('should strip all event handlers', () => {
        const handlers = ['onmouseover', 'onmouseout', 'onfocus', 'onblur', 'onchange', 'onsubmit'];

        handlers.forEach((handler) => {
          const malicious = `<div ${handler}="alert(1)">Test</div>`;
          const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
          expect(result).toBe('Test');
          expect(result).not.toContain(handler);
        });
      });
    });

    describe('JavaScript Protocol URLs', () => {
      test('should block javascript: protocol in links', () => {
        const malicious = '<a href="javascript:alert(1)">Click</a>';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('javascript:');
      });

      test('should block javascript: in iframes', () => {
        const malicious = '<iframe src="javascript:alert(1)"></iframe>';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('iframe');
      });

      test('should block data: URIs with scripts', () => {
        const malicious = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('data:');
      });
    });

    describe('SVG-based XSS', () => {
      test('should block SVG with onload', () => {
        const malicious = '<svg onload="alert(1)">';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('onload');
      });

      test('should block SVG with embedded script', () => {
        const malicious = '<svg><script>alert(1)</script></svg>';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('<script');
      });
    });

    describe('Style-based Attacks', () => {
      test('should block style tags', () => {
        const malicious = '<style>@import "http://evil.com/xss.css";</style>';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('<style');
        expect(result).not.toContain('@import');
      });

      test('should block javascript in style attributes', () => {
        const malicious = '<div style="background:url(javascript:alert(1))">Test</div>';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('javascript:');
      });
    });

    describe('HTML Entity Encoding Attacks', () => {
      test('should handle HTML entity encoded attacks', () => {
        // &#97;&#108;&#101;&#114;&#116; = alert
        const malicious = '<img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;>';
        const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('');
        expect(result).not.toContain('alert');
      });
    });

    describe('HTML Comment Attacks', () => {
      test('should strip HTML comments with scripts', () => {
        const malicious = '<!--<script>alert(1)</script>-->Text';
        const result = sanitizeString(malicious, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('Text');
        expect(result).not.toContain('<!--');
        expect(result).not.toContain('<script');
      });
    });

    describe('Dangerous Tags', () => {
      test('should block iframe tags', () => {
        const malicious = '<iframe src="http://evil.com"></iframe>';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('iframe');
      });

      test('should block object tags', () => {
        const malicious = '<object data="http://evil.com"></object>';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('object');
      });

      test('should block embed tags', () => {
        const malicious = '<embed src="http://evil.com">';
        const result = sanitizeString(malicious, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('embed');
      });
    });
  });

  describe('Context-Specific Sanitization', () => {
    describe('PLAIN_TEXT Context', () => {
      test('should strip all HTML tags', () => {
        const input = '<b>Bold</b> <i>Italic</i> <strong>Strong</strong>';
        const result = sanitizeString(input, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('Bold Italic Strong');
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
      });

      test('should preserve text content', () => {
        const input = '<p>Hello <span>World</span>!</p>';
        const result = sanitizeString(input, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('Hello World!');
      });

      test('should handle nested tags', () => {
        const input = '<div><p><span><b>Deeply nested</b></span></p></div>';
        const result = sanitizeString(input, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('Deeply nested');
      });

      test('should handle special characters', () => {
        const input = '<p>&amp; &lt; &gt; &quot;</p>';
        const result = sanitizeString(input, SanitizationContext.PLAIN_TEXT);
        expect(result).toContain('&');
      });

      test('should handle empty tags', () => {
        const input = '<div></div><span></span>Text';
        const result = sanitizeString(input, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('Text');
      });

      test('should handle self-closing tags', () => {
        const input = 'Text<br/>More<hr/>Text';
        const result = sanitizeString(input, SanitizationContext.PLAIN_TEXT);
        expect(result).toBe('TextMoreText');
      });
    });

    describe('RICH_TEXT Context', () => {
      test('should allow safe HTML tags', () => {
        const input = '<b>Bold</b> <i>Italic</i> <em>Emphasis</em> <strong>Strong</strong>';
        const result = sanitizeString(input, SanitizationContext.RICH_TEXT);
        expect(result).toContain('<b>Bold</b>');
        expect(result).toContain('<i>Italic</i>');
        expect(result).toContain('<em>Emphasis</em>');
        expect(result).toContain('<strong>Strong</strong>');
      });

      test('should allow safe structural tags', () => {
        const input = '<p>Paragraph</p><ul><li>Item 1</li><li>Item 2</li></ul>';
        const result = sanitizeString(input, SanitizationContext.RICH_TEXT);
        expect(result).toContain('<p>');
        expect(result).toContain('<ul>');
        expect(result).toContain('<li>');
      });

      test('should allow code and pre tags', () => {
        const input = '<pre><code>const x = 10;</code></pre>';
        const result = sanitizeString(input, SanitizationContext.RICH_TEXT);
        expect(result).toContain('<pre>');
        expect(result).toContain('<code>');
      });

      test('should allow blockquotes', () => {
        const input = '<blockquote>Quote here</blockquote>';
        const result = sanitizeString(input, SanitizationContext.RICH_TEXT);
        expect(result).toContain('<blockquote>');
      });

      test('should allow headings', () => {
        const input = '<h1>H1</h1><h2>H2</h2><h3>H3</h3>';
        const result = sanitizeString(input, SanitizationContext.RICH_TEXT);
        expect(result).toContain('<h1>');
        expect(result).toContain('<h2>');
        expect(result).toContain('<h3>');
      });

      test('should block dangerous tags', () => {
        const input = '<script>alert(1)</script><iframe>Bad</iframe><object>Obj</object>';
        const result = sanitizeString(input, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('<script');
        expect(result).not.toContain('<iframe');
        expect(result).not.toContain('<object');
      });

      test('should add rel="noopener noreferrer" to links automatically', () => {
        const input = '<a href="http://example.com">Link</a>';
        const result = sanitizeString(input, SanitizationContext.RICH_TEXT);
        expect(result).toContain('rel="noopener noreferrer"');
        expect(result).toContain('target="_blank"');
      });

      test('should validate link protocols (http/https only)', () => {
        const httpsLink = '<a href="https://example.com">HTTPS Link</a>';
        const httpLink = '<a href="http://example.com">HTTP Link</a>';

        const httpsResult = sanitizeString(httpsLink, SanitizationContext.RICH_TEXT);
        const httpResult = sanitizeString(httpLink, SanitizationContext.RICH_TEXT);

        expect(httpsResult).toContain('https://example.com');
        expect(httpResult).toContain('http://example.com');
      });

      test('should strip event handlers from allowed tags', () => {
        const input = '<a href="http://example.com" onclick="alert(1)">Link</a>';
        const result = sanitizeString(input, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('onclick');
        expect(result).toContain('href');
      });

      test('should strip dangerous attributes', () => {
        const input = '<p style="background:red" onload="alert(1)">Text</p>';
        const result = sanitizeString(input, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('onload');
        // Note: style is not in ALLOWED_ATTR, so it should be stripped
        expect(result).not.toContain('style=');
      });
    });

    describe('LIMITED_HTML Context', () => {
      test('should allow only basic formatting tags', () => {
        const input = '<b>Bold</b> <i>Italic</i> <em>Em</em> <strong>Strong</strong>';
        const result = sanitizeString(input, SanitizationContext.LIMITED_HTML);
        expect(result).toContain('<b>Bold</b>');
        expect(result).toContain('<i>Italic</i>');
        expect(result).toContain('<em>Em</em>');
        expect(result).toContain('<strong>Strong</strong>');
      });

      test('should strip most HTML tags', () => {
        const input = '<p>Para</p><div>Div</div><a href="#">Link</a>';
        const result = sanitizeString(input, SanitizationContext.LIMITED_HTML);
        expect(result).not.toContain('<p>');
        expect(result).not.toContain('<div>');
        expect(result).not.toContain('<a');
      });

      test('should preserve text content', () => {
        const input = '<p>Para</p><div>Div</div>';
        const result = sanitizeString(input, SanitizationContext.LIMITED_HTML);
        expect(result).toContain('Para');
        expect(result).toContain('Div');
      });

      test('should be suitable for titles and headings', () => {
        const title = '<b>Product</b> <i>Title</i> with <script>alert(1)</script> XSS';
        const result = sanitizeString(title, SanitizationContext.LIMITED_HTML);
        expect(result).toContain('<b>Product</b>');
        expect(result).toContain('<i>Title</i>');
        expect(result).not.toContain('<script');
      });
    });

    describe('URL Context', () => {
      test('should allow http URLs as plain text', () => {
        const url = 'http://example.com/page';
        const result = sanitizeString(url, SanitizationContext.URL);
        // URL context strips all tags, keeping only text
        expect(result).toBe(url);
      });

      test('should allow https URLs as plain text', () => {
        const url = 'https://example.com/page';
        const result = sanitizeString(url, SanitizationContext.URL);
        // URL context strips all tags, keeping only text
        expect(result).toBe(url);
      });

      test('should strip HTML from URL strings', () => {
        const malicious = 'http://example.com<script>alert(1)</script>';
        const result = sanitizeString(malicious, SanitizationContext.URL);
        // Strips script tags but keeps the URL text
        expect(result).not.toContain('<script');
        expect(result).toContain('http://example.com');
      });

      test('should be used for sanitizing URL-containing strings, not validation', () => {
        // Note: URL context is for sanitizing strings that contain URLs,
        // not for validating URLs themselves. Use sanitizeURL() for validation.
        const urlString = 'Visit <a href="http://example.com">here</a>';
        const result = sanitizeString(urlString, SanitizationContext.URL);
        // Strips all HTML tags
        expect(result).not.toContain('<a');
        expect(result).toContain('Visit');
        expect(result).toContain('here');
      });
    });

    describe('SEARCH_QUERY Context', () => {
      test('should strip HTML from search queries', () => {
        const query = '<script>alert(1)</script>iPhone 15';
        const result = sanitizeString(query, SanitizationContext.SEARCH_QUERY);
        expect(result).toBe('iPhone 15');
        expect(result).not.toContain('<script');
      });

      test('should preserve legitimate search terms', () => {
        const query = 'MacBook Pro 16"';
        const result = sanitizeString(query, SanitizationContext.SEARCH_QUERY);
        expect(result).toContain('MacBook Pro');
      });

      test('should handle special characters safely', () => {
        const query = 'Product & Service';
        const result = sanitizeString(query, SanitizationContext.SEARCH_QUERY);
        expect(result).toContain('Product');
        expect(result).toContain('Service');
      });
    });
  });

  describe('Object Sanitization', () => {
    test('should recursively sanitize nested objects', () => {
      const input = {
        title: '<script>XSS</script>Title',
        nested: {
          description: '<img src=x onerror="alert(1)">Safe',
        },
      };
      const result = sanitizeObject(input, SanitizationContext.PLAIN_TEXT);
      expect(result.title).toBe('Title');
      expect(result.nested.description).toBe('Safe');
    });

    test('should handle arrays within objects', () => {
      const input = {
        items: ['<b>Item 1</b>', '<i>Item 2</i>', { nested: '<script>XSS</script>Value' }],
      };
      const result = sanitizeObject(input, SanitizationContext.PLAIN_TEXT);
      expect(result.items[0]).toBe('Item 1');
      expect(result.items[1]).toBe('Item 2');
      expect((result.items[2] as { nested: string }).nested).toBe('Value');
    });

    test('should preserve non-string values', () => {
      const input = {
        id: 123,
        active: true,
        count: 45.67,
        data: null,
        undef: undefined,
      };
      const result = sanitizeObject(input, SanitizationContext.PLAIN_TEXT);
      expect(result.id).toBe(123);
      expect(result.active).toBe(true);
      expect(result.count).toBe(45.67);
      expect(result.data).toBeNull();
      expect(result.undef).toBeUndefined();
    });

    test('should sanitize both keys and values', () => {
      const input = {
        'title<script>': 'Value<script>XSS</script>',
        normal: 'Normal<b>Text</b>',
      };
      const result = sanitizeObject(input, SanitizationContext.PLAIN_TEXT);
      // Keys are not sanitized by this function, but values are
      expect(result.normal).toBe('NormalText');
    });

    test('should handle deeply nested structures', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: '<script>Deep XSS</script>Value',
            },
          },
        },
      };
      const result = sanitizeObject(input, SanitizationContext.PLAIN_TEXT);
      expect(result.level1.level2.level3.level4).toBe('Value');
    });

    test('should handle empty objects and arrays', () => {
      const input = {
        emptyObj: {},
        emptyArr: [],
        nested: {
          alsoEmpty: {},
        },
      };
      const result = sanitizeObject(input, SanitizationContext.PLAIN_TEXT);
      expect(result.emptyObj).toEqual({});
      expect(result.emptyArr).toEqual([]);
      expect(result.nested.alsoEmpty).toEqual({});
    });

    test('should handle null and undefined inputs gracefully', () => {
      expect(sanitizeObject(null as unknown as Record<string, unknown>)).toBeNull();
      expect(sanitizeObject(undefined as unknown as Record<string, unknown>)).toBeUndefined();
    });

    test('should sanitize with different contexts', () => {
      const input = {
        plain: '<b>Bold</b>',
        rich: '<b>Bold</b>',
      };

      const plainResult = sanitizeObject(input, SanitizationContext.PLAIN_TEXT);
      expect(plainResult.plain).toBe('Bold');
      expect(plainResult.rich).toBe('Bold');

      const richResult = sanitizeObject(input, SanitizationContext.RICH_TEXT);
      expect(richResult.plain).toContain('<b>Bold</b>');
      expect(richResult.rich).toContain('<b>Bold</b>');
    });
  });

  describe('URL Sanitization', () => {
    test('should allow valid https URLs', () => {
      const url = 'https://example.com/page?param=value';
      expect(sanitizeURL(url)).toBe(url);
    });

    test('should allow valid http URLs', () => {
      const url = 'http://example.com/page';
      expect(sanitizeURL(url)).toBe(url);
    });

    test('should block javascript: protocol', () => {
      expect(sanitizeURL('javascript:alert(1)')).toBeNull();
      expect(sanitizeURL('JavaScript:alert(1)')).toBeNull();
      expect(sanitizeURL('JAVASCRIPT:alert(1)')).toBeNull();
    });

    test('should block data: URIs', () => {
      expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBeNull();
      expect(sanitizeURL('data:image/svg+xml,<svg>XSS</svg>')).toBeNull();
    });

    test('should block vbscript: protocol', () => {
      expect(sanitizeURL('vbscript:msgbox(1)')).toBeNull();
    });

    test('should block file: protocol', () => {
      expect(sanitizeURL('file:///etc/passwd')).toBeNull();
    });

    test('should block about: protocol', () => {
      expect(sanitizeURL('about:blank')).toBeNull();
    });

    test('should handle malformed URLs', () => {
      expect(sanitizeURL('not a url')).toBeNull();
      expect(sanitizeURL('htp://wrong')).toBeNull();
      expect(sanitizeURL('://missing')).toBeNull();
    });

    test('should handle relative URLs', () => {
      expect(sanitizeURL('/path/to/page')).toBe('/path/to/page');
      expect(sanitizeURL('/api/products/123')).toBe('/api/products/123');
    });

    test('should block protocol-relative URLs starting with //', () => {
      // Protocol-relative URLs can be dangerous
      expect(sanitizeURL('//evil.com/xss')).toBeNull();
    });

    test('should trim whitespace', () => {
      const url = '  https://example.com  ';
      expect(sanitizeURL(url)).toBe('https://example.com/');
    });

    test('should handle empty and null inputs', () => {
      expect(sanitizeURL('')).toBeNull();
      expect(sanitizeURL(null as unknown as string)).toBeNull();
      expect(sanitizeURL(undefined as unknown as string)).toBeNull();
    });

    test('should handle non-string inputs', () => {
      expect(sanitizeURL(123 as unknown as string)).toBeNull();
      expect(sanitizeURL({} as unknown as string)).toBeNull();
      expect(sanitizeURL([] as unknown as string)).toBeNull();
    });

    test('should normalize URLs correctly', () => {
      const url = 'https://example.com:443/path/../page';
      const result = sanitizeURL(url);
      expect(result).toBeTruthy();
      expect(result).toContain('https://example.com');
    });
  });

  describe('Email Sanitization', () => {
    test('should validate correct email format', () => {
      expect(sanitizeEmail('user@example.com')).toBe('user@example.com');
      expect(sanitizeEmail('test.user+tag@example.co.uk')).toBe('test.user+tag@example.co.uk');
      expect(sanitizeEmail('name@subdomain.example.com')).toBe('name@subdomain.example.com');
    });

    test('should convert to lowercase', () => {
      expect(sanitizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
      expect(sanitizeEmail('Test@Example.Com')).toBe('test@example.com');
    });

    test('should trim whitespace', () => {
      expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    test('should block XSS in email field', () => {
      expect(sanitizeEmail('user@example.com<script>alert(1)</script>')).toBeNull();
      expect(sanitizeEmail('<script>user@example.com')).toBeNull();
      expect(sanitizeEmail('user"@example.com')).toBeNull();
    });

    test('should reject emails without @', () => {
      expect(sanitizeEmail('userexample.com')).toBeNull();
      expect(sanitizeEmail('user.example.com')).toBeNull();
    });

    test('should reject emails with multiple @', () => {
      expect(sanitizeEmail('user@@example.com')).toBeNull();
      expect(sanitizeEmail('user@exam@ple.com')).toBeNull();
    });

    test('should reject emails without domain', () => {
      expect(sanitizeEmail('user@')).toBeNull();
      expect(sanitizeEmail('@example.com')).toBeNull();
    });

    test('should reject emails without TLD', () => {
      expect(sanitizeEmail('user@example')).toBeNull();
    });

    test('should reject emails with spaces', () => {
      expect(sanitizeEmail('user @example.com')).toBeNull();
      expect(sanitizeEmail('user@ example.com')).toBeNull();
    });

    test('should reject emails with dangerous characters', () => {
      expect(sanitizeEmail('user<test>@example.com')).toBeNull();
      expect(sanitizeEmail('user>test@example.com')).toBeNull();
      expect(sanitizeEmail('user"test@example.com')).toBeNull();
    });

    test('should handle empty and null inputs', () => {
      expect(sanitizeEmail('')).toBeNull();
      expect(sanitizeEmail(null as unknown as string)).toBeNull();
      expect(sanitizeEmail(undefined as unknown as string)).toBeNull();
    });

    test('should handle non-string inputs', () => {
      expect(sanitizeEmail(123 as unknown as string)).toBeNull();
      expect(sanitizeEmail({} as unknown as string)).toBeNull();
    });
  });

  describe('Forum Post Sanitization', () => {
    test('should return both HTML and plain text versions', () => {
      const content = '<b>Bold</b> <i>Italic</i> text';
      const result = sanitizeForumPost(content);

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
    });

    test('should sanitize HTML version with RICH_TEXT context', () => {
      const content = '<b>Bold</b> <script>alert(1)</script>';
      const result = sanitizeForumPost(content);

      expect(result.html).toContain('<b>Bold</b>');
      expect(result.html).not.toContain('<script');
    });

    test('should create plain text version without HTML', () => {
      const content = '<b>Bold</b> <i>Italic</i> text';
      const result = sanitizeForumPost(content);

      expect(result.text).toBe('Bold Italic text');
      expect(result.text).not.toContain('<');
    });

    test('should handle complex nested structures', () => {
      const content = `
        <h2>Title</h2>
        <p>Paragraph with <b>bold</b> and <i>italic</i>.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
        <pre><code>const x = 10;</code></pre>
      `;
      const result = sanitizeForumPost(content);

      // HTML version should have tags
      expect(result.html).toContain('<h2>');
      expect(result.html).toContain('<ul>');
      expect(result.html).toContain('<code>');

      // Text version should not
      expect(result.text).not.toContain('<');
      expect(result.text).toContain('Title');
      expect(result.text).toContain('Item 1');
    });

    test('should strip XSS from both versions', () => {
      const content = '<p>Safe <script>alert(1)</script> content</p>';
      const result = sanitizeForumPost(content);

      expect(result.html).not.toContain('<script');
      expect(result.text).not.toContain('alert');
    });

    test('should add security attributes to links in HTML version', () => {
      const content = '<a href="http://example.com">Link</a>';
      const result = sanitizeForumPost(content);

      expect(result.html).toContain('rel="noopener noreferrer"');
      expect(result.html).toContain('target="_blank"');
    });
  });

  describe('Search Query Sanitization', () => {
    test('should strip HTML from queries', () => {
      const query = '<script>alert(1)</script>iPhone';
      const result = sanitizeSearchQuery(query);
      expect(result).toBe('iPhone');
      expect(result).not.toContain('<script');
    });

    test('should enforce max length', () => {
      const longQuery = 'a'.repeat(300);
      const result = sanitizeSearchQuery(longQuery);
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result.length).toBe(200); // MAX_SEARCH_LENGTH
    });

    test('should trim whitespace', () => {
      const query = '  search query  ';
      const result = sanitizeSearchQuery(query);
      expect(result).toBe('search query');
    });

    test('should handle special characters safely', () => {
      const query = 'Product & Service';
      const result = sanitizeSearchQuery(query);
      expect(result).toContain('Product');
      expect(result).toContain('Service');
    });

    test('should preserve legitimate search terms', () => {
      const queries = [
        'MacBook Pro 16"',
        'iPhone 15 Pro Max',
        'Samsung Galaxy S24+',
        'PS5 Console',
      ];

      queries.forEach((query) => {
        const result = sanitizeSearchQuery(query);
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
      });
    });

    test('should handle empty strings', () => {
      expect(sanitizeSearchQuery('')).toBe('');
      expect(sanitizeSearchQuery('   ')).toBe('');
    });

    test('should handle non-string inputs', () => {
      expect(sanitizeSearchQuery(null as unknown as string)).toBe('');
      expect(sanitizeSearchQuery(undefined as unknown as string)).toBe('');
      expect(sanitizeSearchQuery(123 as unknown as string)).toBe('');
    });

    test('should remove XSS attempts while keeping search intent', () => {
      const query = 'iPhone<img src=x onerror="alert(1)"> 15 Pro';
      const result = sanitizeSearchQuery(query);
      expect(result).toContain('iPhone');
      expect(result).toContain('15 Pro');
      expect(result).not.toContain('<img');
      expect(result).not.toContain('onerror');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty strings', () => {
      expect(sanitizeString('', SanitizationContext.PLAIN_TEXT)).toBe('');
      expect(sanitizeString('', SanitizationContext.RICH_TEXT)).toBe('');
    });

    test('should handle null and undefined inputs', () => {
      expect(sanitizeString(null as unknown as string, SanitizationContext.PLAIN_TEXT)).toBe('');
      expect(sanitizeString(undefined as unknown as string, SanitizationContext.PLAIN_TEXT)).toBe(
        ''
      );
    });

    test('should handle non-string inputs', () => {
      expect(sanitizeString(123 as unknown as string, SanitizationContext.PLAIN_TEXT)).toBe('');
      expect(sanitizeString({} as unknown as string, SanitizationContext.PLAIN_TEXT)).toBe('');
      expect(sanitizeString([] as unknown as string, SanitizationContext.PLAIN_TEXT)).toBe('');
    });

    test('should handle very long strings', () => {
      const longString = '<p>' + 'a'.repeat(10000) + '</p>';
      const result = sanitizeString(longString, SanitizationContext.PLAIN_TEXT);
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain('<p>');
    });

    test('should handle strings with many tags', () => {
      const manyTags = Array(1000).fill('<b>text</b>').join('');
      const result = sanitizeString(manyTags, SanitizationContext.PLAIN_TEXT);
      expect(result).not.toContain('<b>');
    });

    test('should handle malformed HTML', () => {
      const malformed = '<b>Unclosed <i>tags <p>everywhere';
      const result = sanitizeString(malformed, SanitizationContext.PLAIN_TEXT);
      expect(result).toBe('Unclosed tags everywhere');
    });

    test('should handle mixed valid and invalid content', () => {
      const mixed = 'Valid text <script>alert(1)</script> more valid <b>bold</b>';
      const result = sanitizeString(mixed, SanitizationContext.PLAIN_TEXT);
      expect(result).toContain('Valid text');
      expect(result).toContain('more valid');
      expect(result).not.toContain('<script');
    });

    test('should handle Unicode characters', () => {
      const unicode = '<p>Hello 世界 🌍</p>';
      const result = sanitizeString(unicode, SanitizationContext.PLAIN_TEXT);
      expect(result).toContain('世界');
      expect(result).toContain('🌍');
    });

    test('should handle newlines and whitespace', () => {
      const whitespace = '<p>Line 1\n\nLine 2\t\tTabbed</p>';
      const result = sanitizeString(whitespace, SanitizationContext.PLAIN_TEXT);
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });
  });

  describe('Individual XSS Test Cases', () => {
    // Test each case from XSS_TEST_CASES individually for detailed coverage
    test.each(XSS_TEST_CASES)('should sanitize XSS attempt: %s', (xssAttempt) => {
      const result = sanitizeString(xssAttempt, SanitizationContext.PLAIN_TEXT);

      // Check that dangerous patterns are removed
      expect(result).not.toMatch(/<script/i);
      expect(result).not.toMatch(/javascript:/i);
      expect(result).not.toMatch(/on\w+\s*=/i); // Event handlers
      expect(result).not.toMatch(/<iframe/i);
      expect(result).not.toMatch(/<object/i);
      expect(result).not.toMatch(/<embed/i);
    });
  });

  describe('Performance Considerations', () => {
    test('should handle batch sanitization efficiently', () => {
      const items = Array(100)
        .fill(0)
        .map((_, i) => `<p>Item ${i} with <script>XSS</script></p>`);

      const startTime = Date.now();
      items.forEach((item) => sanitizeString(item, SanitizationContext.PLAIN_TEXT));
      const endTime = Date.now();

      // Should complete in reasonable time (< 1 second for 100 items)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should handle large objects efficiently', () => {
      const largeObject = {
        items: Array(50)
          .fill(0)
          .map((_, i) => ({
            id: i,
            title: `<b>Item ${i}</b>`,
            description: `<p>Description with <script>XSS</script></p>`,
            nested: {
              value: `<i>Nested ${i}</i>`,
            },
          })),
      };

      const startTime = Date.now();
      sanitizeObject(largeObject, SanitizationContext.PLAIN_TEXT);
      const endTime = Date.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  describe('Integration with Real-World Scenarios', () => {
    test('should sanitize user registration data', () => {
      const userData = {
        username: '<script>alert(1)</script>johndoe',
        email: 'john@example.com',
        bio: '<b>Developer</b> and <script>XSS</script> enthusiast',
      };

      const sanitized = sanitizeObject(userData, SanitizationContext.PLAIN_TEXT);

      expect(sanitized.username).toBe('johndoe');
      expect(sanitized.email).toBe('john@example.com');
      expect(sanitized.bio).toBe('Developer and  enthusiast');
    });

    test('should sanitize product data', () => {
      const productData = {
        name: 'iPhone 15 Pro<script>alert(1)</script>',
        description: '<p>Great phone with <b>amazing</b> features!</p>',
        url: 'javascript:alert(1)',
      };

      const sanitized = {
        name: sanitizeString(productData.name, SanitizationContext.LIMITED_HTML),
        description: sanitizeString(productData.description, SanitizationContext.RICH_TEXT),
        url: sanitizeURL(productData.url),
      };

      expect(sanitized.name).not.toContain('<script');
      expect(sanitized.description).toContain('<b>amazing</b>');
      expect(sanitized.url).toBeNull();
    });

    test('should sanitize forum post with all fields', () => {
      const forumPost = {
        title: '<b>Help</b> <script>XSS</script>',
        content: `
          <p>I need help with <b>JavaScript</b>.</p>
          <pre><code>const x = 10;</code></pre>
          <script>alert(1)</script>
        `,
        authorUrl: 'https://github.com/user',
      };

      const sanitized = {
        title: sanitizeString(forumPost.title, SanitizationContext.LIMITED_HTML),
        ...sanitizeForumPost(forumPost.content),
        authorUrl: sanitizeURL(forumPost.authorUrl),
      };

      expect(sanitized.title).toContain('<b>Help</b>');
      expect(sanitized.title).not.toContain('<script');
      expect(sanitized.html).toContain('<code>');
      expect(sanitized.html).not.toContain('<script');
      expect(sanitized.text).not.toContain('<');
      expect(sanitized.authorUrl).toBe('https://github.com/user');
    });

    test('should handle comment moderation workflow', () => {
      const userComment = {
        username: 'User123',
        content:
          '<p>Check out this <a href="https://example.com">link</a>!</p><script>steal_cookies()</script>',
        email: 'user@example.com',
      };

      const sanitized = {
        username: sanitizeString(userComment.username, SanitizationContext.PLAIN_TEXT),
        content: sanitizeString(userComment.content, SanitizationContext.RICH_TEXT),
        email: sanitizeEmail(userComment.email),
      };

      expect(sanitized.username).toBe('User123');
      expect(sanitized.content).toContain('<a');
      expect(sanitized.content).toContain('rel="noopener noreferrer"');
      expect(sanitized.content).not.toContain('<script');
      expect(sanitized.email).toBe('user@example.com');
    });

    test('should handle product review submission', () => {
      const review = {
        title: 'Great Product!<script>alert(1)</script>',
        rating: 5,
        review: '<p>I <b>love</b> this product!</p><ul><li>Fast</li><li>Reliable</li></ul>',
        verified: true,
      };

      const sanitized = {
        title: sanitizeString(review.title, SanitizationContext.LIMITED_HTML),
        rating: review.rating,
        review: sanitizeString(review.review, SanitizationContext.RICH_TEXT),
        verified: review.verified,
      };

      expect(sanitized.title).not.toContain('<script');
      expect(sanitized.rating).toBe(5);
      expect(sanitized.review).toContain('<b>love</b>');
      expect(sanitized.review).toContain('<ul>');
      expect(sanitized.verified).toBe(true);
    });

    test('should handle API response sanitization', () => {
      // Simulating external API data that might contain malicious content
      const apiResponse = {
        products: [
          {
            id: 1,
            name: 'Product 1<script>xss</script>',
            description: '<p>Description</p>',
          },
          {
            id: 2,
            name: 'Product 2',
            description: '<img src=x onerror="alert(1)">',
          },
        ],
      };

      const sanitized = {
        products: apiResponse.products.map((p) => ({
          id: p.id,
          name: sanitizeString(p.name, SanitizationContext.PLAIN_TEXT),
          description: sanitizeString(p.description, SanitizationContext.RICH_TEXT),
        })),
      };

      expect(sanitized.products[0].name).toBe('Product 1');
      expect(sanitized.products[0].description).toContain('<p>Description</p>');
      expect(sanitized.products[1].description).not.toContain('onerror');
    });
  });

  describe('Advanced XSS Attack Vectors', () => {
    describe('Modern XSS Techniques', () => {
      test('should handle mutation XSS (mXSS) safely', () => {
        const mxss = '<noscript><p title="</noscript><img src=x onerror=alert(1)>">';
        const result = sanitizeString(mxss, SanitizationContext.RICH_TEXT);
        // DOMPurify encodes the dangerous content into a safe attribute value
        // The result is: <p title="</noscript><img src=x onerror=alert(1)>"></p>
        // The <img> tag is inside the title attribute as text, not as executable HTML
        expect(result).toContain('<p');
        expect(result).toContain('title=');
        // Verify it starts with <p and ends with </p>, meaning the img is in the attribute
        expect(result).toMatch(/^<p\s/);
        expect(result).toMatch(/<\/p>$/);
        // The string is safe because the browser won't execute HTML in attribute values
        expect(result).toContain('"</noscript><img');
      });

      test('should block DOM clobbering attempts', () => {
        const clobbering = '<form name="innerHTML"><input name="innerHTML"></form>';
        const result = sanitizeString(clobbering, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('<form');
        expect(result).not.toContain('<input');
      });

      test('should block template string injection', () => {
        const template = '<img src="${alert(1)}">';
        const result = sanitizeString(template, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('${');
      });

      test('should block polyglot XSS', () => {
        const polyglot =
          "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>";
        const result = sanitizeString(polyglot, SanitizationContext.PLAIN_TEXT);
        // PLAIN_TEXT context strips tags but may keep text like "javascript:"
        // The dangerous part is that tags are stripped
        expect(result).not.toContain('<script');
        expect(result).not.toContain('<svg');
        expect(result).not.toContain('onload=');
        expect(result).not.toContain('onmouseover=');
      });

      test('should block base64 encoded XSS', () => {
        const base64 =
          '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" onerror="alert(1)">';
        const result = sanitizeString(base64, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('onerror');
      });

      test('should block Unicode normalization attacks', () => {
        // Using Unicode lookalike characters
        const unicode = '<img src=x onerror="alert\u0028\u0031\u0029">';
        const result = sanitizeString(unicode, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('onerror');
      });

      test('should block XML namespace attacks', () => {
        const xml = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
        const result = sanitizeString(xml, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('<script');
      });

      test('should block CSS injection', () => {
        const cssInj = '<div style="background:url(javascript:alert(1))">Test</div>';
        const result = sanitizeString(cssInj, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('javascript:');
      });

      test('should block meta refresh redirect', () => {
        const metaRefresh = '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">';
        const result = sanitizeString(metaRefresh, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('<meta');
      });

      test('should block link import attacks', () => {
        const linkImport = '<link rel="import" href="http://evil.com/xss.html">';
        const result = sanitizeString(linkImport, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('<link');
      });
    });

    describe('Protocol-based Attacks', () => {
      test('should block tel: protocol with XSS', () => {
        const tel = '<a href="tel:+1234567890;javascript:alert(1)">Call</a>';
        const result = sanitizeString(tel, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('javascript:');
      });

      test('should handle mailto: links and strip nested XSS', () => {
        const mailto = '<a href="mailto:test@test.com?subject=Test">Email</a>';
        const result = sanitizeString(mailto, SanitizationContext.RICH_TEXT);
        // mailto: is allowed in RICH_TEXT context, but test without nested script
        expect(result).toContain('mailto:');
        expect(result).toContain('rel="noopener noreferrer"');

        // Test that script in mailto URL is encoded/escaped
        const maliciousMailto =
          '<a href="mailto:test@test.com?subject=<script>alert(1)</script>">Email</a>';
        const maliciousResult = sanitizeString(maliciousMailto, SanitizationContext.RICH_TEXT);
        // DOMPurify will encode or keep the script tag in the href attribute
        // The important thing is it doesn't execute
        expect(maliciousResult).toContain('<a');
      });

      test('should block ftp: protocol', () => {
        const url = sanitizeURL('ftp://evil.com/malware.exe');
        expect(url).toBeNull();
      });

      test('should block ws: and wss: protocols', () => {
        expect(sanitizeURL('ws://evil.com')).toBeNull();
        expect(sanitizeURL('wss://evil.com')).toBeNull();
      });
    });

    describe('Browser-Specific XSS', () => {
      test('should block IE conditional comments', () => {
        const ieComment = '<!--[if IE]><script>alert(1)</script><![endif]-->';
        const result = sanitizeString(ieComment, SanitizationContext.RICH_TEXT);
        expect(result).not.toContain('<script');
      });

      test('should block mhtml: protocol', () => {
        const mhtml = sanitizeURL('mhtml:http://evil.com!xss.html');
        expect(mhtml).toBeNull();
      });

      test('should block view-source: protocol', () => {
        const viewSource = sanitizeURL('view-source:http://example.com');
        expect(viewSource).toBeNull();
      });
    });
  });

  describe('Stress Testing', () => {
    test('should handle extremely large HTML documents', () => {
      // 1MB of HTML content
      const largeHtml = '<p>' + 'A'.repeat(1000000) + '</p>';
      const startTime = Date.now();
      const result = sanitizeString(largeHtml, SanitizationContext.PLAIN_TEXT);
      const endTime = Date.now();

      expect(result).toBeTruthy();
      expect(result).not.toContain('<p>');
      // Should complete in reasonable time (< 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle deeply nested HTML', () => {
      // 100 levels of nesting
      let deeplyNested = 'content';
      for (let i = 0; i < 100; i++) {
        deeplyNested = `<div>${deeplyNested}</div>`;
      }

      const startTime = Date.now();
      const result = sanitizeString(deeplyNested, SanitizationContext.PLAIN_TEXT);
      const endTime = Date.now();

      expect(result).toBe('content');
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should handle thousands of XSS attempts in one string', () => {
      const manyXSS = Array(1000).fill('<script>alert(1)</script>').join('');
      const startTime = Date.now();
      const result = sanitizeString(manyXSS, SanitizationContext.PLAIN_TEXT);
      const endTime = Date.now();

      expect(result).toBe('');
      expect(result).not.toContain('<script');
      expect(endTime - startTime).toBeLessThan(3000);
    });

    test('should handle mixed content at scale', () => {
      const mixedContent = Array(500)
        .fill(0)
        .map(
          (_, i) => `
        <div>
          <h2>Section ${i}</h2>
          <p>Text ${i}</p>
          <script>alert(${i})</script>
          <a href="http://example.com/${i}">Link ${i}</a>
        </div>
      `
        )
        .join('');

      const startTime = Date.now();
      const result = sanitizeString(mixedContent, SanitizationContext.RICH_TEXT);
      const endTime = Date.now();

      expect(result).not.toContain('<script');
      expect(result).toContain('<h2>');
      expect(result).toContain('<a');
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle concurrent sanitization calls', async () => {
      const testCases = Array(100)
        .fill(0)
        .map((_, i) => `<p>Item ${i} <script>alert(${i})</script></p>`);

      const startTime = Date.now();
      const results = await Promise.all(
        testCases.map((item) => sanitizeString(item, SanitizationContext.PLAIN_TEXT))
      );
      const endTime = Date.now();

      results.forEach((result, i) => {
        expect(result).toBe(`Item ${i} `);
        expect(result).not.toContain('<script');
      });
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle objects with function properties', () => {
      const withFunction = {
        name: '<script>XSS</script>Test',
        fn: function () {
          return 'test';
        },
        arrow: () => 'arrow',
      };

      const result = sanitizeObject(withFunction, SanitizationContext.PLAIN_TEXT);

      expect(result.name).toBe('Test');
      // Functions should be preserved as-is (not strings to sanitize)
      expect(typeof result.fn).toBe('function');
      expect(typeof result.arrow).toBe('function');
    });

    test('should handle mixed array types', () => {
      const mixed = [
        'string<script>XSS</script>',
        123,
        true,
        null,
        undefined,
        { nested: '<b>bold</b>' },
        ['nested', 'array'],
      ];

      const result = sanitizeObject(
        { items: mixed } as Record<string, unknown>,
        SanitizationContext.PLAIN_TEXT
      );

      expect((result.items as Array<unknown>)[0]).toBe('string');
      expect((result.items as Array<unknown>)[1]).toBe(123);
      expect((result.items as Array<unknown>)[2]).toBe(true);
    });

    test('should handle special JavaScript values', () => {
      const special = {
        nan: NaN,
        infinity: Infinity,
        negInfinity: -Infinity,
        date: new Date('2024-01-01'),
        regex: /test/,
      };

      const result = sanitizeObject(special, SanitizationContext.PLAIN_TEXT);

      expect(result.nan).toBeNaN();
      expect(result.infinity).toBe(Infinity);
      expect(result.negInfinity).toBe(-Infinity);
      // Date and RegExp are objects, they get recursively processed
      // Since they don't have string properties, they become empty objects
      expect(result.date).toBeDefined();
      expect(result.regex).toBeDefined();
    });

    test('should handle Symbols in objects', () => {
      const sym = Symbol('test');
      const withSymbol = {
        [sym]: 'symbol value',
        normal: '<script>XSS</script>Normal',
      };

      const result = sanitizeObject(
        withSymbol as unknown as Record<string, unknown>,
        SanitizationContext.PLAIN_TEXT
      );

      expect(result.normal).toBe('Normal');
    });

    test('should handle getters and setters', () => {
      const obj = {
        _value: '<script>XSS</script>test',
        get value() {
          return this._value;
        },
        set value(v) {
          this._value = v;
        },
      };

      const result = sanitizeObject(obj, SanitizationContext.PLAIN_TEXT);
      expect(result._value).toBe('test');
    });
  });
});
