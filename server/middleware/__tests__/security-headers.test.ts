import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { securityHeaders } from '../security';

/**
 * Security Headers Middleware Test Suite
 *
 * Tests security headers that protect against common web vulnerabilities:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME-type sniffing
 * - Protocol downgrade attacks
 *
 * Critical security requirements:
 * - X-Frame-Options prevents clickjacking
 * - X-Content-Type-Options prevents MIME sniffing
 * - Content-Security-Policy prevents XSS
 * - Strict-Transport-Security enforces HTTPS (production only)
 */
describe('Security Headers Middleware', () => {
  let app: Express;

  beforeEach(() => {
    // Create fresh Express app for each test
    app = express();
    app.use(securityHeaders);

    // Test route
    app.get('/test', (req, res) => {
      res.json({ ok: true });
    });
  });

  describe('X-Frame-Options', () => {
    it('should set X-Frame-Options to DENY', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should prevent clickjacking by denying frame embedding', async () => {
      const response = await request(app).get('/test');

      const xFrameOptions = response.headers['x-frame-options'];
      expect(xFrameOptions).toBeDefined();
      expect(xFrameOptions).toBe('DENY');
    });
  });

  describe('X-Content-Type-Options', () => {
    it('should set X-Content-Type-Options to nosniff', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should prevent MIME-type sniffing attacks', async () => {
      const response = await request(app).get('/test');

      const contentTypeOptions = response.headers['x-content-type-options'];
      expect(contentTypeOptions).toBe('nosniff');
    });
  });

  describe('X-XSS-Protection', () => {
    it('should set X-XSS-Protection correctly', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should enable XSS filtering in legacy browsers', async () => {
      const response = await request(app).get('/test');

      const xssProtection = response.headers['x-xss-protection'];
      expect(xssProtection).toContain('1');
      expect(xssProtection).toContain('mode=block');
    });
  });

  describe('Content-Security-Policy', () => {
    it('should set Content-Security-Policy header', async () => {
      const response = await request(app).get('/test');

      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      expect(cspHeader).toBeDefined();
      expect(typeof cspHeader).toBe('string');
    });

    it('should include default-src directive', async () => {
      const response = await request(app).get('/test');

      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      expect(cspHeader).toContain("default-src 'self'");
    });

    it('should include nonce-based script-src directive', async () => {
      const response = await request(app).get('/test');

      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      expect(cspHeader).toContain("script-src 'self' 'nonce-");
    });

    it('should include nonce-based style-src directive', async () => {
      const response = await request(app).get('/test');

      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      expect(cspHeader).toContain("style-src 'self' 'nonce-");
    });

    it('should include img-src directive allowing data URIs', async () => {
      const response = await request(app).get('/test');

      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      expect(cspHeader).toContain("img-src 'self' data: https:");
    });

    it('should include connect-src directive', async () => {
      const response = await request(app).get('/test');

      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      expect(cspHeader).toContain("connect-src 'self'");
    });

    it('should include frame-ancestors directive set to none', async () => {
      const response = await request(app).get('/test');

      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      expect(cspHeader).toContain("frame-ancestors 'none'");
    });

    it('should generate unique nonce per request', async () => {
      const response1 = await request(app).get('/test');
      const response2 = await request(app).get('/test');

      const csp1 =
        response1.headers['content-security-policy'] ||
        response1.headers['content-security-policy-report-only'];
      const csp2 =
        response2.headers['content-security-policy'] ||
        response2.headers['content-security-policy-report-only'];

      // Extract nonce values
      const nonce1 = csp1?.match(/'nonce-([^']+)'/)?.[1];
      const nonce2 = csp2?.match(/'nonce-([^']+)'/)?.[1];

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
    });

    it('should allow WebSocket connections in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const response = await request(app).get('/test');

      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      expect(cspHeader).toContain('ws:');
      expect(cspHeader).toContain('wss:');
    });

    it('should not allow WebSocket connections in production mode', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app).get('/test');

      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      expect(cspHeader).not.toContain('ws:');
      expect(cspHeader).not.toContain('wss:');
    });
  });

  describe('Strict-Transport-Security (HSTS)', () => {
    it('should not set HSTS in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const response = await request(app).get('/test');

      expect(response.headers['strict-transport-security']).toBeUndefined();
    });

    it('should not set HSTS for non-HTTPS requests', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app).get('/test');

      // Supertest doesn't use HTTPS by default
      expect(response.headers['strict-transport-security']).toBeUndefined();
    });

    it('should set HSTS for HTTPS requests in production', async () => {
      process.env.NODE_ENV = 'production';

      // Create app with mocked secure request using Object.defineProperty
      const secureApp = express();
      secureApp.use((req, res, next) => {
        // Mock secure connection using Object.defineProperty to override getter
        Object.defineProperty(req, 'secure', {
          value: true,
          writable: false,
          configurable: true,
        });
        next();
      });
      secureApp.use(securityHeaders);
      secureApp.get('/test', (req, res) => res.json({ ok: true }));

      const response = await request(secureApp).get('/test');

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
      expect(response.headers['strict-transport-security']).toContain('preload');
    });
  });

  describe('Referrer-Policy', () => {
    it('should set Referrer-Policy header', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['referrer-policy']).toBeDefined();
    });

    it('should use strict-origin-when-cross-origin policy', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Permissions-Policy', () => {
    it('should set Permissions-Policy header', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['permissions-policy']).toBeDefined();
    });

    it('should disable geolocation permission', async () => {
      const response = await request(app).get('/test');

      const permissionsPolicy = response.headers['permissions-policy'];
      expect(permissionsPolicy).toContain('geolocation=()');
    });

    it('should disable microphone permission', async () => {
      const response = await request(app).get('/test');

      const permissionsPolicy = response.headers['permissions-policy'];
      expect(permissionsPolicy).toContain('microphone=()');
    });

    it('should disable camera permission', async () => {
      const response = await request(app).get('/test');

      const permissionsPolicy = response.headers['permissions-policy'];
      expect(permissionsPolicy).toContain('camera=()');
    });
  });

  describe('Headers Applied to All Responses', () => {
    it('should apply security headers to all routes', async () => {
      app.get('/route1', (req, res) => res.json({ route: 1 }));
      app.post('/route2', (req, res) => res.json({ route: 2 }));
      app.put('/route3', (req, res) => res.json({ route: 3 }));

      const response1 = await request(app).get('/route1');
      const response2 = await request(app).post('/route2');
      const response3 = await request(app).put('/route3');

      // All should have security headers
      expect(response1.headers['x-frame-options']).toBe('DENY');
      expect(response2.headers['x-frame-options']).toBe('DENY');
      expect(response3.headers['x-frame-options']).toBe('DENY');

      expect(response1.headers['x-content-type-options']).toBe('nosniff');
      expect(response2.headers['x-content-type-options']).toBe('nosniff');
      expect(response3.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should apply headers even for error responses', async () => {
      app.get('/error', (req, res) => {
        res.status(500).json({ error: 'Internal error' });
      });

      const response = await request(app).get('/error');

      expect(response.status).toBe(500);
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Security - No Information Leakage', () => {
    it('should not leak sensitive information in headers', async () => {
      // Disable x-powered-by header for this test
      app.disable('x-powered-by');

      const response = await request(app).get('/test');

      // Check that we don't leak server info
      expect(response.headers['x-powered-by']).toBeUndefined();

      // Security headers shouldn't expose internal paths or secrets
      const allHeaders = Object.keys(response.headers);
      const sensitiveHeaders = allHeaders.filter(h =>
        h.toLowerCase().includes('secret') ||
        h.toLowerCase().includes('password') ||
        h.toLowerCase().includes('key')
      );

      expect(sensitiveHeaders).toHaveLength(0);
    });

    it('should set CSP nonce in res.locals for template use', async () => {
      let capturedNonce: string | undefined;

      app.get('/capture', (req, res) => {
        capturedNonce = res.locals.cspNonce;
        res.json({ ok: true });
      });

      await request(app).get('/capture');

      expect(capturedNonce).toBeDefined();
      expect(typeof capturedNonce).toBe('string');
      expect(capturedNonce?.length).toBeGreaterThan(0);
    });
  });
});
