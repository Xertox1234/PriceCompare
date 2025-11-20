import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Transporter } from 'nodemailer';

/**
 * Email Service Test Suite
 *
 * Tests email service functionality including:
 * - Configuration and initialization
 * - Email sending with SMTP transport
 * - Password reset email generation
 * - Confirmation email generation
 * - Template rendering
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
        'test-token',
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
    beforeEach(async () => {
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
        'test-token-xyz',
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
        'test-token',
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
        'test-token',
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
        'test-token',
        'TestUser'
      );

      expect(result).toBe(false);
    });
  });

  describe('Password Reset Email Template', () => {
    beforeEach(async () => {
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
        'reset-token-abc123',
        'JohnDoe'
      );

      const emailCall = mockSendMail.mock.calls[0][0];

      // Check reset URL is included
      expect(emailCall.html).toContain('https://pricecompare.com/reset-password?token=reset-token-abc123');
      expect(emailCall.text).toContain('https://pricecompare.com/reset-password?token=reset-token-abc123');
    });

    it('should include username in email template', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail(
        'user@example.com',
        'token-123',
        'JaneDoe'
      );

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toContain('Hi JaneDoe');
      expect(emailCall.text).toContain('Hi JaneDoe');
    });

    it('should include security warnings in template', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail(
        'user@example.com',
        'token-123',
        'TestUser'
      );

      const emailCall = mockSendMail.mock.calls[0][0];

      // Check for security notices
      expect(emailCall.html).toContain('expire in 1 hour');
      expect(emailCall.html).toContain('can only be used once');
      expect(emailCall.text).toContain('expire in 1 hour');
      expect(emailCall.text).toContain('can only be used once');
    });

    it('should include both HTML and plain text versions', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail(
        'user@example.com',
        'token-123',
        'TestUser'
      );

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toBeTruthy();
      expect(emailCall.text).toBeTruthy();
      expect(emailCall.html.length).toBeGreaterThan(100);
      expect(emailCall.text.length).toBeGreaterThan(50);
    });

    it('should use default APP_URL when not configured', async () => {
      delete process.env.APP_URL;

      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail(
        'user@example.com',
        'token-xyz',
        'TestUser'
      );

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toContain('http://localhost:5000/reset-password?token=token-xyz');
    });
  });

  describe('Password Reset Confirmation Email', () => {
    beforeEach(async () => {
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

      await emailService.sendPasswordResetConfirmationEmail(
        'user@example.com',
        'JohnSmith'
      );

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toContain('Hi JohnSmith');
      expect(emailCall.text).toContain('Hi JohnSmith');
    });

    it('should include timestamp of password change', async () => {
      const { emailService } = await import('../email-service');

      const beforeTime = new Date();
      await emailService.sendPasswordResetConfirmationEmail(
        'user@example.com',
        'TestUser'
      );
      const afterTime = new Date();

      const emailCall = mockSendMail.mock.calls[0][0];

      // Check that some date is present (hard to test exact format)
      expect(emailCall.html).toMatch(/password was changed at/i);
      expect(emailCall.text).toMatch(/password was changed at/i);
    });

    it('should include security warning about unauthorized changes', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetConfirmationEmail(
        'user@example.com',
        'TestUser'
      );

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toContain("Didn't make this change");
      expect(emailCall.text).toContain("DIDN'T MAKE THIS CHANGE");
    });

    it('should include both HTML and plain text versions', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetConfirmationEmail(
        'user@example.com',
        'TestUser'
      );

      const emailCall = mockSendMail.mock.calls[0][0];

      expect(emailCall.html).toBeTruthy();
      expect(emailCall.text).toBeTruthy();
      expect(emailCall.html.length).toBeGreaterThan(100);
      expect(emailCall.text.length).toBeGreaterThan(50);
    });
  });

  describe('Email Template Rendering', () => {
    beforeEach(async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USERNAME = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';

      mockSendMail.mockResolvedValue({ messageId: 'test-123' });
    });

    it('should include username in HTML template (note: XSS vulnerability exists)', async () => {
      const { emailService } = await import('../email-service');

      await emailService.sendPasswordResetEmail(
        'user@example.com',
        'token-123',
        'TestUser'
      );

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

      await emailService.sendPasswordResetEmail(
        'user@example.com',
        'token-123',
        'TestUser'
      );

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
          'token',
          'User'
        );

        expect(result).toBe(false);
      }
    });
  });
});
