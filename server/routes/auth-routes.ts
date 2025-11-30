/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Express, Request } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import * as schema from "@shared/schema";
import { passport, findUserByEmail, findUserById, hashPassword, User, SafeUser } from "../auth";
import { generateCsrfToken, csrfProtection } from "../middleware/security";
import { logSecurityEvent, SecurityEventType } from "../utils/security-logger";
import { logger } from "../utils/logger";
import { validatePassword } from "../utils/validation-helpers";
import { sendSuccess, sendError, sendErrorFromException } from "../utils/api-response";
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  getUserByResetToken,
  isRateLimitExceeded
} from "../services/password-reset-service";
import { emailService } from "../services/email-service";
import { isAuthenticated } from "./helpers";

// Import PASSWORD constants for consistency
import { PASSWORD } from "../utils/constants";

// Zod schemas for request validation
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`).max(PASSWORD.MAX_LENGTH, `Password must be less than ${PASSWORD.MAX_LENGTH} characters`),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`).max(PASSWORD.MAX_LENGTH, `Password must be less than ${PASSWORD.MAX_LENGTH} characters`),
});

/**
 * Helper function to log password reset attempts with consistent structure
 */
function logPasswordResetAttempt(
  req: Request,
  email: string,
  user: SafeUser | null,
  success: boolean,
  message?: string
): void {
  logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
    email: user?.email || email,
    username: user?.username,
    userId: user?.id,
    success,
    message,
  });
}

/**
 * Authentication Routes
 *
 * Handles user registration, login, logout, and password reset functionality.
 */
export function registerAuthRoutes(app: Express): void {
  /**
   * GET /api/csrf-token
   * Get CSRF token for unauthenticated clients
   * Required before calling register, login, forgot-password, or reset-password endpoints
   */
  app.get("/api/csrf-token", (req, res) => {
    try {
      const token = generateCsrfToken(req);
      sendSuccess(res, { csrfToken: token });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetCsrfToken');
    }
  });

  // User registration
  app.post("/api/auth/register", csrfProtection, async (req, res): Promise<void> => {
    try {
      // SECURITY: Do not log request bodies in production (may contain sensitive data)
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Registration request', { hasEmail: !!req.body.email });
      }

      // Validate input with Zod schema
      const { username, email, password } = registerSchema.parse(req.body);

      // Validate password strength using shared validation
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        sendError(res, passwordValidation.errors[0], 400);
        return;
      }

      // Check if user already exists
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        sendError(res, 'User already exists', 400);
        return;
      }

      // Hash password
      const passwordHash = await hashPassword(password); // SECURITY: NEVER expose passwordHash

      // SECURITY: Use storage layer which handles SERIALIZABLE transaction with retry
      // to prevent race condition on first admin check
      const { user, isFirstUser } = await storage.createUserWithTransaction(username, email, passwordHash);

      // SECURITY: Log successful registration
      logSecurityEvent(SecurityEventType.REGISTER, req, {
        userId: user.id,
        username: user.username,
        email: user.email,
        success: true,
        metadata: {
          role: user.role,
          isFirstUser,
        }
      });

      // Log the user in after registration
      req.login(user as Express.User, (err): void => {
        if (err) {
          logger.error('Login after registration failed', { error: err instanceof Error ? err.message : String(err), userId: user.id });
          sendErrorFromException(res, err, 'LoginAfterRegistration');
          return;
        }
        sendSuccess(res, {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user'
          }
        }, 201);
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'Register');
    }
  });

  // User login
  app.post("/api/auth/login", csrfProtection, (req, res, next) => {
    // Use custom callback to capture authentication result for logging
    passport.authenticate('local', (err: Error | null, user: User | false, info?: { message?: string; locked?: boolean; remainingTime?: number; remainingAttempts?: number }) => {
      if (err) {
        logger.error('Login error', { error: err.message || String(err) });
        return next(err);
      }

      if (!user) {
        // SECURITY: Log failed login attempt
        logSecurityEvent(SecurityEventType.LOGIN_FAILED, req, {
          email: req.body.email,
          success: false,
          message: info?.message || 'Authentication failed',
          metadata: {
            reason: info?.message,
            locked: info?.locked,
            remainingAttempts: info?.remainingAttempts,
          }
        });

        sendError(res, info?.message || 'Authentication failed', 401);
        return;
      }

      // Log in the user
      req.login(user, (err): void => {
        if (err) {
          logger.error('Session creation error', { error: err.message, userId: user.id });
          next(err);
          return;
        }

        // SECURITY: Log successful login
        logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, req, {
          userId: user.id,
          username: user.username,
          email: user.email,
          success: true,
        });

        sendSuccess(res, {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user'
          }
        });
      });
    })(req, res, next);
  });

  // User logout
  app.post("/api/auth/logout", csrfProtection, (req, res): void => {
    // Capture user before logout (may or may not be authenticated)
    const user = isAuthenticated(req) ? req.user : undefined;

    req.logout((err): void => {
      if (err) {
        logger.error('Logout error', { error: err instanceof Error ? err.message : String(err), userId: user?.id });
        sendErrorFromException(res, err, 'Logout');
        return;
      }

      // SECURITY: Log successful logout
      if (user) {
        logSecurityEvent(SecurityEventType.LOGOUT, req, {
          userId: user.id,
          username: user.username,
          email: user.email,
          success: true,
        });
      }

      sendSuccess(res, {});
    });
  });

  // Password reset - Request token
  app.post("/api/auth/forgot-password", csrfProtection, async (req, res): Promise<void> => {
    try {
      // Validate input with Zod schema
      const { email } = forgotPasswordSchema.parse(req.body);

      // SECURITY: Always return success to prevent email enumeration
      // Even if the user doesn't exist, we return a success message
      const user = await findUserByEmail(email);

      if (user) {
        // Check rate limiting to prevent abuse
        const rateLimitExceeded = await isRateLimitExceeded(user.id);
        if (rateLimitExceeded) {
          // Log the rate limit event using helper
          logPasswordResetAttempt(req, email, user, false, "Rate limit exceeded");

          // SECURITY: Still return success to prevent email enumeration
          sendSuccess(res, {
            message: "If an account exists with this email, a password reset link has been sent.",
          });
          return;
        }

        // Check if email service is configured
        if (!emailService.isReady()) {
          logPasswordResetAttempt(req, email, user, false, "Email service not configured");

          sendError(res, "Password reset is temporarily unavailable. Please contact support.", 503);
          return;
        }

        // Create a password reset token
        const token = await createPasswordResetToken(
          user.id,
          req.ip,
          req.get("user-agent")
        );

        // Send the password reset email
        const emailSent = await emailService.sendPasswordResetEmail(
          user.email,
          token,
          user.username
        );

        // Log the attempt with appropriate success status
        logPasswordResetAttempt(
          req,
          email,
          user,
          emailSent,
          emailSent ? undefined : "Failed to send email"
        );
      } else {
        // User doesn't exist, but log this attempt
        logPasswordResetAttempt(req, email, null, false, "User not found");
      }

      // SECURITY: Always return the same response regardless of whether user exists
      sendSuccess(res, {
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    } catch (error: unknown) {
      logger.error("Forgot password error", { error: error instanceof Error ? error.message : String(error) });
      // SECURITY: Don't reveal internal errors
      sendSuccess(res, {
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }
  });

  // Password reset - Validate token
  app.get("/api/auth/reset-password/:token", async (req, res): Promise<void> => {
    try {
      const { token } = req.params;

      if (!token) {
        sendError(res, "Token is required", 400);
        return;
      }

      const tokenRecord = await validatePasswordResetToken(token);

      if (!tokenRecord) {
        sendError(res, "Invalid or expired password reset token", 400);
        return;
      }

      // Get user info (without sensitive data)
      const user = await getUserByResetToken(token);

      if (!user) {
        sendError(res, "Invalid password reset token", 400);
        return;
      }

      sendSuccess(res, {
        email: user.email,
        username: user.username,
      });
    } catch (error: unknown) {
      logger.error("Validate reset token error", { error: error instanceof Error ? error.message : String(error) });
      sendErrorFromException(res, error, 'ValidateResetToken');
    }
  });

  // Password reset - Complete reset
  app.post("/api/auth/reset-password", csrfProtection, async (req, res): Promise<void> => {
    try {
      // Validate input with Zod schema
      const { token, password } = resetPasswordSchema.parse(req.body);

      // Validate password strength using shared validation
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        sendError(res, passwordValidation.errors[0], 400);
        return;
      }

      // Validate the token
      const user = await getUserByResetToken(token);

      if (!user) {
        logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
          success: false,
          message: "Invalid or expired token",
        });

        sendError(res, "Invalid or expired password reset token", 400);
        return;
      }

      // Hash the new password
      const newPasswordHash = await hashPassword(password);

      // SECURITY: Use transaction to ensure password update and token marking are atomic
      // If markTokenAsUsed fails after password update, token remains valid (security vulnerability)
      await db.transaction(async (tx) => {
        // Update the user's password
        await tx
          .update(schema.users)
          .set({
            passwordHash: newPasswordHash, // SECURITY: NEVER expose - used internally for auth
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, user.id));

        // Mark the token as used - must succeed or rollback password change
        await tx
          .update(schema.passwordResetTokens)
          .set({
            isUsed: true,
            usedAt: new Date(),
          })
          .where(eq(schema.passwordResetTokens.token, token));
      });

      // Log the successful password reset
      logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
        userId: user.id,
        email: user.email,
        username: user.username,
        success: true,
      });

      // Send confirmation email
      if (emailService.isReady()) {
        await emailService.sendPasswordResetConfirmationEmail(
          user.email,
          user.username
        );
      }

      sendSuccess(res, {
        message: "Password has been reset successfully. You can now log in with your new password.",
      });
    } catch (error: unknown) {
      logger.error("Reset password error", { error: error instanceof Error ? error.message : String(error) });
      sendErrorFromException(res, error, 'ResetPassword');
    }
  });

  // Get current user
  app.get("/api/auth/user", async (req, res): Promise<void> => {
    if (!isAuthenticated(req)) {
      sendError(res, 'Not authenticated', 401);
      return;
    }

    // req.user is now guaranteed to exist via type guard
    // Refresh session with latest user data from database
    const userId = req.user.id;
    const updatedUser = await findUserById(userId);
    if (updatedUser) {
      req.user = updatedUser;
    }

    const user = req.user;
    // SECURITY: Include CSRF token in response for client convenience
    const csrfToken = generateCsrfToken(req);

    sendSuccess(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      reputation: user.reputation || 0,
      isActive: user.isActive !== false,
      csrfToken, // Provide token for use in subsequent requests
    });
  });
}
