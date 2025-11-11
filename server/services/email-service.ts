import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { log } from '../vite';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private fromAddress: string;
  private isConfigured: boolean = false;

  constructor() {
    this.fromAddress = process.env.SMTP_FROM_ADDRESS || 'noreply@pricecompare.com';
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USERNAME;
    const smtpPass = process.env.SMTP_PASSWORD;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      log('Email service not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, and SMTP_PASSWORD environment variables.', 'info');
      this.isConfigured = false;
      return;
    }

    const config: EmailConfig = {
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: parseInt(smtpPort, 10) === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    };

    try {
      this.transporter = nodemailer.createTransport(config);
      this.isConfigured = true;
      log('Email service initialized successfully', 'info');
    } catch (error) {
      log(`Failed to initialize email service: ${error}`, 'error');
      this.isConfigured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      log('Email service is not configured. Cannot send email.', 'error');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      log(`Email sent successfully to ${options.to}: ${info.messageId}`, 'info');
      return true;
    } catch (error) {
      log(`Failed to send email to ${options.to}: ${error}`, 'error');
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string, username: string): Promise<boolean> {
    const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

    const subject = 'Password Reset Request - PriceCompare';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #3b82f6;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #3b82f6;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #2563eb;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .token-box {
            background-color: #f3f4f6;
            border: 1px solid #d1d5db;
            padding: 12px;
            border-radius: 4px;
            font-family: monospace;
            word-break: break-all;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hi ${username},</p>

          <p>We received a request to reset your password for your PriceCompare account. If you made this request, click the button below to reset your password:</p>

          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>

          <p>Or copy and paste this link into your browser:</p>
          <div class="token-box">${resetUrl}</div>

          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>This link will expire in 1 hour</li>
              <li>The link can only be used once</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Your password will remain unchanged</li>
            </ul>
          </div>

          <p>For security reasons, we can only process password reset requests from the email address associated with your account.</p>

          <p>If you have any questions or concerns, please contact our support team.</p>

          <p>Best regards,<br>
          The PriceCompare Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email, please do not reply.</p>
          <p>&copy; ${new Date().getFullYear()} PriceCompare. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
Hi ${username},

We received a request to reset your password for your PriceCompare account.

To reset your password, please visit the following link:
${resetUrl}

⚠️ SECURITY NOTICE:
- This link will expire in 1 hour
- The link can only be used once
- If you didn't request this reset, please ignore this email
- Your password will remain unchanged

For security reasons, we can only process password reset requests from the email address associated with your account.

If you have any questions or concerns, please contact our support team.

Best regards,
The PriceCompare Team

---
This is an automated email, please do not reply.
© ${new Date().getFullYear()} PriceCompare. All rights reserved.
    `.trim();

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async sendPasswordResetConfirmationEmail(email: string, username: string): Promise<boolean> {
    const subject = 'Password Successfully Reset - PriceCompare';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #10b981;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .success {
            background-color: #d1fae5;
            border-left: 4px solid #10b981;
            padding: 12px;
            margin: 20px 0;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✓ Password Reset Successful</h1>
        </div>
        <div class="content">
          <p>Hi ${username},</p>

          <div class="success">
            <strong>Your password has been successfully reset.</strong>
          </div>

          <p>Your PriceCompare account password was changed at ${new Date().toLocaleString()}.</p>

          <p>You can now log in to your account using your new password.</p>

          <div class="warning">
            <strong>⚠️ Didn't make this change?</strong>
            <p>If you didn't reset your password, please contact our support team immediately as your account may be compromised.</p>
          </div>

          <p>For your security, we recommend:</p>
          <ul>
            <li>Using a strong, unique password</li>
            <li>Never sharing your password with anyone</li>
            <li>Enabling two-factor authentication (if available)</li>
            <li>Being cautious of phishing attempts</li>
          </ul>

          <p>Best regards,<br>
          The PriceCompare Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email, please do not reply.</p>
          <p>&copy; ${new Date().getFullYear()} PriceCompare. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
Hi ${username},

✓ Your password has been successfully reset.

Your PriceCompare account password was changed at ${new Date().toLocaleString()}.

You can now log in to your account using your new password.

⚠️ DIDN'T MAKE THIS CHANGE?
If you didn't reset your password, please contact our support team immediately as your account may be compromised.

For your security, we recommend:
- Using a strong, unique password
- Never sharing your password with anyone
- Enabling two-factor authentication (if available)
- Being cautious of phishing attempts

Best regards,
The PriceCompare Team

---
This is an automated email, please do not reply.
© ${new Date().getFullYear()} PriceCompare. All rights reserved.
    `.trim();

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

// Export a singleton instance
export const emailService = new EmailService();
