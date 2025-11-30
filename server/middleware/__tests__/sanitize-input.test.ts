import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { sanitizeInput } from '../security';
import { XSS_TEST_CASES } from '../../utils/sanitization';

/**
 * Input Sanitization Middleware Test Suite
 *
 * Tests input sanitization to prevent XSS and injection attacks.
 * Uses DOMPurify for comprehensive HTML sanitization.
 *
 * Critical security requirements:
 * - XSS attack vectors removed
 * - Script tags stripped
 * - Event handlers removed
 * - Dangerous URL schemes blocked
 * - Nested objects sanitized recursively
 * - Arrays sanitized correctly
 */
describe('Input Sanitization Middleware', () => {
  let app: Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Captured body from Express request, shape varies by test
  let capturedBody: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Captured query from Express request, shape varies by test
  let capturedQuery: any;

  beforeEach(() => {
    capturedBody = undefined;
    capturedQuery = undefined;

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Apply sanitization middleware
    app.use(sanitizeInput);

    // Test routes that capture sanitized input
    app.post('/test', (req, res) => {
      capturedBody = req.body;
      res.json({ ok: true, body: req.body });
    });

    app.get('/test', (req, res) => {
      capturedQuery = req.query;
      res.json({ ok: true, query: req.query });
    });
  });

  describe('XSS Attack Prevention', () => {
    it('should remove script tags from input', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<script>alert("XSS")</script>Hello',
        });

      expect(capturedBody.content).not.toContain('<script>');
      expect(capturedBody.content).not.toContain('alert');
      expect(capturedBody.content).toContain('Hello');
    });

    it('should remove script tags with src attribute', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<script src="evil.js"></script>',
        });

      expect(capturedBody.content).not.toContain('<script>');
      expect(capturedBody.content).not.toContain('evil.js');
    });

    it('should remove case-variant script tags', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<SCRIPT>alert("XSS")</SCRIPT>',
        });

      expect(capturedBody.content).not.toContain('<SCRIPT>');
      expect(capturedBody.content).not.toContain('alert');
    });

    it('should remove event handlers from HTML elements', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<img src=x onerror="alert(1)">',
        });

      expect(capturedBody.content).not.toContain('onerror');
      expect(capturedBody.content).not.toContain('alert');
    });

    it('should remove onclick handlers', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<div onclick="alert(1)">Click me</div>',
        });

      expect(capturedBody.content).not.toContain('onclick');
      expect(capturedBody.content).not.toContain('alert');
    });

    it('should remove onload handlers', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<body onload="alert(1)">',
        });

      expect(capturedBody.content).not.toContain('onload');
      expect(capturedBody.content).not.toContain('alert');
    });

    it('should block javascript: protocol in links', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<a href="javascript:alert(1)">Click</a>',
        });

      expect(capturedBody.content).not.toContain('javascript:');
      expect(capturedBody.content).not.toContain('alert');
    });

    it('should block data: URIs', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<a href="data:text/html,<script>alert(1)</script>">Click</a>',
        });

      expect(capturedBody.content).not.toContain('data:');
      expect(capturedBody.content).not.toContain('<script>');
    });

    it('should sanitize SVG-based XSS', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<svg onload="alert(1)">',
        });

      expect(capturedBody.content).not.toContain('onload');
      expect(capturedBody.content).not.toContain('alert');
    });

    it('should handle all XSS test cases from sanitization utility', async () => {
      for (const xssVector of XSS_TEST_CASES) {
        await request(app)
          .post('/test')
          .send({ content: xssVector });

        // Check for dangerous patterns
        expect(capturedBody.content).not.toMatch(/<script/i);
        expect(capturedBody.content).not.toMatch(/javascript:/i);
        expect(capturedBody.content).not.toMatch(/on\w+\s*=/i);
      }
    });
  });

  describe('SQL Injection Pattern Sanitization', () => {
    it('should preserve SQL-like strings but strip HTML', async () => {
      await request(app)
        .post('/test')
        .send({
          search: "'; DROP TABLE users; --",
        });

      // Sanitization removes HTML, but SQL strings are harmless if parameterized queries used
      expect(capturedBody.search).toBeDefined();
      // Should not contain HTML tags
      expect(capturedBody.search).not.toContain('<');
      expect(capturedBody.search).not.toContain('>');
    });

    it('should handle OR 1=1 pattern', async () => {
      await request(app)
        .post('/test')
        .send({
          search: "admin' OR '1'='1",
        });

      expect(capturedBody.search).toBeDefined();
      // Should not contain HTML
      expect(capturedBody.search).not.toContain('<script>');
    });
  });

  describe('HTML Entity Encoding', () => {
    it('should handle HTML entities', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '&lt;script&gt;alert(1)&lt;/script&gt;',
        });

      // DOMPurify preserves HTML entities when sanitizing as PLAIN_TEXT
      // The entities themselves are safe and won't execute
      expect(capturedBody.content).toBeDefined();
      // Should not contain actual script tags
      expect(capturedBody.content).not.toContain('<script>');
      expect(capturedBody.content).not.toContain('</script>');
    });

    it('should handle mixed encoding', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;>',
        });

      expect(capturedBody.content).not.toContain('onerror');
      expect(capturedBody.content).not.toContain('alert');
    });
  });

  describe('Nested Object Sanitization', () => {
    it('should sanitize nested objects recursively', async () => {
      await request(app)
        .post('/test')
        .send({
          user: {
            name: '<script>alert("XSS")</script>John',
            profile: {
              bio: '<img src=x onerror="alert(1)">',
            },
          },
        });

      expect(capturedBody.user.name).not.toContain('<script>');
      expect(capturedBody.user.profile.bio).not.toContain('onerror');
    });

    it('should sanitize deeply nested objects', async () => {
      await request(app)
        .post('/test')
        .send({
          level1: {
            level2: {
              level3: {
                xss: '<script>alert(1)</script>',
              },
            },
          },
        });

      expect(capturedBody.level1.level2.level3.xss).not.toContain('<script>');
    });

    it('should preserve non-string values in objects', async () => {
      await request(app)
        .post('/test')
        .send({
          data: {
            text: '<script>XSS</script>',
            number: 42,
            boolean: true,
            nullValue: null,
          },
        });

      expect(capturedBody.data.number).toBe(42);
      expect(capturedBody.data.boolean).toBe(true);
      expect(capturedBody.data.nullValue).toBe(null);
      expect(capturedBody.data.text).not.toContain('<script>');
    });
  });

  describe('Array Sanitization', () => {
    it('should sanitize arrays of strings', async () => {
      await request(app)
        .post('/test')
        .send({
          tags: [
            'safe tag',
            '<script>alert(1)</script>',
            '<img src=x onerror="alert(1)">',
          ],
        });

      expect(Array.isArray(capturedBody.tags)).toBe(true);
      expect(capturedBody.tags[0]).toBe('safe tag');
      expect(capturedBody.tags[1]).not.toContain('<script>');
      expect(capturedBody.tags[2]).not.toContain('onerror');
    });

    it('should sanitize arrays of objects', async () => {
      await request(app)
        .post('/test')
        .send({
          items: [
            { name: '<script>XSS</script>Item 1' },
            { name: '<img src=x onerror="alert(1)">Item 2' },
          ],
        });

      expect(Array.isArray(capturedBody.items)).toBe(true);
      expect(capturedBody.items[0].name).not.toContain('<script>');
      expect(capturedBody.items[1].name).not.toContain('onerror');
    });

    it('should preserve mixed-type arrays', async () => {
      await request(app)
        .post('/test')
        .send({
          mixed: [
            'text',
            42,
            true,
            { key: '<script>XSS</script>' },
            null,
          ],
        });

      expect(capturedBody.mixed[0]).toBe('text');
      expect(capturedBody.mixed[1]).toBe(42);
      expect(capturedBody.mixed[2]).toBe(true);
      expect(capturedBody.mixed[3].key).not.toContain('<script>');
      expect(capturedBody.mixed[4]).toBe(null);
    });
  });

  describe('Query Parameter Sanitization', () => {
    it('should sanitize query parameters', async () => {
      await request(app).get('/test?search=<script>alert(1)</script>');

      expect(capturedQuery.search).not.toContain('<script>');
      expect(capturedQuery.search).not.toContain('alert');
    });

    it('should sanitize multiple query parameters', async () => {
      await request(app).get('/test?q=<script>XSS</script>&filter=<img src=x onerror="alert(1)">');

      expect(capturedQuery.q).not.toContain('<script>');
      expect(capturedQuery.filter).not.toContain('onerror');
    });

    it('should handle URL-encoded XSS in query params', async () => {
      await request(app).get('/test?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E');

      expect(capturedQuery.q).not.toContain('<script>');
      expect(capturedQuery.q).not.toContain('alert');
    });
  });

  describe('Request Body Sanitization', () => {
    it('should sanitize request body', async () => {
      await request(app)
        .post('/test')
        .send({
          title: '<script>XSS</script>Product',
          description: '<img src=x onerror="alert(1)">',
        });

      expect(capturedBody.title).not.toContain('<script>');
      expect(capturedBody.description).not.toContain('onerror');
    });

    it('should sanitize form-encoded data', async () => {
      await request(app)
        .post('/test')
        .type('form')
        .send({
          name: '<script>alert(1)</script>',
        });

      expect(capturedBody.name).not.toContain('<script>');
    });
  });

  describe('Allowed HTML Tags (if applicable)', () => {
    it('should preserve safe text content', async () => {
      await request(app)
        .post('/test')
        .send({
          content: 'This is safe text without HTML',
        });

      expect(capturedBody.content).toBe('This is safe text without HTML');
    });

    it('should preserve text with special characters', async () => {
      await request(app)
        .post('/test')
        .send({
          content: 'Price: $99.99 & free shipping!',
        });

      expect(capturedBody.content).toContain('$99.99');
      expect(capturedBody.content).toContain('&');
      expect(capturedBody.content).toContain('shipping');
    });

    it('should handle emojis and unicode', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '😀 Hello 世界',
        });

      expect(capturedBody.content).toContain('😀');
      expect(capturedBody.content).toContain('世界');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '',
        });

      expect(capturedBody.content).toBe('');
    });

    it('should handle undefined values', async () => {
      await request(app)
        .post('/test')
        .send({
          defined: 'value',
        });

      expect(capturedBody.undefined).toBeUndefined();
    });

    it('should handle null values', async () => {
      await request(app)
        .post('/test')
        .send({
          nullValue: null,
        });

      expect(capturedBody.nullValue).toBe(null);
    });

    it('should handle numbers', async () => {
      await request(app)
        .post('/test')
        .send({
          count: 42,
          price: 99.99,
        });

      expect(capturedBody.count).toBe(42);
      expect(capturedBody.price).toBe(99.99);
    });

    it('should handle booleans', async () => {
      await request(app)
        .post('/test')
        .send({
          active: true,
          deleted: false,
        });

      expect(capturedBody.active).toBe(true);
      expect(capturedBody.deleted).toBe(false);
    });

    it('should handle very long strings', async () => {
      const longString = '<script>alert(1)</script>'.repeat(100);

      await request(app)
        .post('/test')
        .send({
          content: longString,
        });

      expect(capturedBody.content).not.toContain('<script>');
    });

    it('should handle empty objects', async () => {
      await request(app)
        .post('/test')
        .send({});

      expect(capturedBody).toEqual({});
    });

    it('should handle empty arrays', async () => {
      await request(app)
        .post('/test')
        .send({
          items: [],
        });

      expect(capturedBody.items).toEqual([]);
    });
  });

  describe('Security - No Bypass', () => {
    it('should not allow XSS through double encoding', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '&lt;script&gt;alert(1)&lt;/script&gt;',
        });

      // HTML entities are preserved but won't execute as script
      // The important thing is no actual <script> tags exist
      expect(capturedBody.content).not.toContain('<script>');
      expect(capturedBody.content).not.toContain('</script>');
    });

    it('should not allow XSS through nested encoding', async () => {
      await request(app)
        .post('/test')
        .send({
          content: '<img src="x" onerror="&#97;&#108;&#101;&#114;&#116;(1)">',
        });

      expect(capturedBody.content).not.toContain('onerror');
    });

    it('should sanitize all dangerous patterns', async () => {
      const dangerousInputs = [
        { input: '<script>alert(1)</script>', checks: ['<script'] },
        { input: '<img src=x onerror=alert(1)>', checks: ['onerror'] },
        { input: '<svg onload=alert(1)>', checks: ['onload'] },
        { input: '<iframe src="javascript:alert(1)">', checks: ['<iframe'] },
        { input: '<object data="javascript:alert(1)">', checks: ['<object'] },
        { input: '<embed src="javascript:alert(1)">', checks: ['<embed'] },
      ];

      for (const { input, checks } of dangerousInputs) {
        await request(app)
          .post('/test')
          .send({ content: input });

        // Verify dangerous patterns are removed
        for (const check of checks) {
          expect(capturedBody.content.toLowerCase()).not.toContain(check.toLowerCase());
        }
      }
    });
  });
});
