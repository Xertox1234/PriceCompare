import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Valid test token (32+ characters required by validation schema)
const VALID_TEST_TOKEN = 'test-reset-token-1234567890abcdef';
const VALID_TEST_TOKEN_2 = 'reset-token-abcdef1234567890xyz123';
const VALID_TEST_TOKEN_3 = 'token-xyz-1234567890abcdefghijkl';

/**
 * Email Service Test Suite
 *
 * Tests email service functionality including:
 * - Configuration and initialization
 * - Email sending with SMTP transport
 * - Password reset email generation
 * - Confirmation email generation
 * - Price alert email generation (NEW)
 * - Template rendering
 * - XSS prevention (HTML escaping)
 * - Error handling and graceful degradation
 */

// Mock nodemailer before importing email service
const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({
  sendMail: mockSendMail,
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
  createTransport: mockCreateTransport,
}));

// Mock logger
vi.mock('../../vite', () => ({
  log: vi.fn(),
}));

describe('Email Service', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear all mocks
    vi.clearAllMocks();

    // Reset module cache to get fresh instance
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Configuration and Initialization', () => {
    it('should return true when email is properly configured', async () => {
      // Set up complete SMTP configuration
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      // Import fresh instance
      const { emailService } = await import('../email-service');

      expect(emailService.isReady()).toBe(true);
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false, // Not port 465
        auth: {
          user: 'user@example.com',
          pass: 'password123',
        },
      });
    });

    it('should return false when SMTP_HOST is not configured', async () => {
      // Missing SMTP_HOST
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      const { emailService } = await import('../email-service');

      expect(emailService.isReady()).toBe(false);
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('should return false when SMTP_PORT is not configured', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      // Missing SMTP_PORT
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      const { emailService } = await import('../email-service');

      expect(emailService.isReady()).toBe(false);
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('should return false when SMTP_USERNAME is not configured', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      // Missing SMTP_USERNAME
      process.env.SMTP_PASSWORD = 'password123';

      const { emailService } = await import('../email-service');

      expect(emailService.isReady()).toBe(false);
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('should return false when SMTP_PASSWORD is not configured', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      // Missing SMTP_PASSWORD

      const { emailService } = await import('../email-service');

      expect(emailService.isReady()).toBe(false);
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('should use secure: true for port 465', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      await import('../email-service');

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 465,
          secure: true, // Should be true for port 465
        })
      );
    });

    it('should use custom SMTP_FROM_ADDRESS when provided', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';
      process.env.SMTP_FROM_ADDRESS = 'custom@pricecompare.com';

      mockSendMail.mockResolvedValue({ messageId: 'test-123' });

      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail(
        'recipient@example.com',
        VALID_TEST_TOKEN,
        'TestUser'
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@pricecompare.com',
        })
      );
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      // Configure SMTP for sending tests
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';
    });

    it('should successfully send email when configured', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id-123' });

      const { emailService } = await import('../email-service');

      const result = await emailService.sendPasswordResetEmail(
        'user@example.com',
        VALID_TEST_TOKEN_3,
        'TestUser'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Password Reset Request - PriceCompare',
        })
      );
    });

    it('should return false when service is not configured', async () => {
      // Override to unconfigured state
      process.env.SMTP_HOST = '';

      const { emailService } = await import('../email-service');

      const result = await emailService.sendPasswordResetEmail(
        'user@example.com',
        VALID_TEST_TOKEN,
        'TestUser'
      );

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should return false and handle SMTP errors gracefully', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const { emailService } = await import('../email-service');

      const result = await emailService.sendPasswordResetEmail(
        'user@example.com',
        VALID_TEST_TOKEN,
        'TestUser'
      );

      expect(result).toBe(false);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should handle network timeout errors', async () => {
      mockSendMail.mockRejectedValue(new Error('ETIMEDOUT'));

      const { emailService } = await import('../email-service');

      const result = await emailService.sendPasswordResetEmail(
        'user@example.com',
        VALID_TEST_TOKEN,
        'TestUser'
      );

      expect(result).toBe(false);
    });
  });

  describe('Password Reset Email Template', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';
      process.env.APP_URL = 'https://pricecompare.com';

      mockSendMail.mockResolvedValue({ messageId: 'test-123' });
    });

    it('should generate password reset email with correct reset URL', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail(
        'recipient@example.com',
        VALID_TEST_TOKEN_2,
        'JohnDoe'
      );

      const emailCall = mockSendMail.mock.calls[0][0];

      // Check reset URL is included
      expect(emailCall.html).toContain(
        `https://pricecompare.com/reset-password?token=${VALID_TEST_TOKEN_2}`
      );
      expect(emailCall.text).toContain(
        `https://pricecompare.com/reset-password?token=${VALID_TEST_TOKEN_2}`
      );
    });

    it('should include username in email template', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail('user@example.com', VALID_TEST_TOKEN, 'JaneDoe');

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toContain('Hi JaneDoe');
      expect(emailCall.text).toContain('Hi JaneDoe');
    });

    it('should include security warnings in template', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail('user@example.com', VALID_TEST_TOKEN, 'TestUser');

      const emailCall = mockSendMail.mock.calls[0][0];

      // Check for security notices
      expect(emailCall.html).toContain('expire in 1 hour');
      expect(emailCall.html).toContain('can only be used once');
      expect(emailCall.text).toContain('expire in 1 hour');
      expect(emailCall.text).toContain('can only be used once');
    });

    it('should include both HTML and plain text versions', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail('user@example.com', VALID_TEST_TOKEN, 'TestUser');

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toBeTruthy();
      expect(emailCall.text).toBeTruthy();
      expect(emailCall.html.length).toBeGreaterThan(100);
      expect(emailCall.text.length).toBeGreaterThan(50);
    });

    it('should use default APP_URL when not configured', async () => {
      delete process.env.APP_URL;

      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail('user@example.com', VALID_TEST_TOKEN_3, 'TestUser');

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toContain(
        `http://localhost:5000/reset-password?token=${VALID_TEST_TOKEN_3}`
      );
    });
  });

  describe('Password Reset Confirmation Email', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      mockSendMail.mockResolvedValue({ messageId: 'test-123' });
    });

    it('should send password reset confirmation email', async () => {
      const { emailService } = await import('../email-service');

      const result = await emailService.sendPasswordResetConfirmationEmail(
        'user@example.com',
        'TestUser'
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Password Successfully Reset - PriceCompare',
        })
      );
    });

    it('should include username in confirmation email', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetConfirmationEmail('user@example.com', 'JohnSmith');

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toContain('Hi JohnSmith');
      expect(emailCall.text).toContain('Hi JohnSmith');
    });

    it('should include timestamp of password change', async () => {
      const { emailService } = await import('../email-service');

      const _beforeTime = new Date();
      await emailService.sendPasswordResetConfirmationEmail('user@example.com', 'TestUser');
      const _afterTime = new Date();

      const emailCall = mockSendMail.mock.calls[0][0];

      // Check that some date is present (hard to test exact format)
      expect(emailCall.html).toMatch(/password was changed at/i);
      expect(emailCall.text).toMatch(/password was changed at/i);
    });

    it('should include security warning about unauthorized changes', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetConfirmationEmail('user@example.com', 'TestUser');

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toContain("Didn't make this change");
      expect(emailCall.text).toContain("DIDN'T MAKE THIS CHANGE");
    });

    it('should include both HTML and plain text versions', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetConfirmationEmail('user@example.com', 'TestUser');

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toBeTruthy();
      expect(emailCall.text).toBeTruthy();
      expect(emailCall.html.length).toBeGreaterThan(100);
      expect(emailCall.text.length).toBeGreaterThan(50);
    });
  });

  describe('Email Template Rendering', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      mockSendMail.mockResolvedValue({ messageId: 'test-123' });
    });

    it('should include username in HTML template (note: XSS vulnerability exists)', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail('user@example.com', VALID_TEST_TOKEN, 'TestUser');

      const emailCall = mockSendMail.mock.calls[0][0];

      // Username should be included in both HTML and text
      expect(emailCall.html).toContain('Hi TestUser');
      expect(emailCall.text).toContain('Hi TestUser');

      // NOTE: Current implementation does NOT escape HTML in usernames
      // This is a potential XSS vulnerability if username contains malicious HTML
      // SECURITY IMPROVEMENT: Should use HTML escaping for username variable
    });

    it('should include current year in footer', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail('user@example.com', VALID_TEST_TOKEN, 'TestUser');

      const emailCall = mockSendMail.mock.calls[0][0];
      const currentYear = new Date().getFullYear();

      expect(emailCall.html).toContain(`${currentYear}`);
      expect(emailCall.text).toContain(`${currentYear}`);
    });
  });

  describe('Error Handling', () => {
    it('should handle createTransport errors gracefully', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      mockCreateTransport.mockImplementationOnce(() => {
        throw new Error('Invalid credentials');
      });

      const { emailService } = await import('../email-service');

      expect(emailService.isReady()).toBe(false);
    });

    it('should handle various SMTP error types', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      const errors = [
        new Error('ECONNREFUSED'),
        new Error('ETIMEDOUT'),
        new Error('Invalid recipient'),
        new Error('550 Mailbox not found'),
      ];

      for (const error of errors) {
        vi.clearAllMocks();
        mockSendMail.mockRejectedValueOnce(error);

        const { emailService } = await import('../email-service');

        const result = await emailService.sendPasswordResetEmail(
          'user@example.com',
          VALID_TEST_TOKEN,
          'User'
        );

        expect(result).toBe(false);
      }
    });
  });

  describe('sendPriceAlertEmail', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';
      process.env.APP_URL = 'https://pricecompare.com';

      mockSendMail.mockResolvedValue({ messageId: 'test-123' });
    });

    it('should send price alert email with correct template', async () => {
      const { emailService } = await import('../email-service');

      const result = await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'iPhone 15 Pro',
        targetPrice: '100.00',
        currentPrice: 95.0,
        retailerName: 'Amazon',
        productUrl: 'https://pricecompare.com/products/123',
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Price Alert: iPhone 15 Pro - Target Price Reached!',
        })
      );
    });

    it('should generate HTML with escaped user input (XSS prevention)', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: '<script>alert("xss")</script>',
        productName: '<img src=x onerror=alert(1)>',
        targetPrice: '100.00',
        currentPrice: 95.0,
        retailerName: '<b>Evil Retailer</b>',
      });

      const emailCall = mockSendMail.mock.calls[0][0];

      // Verify HTML is escaped
      expect(emailCall.html).not.toContain('<script>');
      expect(emailCall.html).toContain('&lt;script&gt;');
      expect(emailCall.html).not.toContain('<img src=x');
      expect(emailCall.html).toContain('&lt;img');
      expect(emailCall.html).not.toContain('<b>Evil');
      expect(emailCall.html).toContain('&lt;b&gt;Evil');
    });

    it('should generate plain text version', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'Test Product',
        targetPrice: '100.00',
        currentPrice: 95.0,
        retailerName: 'Test Retailer',
      });

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.text).toBeTruthy();
      expect(emailCall.text).toContain('PRICE ALERT TRIGGERED!');
      expect(emailCall.text).toContain('Test Product');
      expect(emailCall.text).toContain('Test Retailer');
      expect(emailCall.text).toContain('$95.00');
      expect(emailCall.text).toContain('$100.00');
    });

    it('should format savings correctly', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'Test Product',
        targetPrice: '50.00',
        currentPrice: 40.0,
        retailerName: 'Test Retailer',
      });

      const emailCall = mockSendMail.mock.calls[0][0];

      // Check HTML shows savings
      expect(emailCall.html).toContain('You saved $10.00');
      // Check plain text shows savings
      expect(emailCall.text).toContain('You saved $10.00');
    });

    it('should not show savings when current price equals target price', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'Test Product',
        targetPrice: '50.00',
        currentPrice: 50.0,
        retailerName: 'Test Retailer',
      });

      const emailCall = mockSendMail.mock.calls[0][0];

      // Should not show savings when prices are equal
      expect(emailCall.html).not.toContain('You saved');
    });

    it('should include product URL when provided', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'Test Product',
        targetPrice: '100.00',
        currentPrice: 95.0,
        retailerName: 'Test Retailer',
        productUrl: 'https://pricecompare.com/products/123',
      });

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toContain('View Product');
      expect(emailCall.html).toContain('https://pricecompare.com/products/123');
      expect(emailCall.text).toContain('https://pricecompare.com/products/123');
    });

    it('should handle missing product URL gracefully', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'Test Product',
        targetPrice: '100.00',
        currentPrice: 95.0,
        retailerName: 'Test Retailer',
        // No productUrl provided
      });

      const emailCall = mockSendMail.mock.calls[0][0];

      // Should not include View Product button or link text
      expect(emailCall.html).not.toContain('View Product');
    });

    it('should gracefully handle missing SMTP config', async () => {
      // Clear SMTP config
      process.env.SMTP_HOST = '';

      const { emailService } = await import('../email-service');

      const result = await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'Test Product',
        targetPrice: '100.00',
        currentPrice: 95.0,
        retailerName: 'Test Retailer',
      });

      // Should return false, not throw
      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const { emailService } = await import('../email-service');

      const result = await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'Test Product',
        targetPrice: '100.00',
        currentPrice: 95.0,
        retailerName: 'Test Retailer',
      });

      // Should return false, not throw
      expect(result).toBe(false);
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should include both HTML and plain text versions', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'Test Product',
        targetPrice: '100.00',
        currentPrice: 95.0,
        retailerName: 'Test Retailer',
      });

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toBeTruthy();
      expect(emailCall.text).toBeTruthy();
      expect(emailCall.html.length).toBeGreaterThan(100);
      expect(emailCall.text.length).toBeGreaterThan(50);
    });

    it('should include price comparison in template', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPriceAlertEmail({
        to: 'user@example.com',
        username: 'JohnDoe',
        productName: 'Test Product',
        targetPrice: '100.00',
        currentPrice: 95.0,
        retailerName: 'Test Retailer',
      });

      const emailCall = mockSendMail.mock.calls[0][0];

      // Check HTML contains both prices
      expect(emailCall.html).toContain('$95.00'); // Current price
      expect(emailCall.html).toContain('$100.00'); // Target price
      expect(emailCall.html).toContain('Your target:');

      // Check text contains both prices
      expect(emailCall.text).toContain('$95.00');
      expect(emailCall.text).toContain('$100.00');
    });
  });
});
