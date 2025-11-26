import { Express, Request } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import * as schema from "@shared/schema";
import { passport, createUser, findUserByEmail, findUserById, hashPassword, User, SafeUser } from "../auth";
import { generateCsrfToken } from "../middleware/security";
import { logSecurityEvent, SecurityEventType } from "../utils/security-logger";
import { logger } from "../utils/logger";
import { validatePassword } from "../utils/validation-helpers";
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  getUserByResetToken,
  isRateLimitExceeded
} from "../services/password-reset-service";
import { emailService } from "../services/email-service";
import { isAuthenticated, handleRouteError } from "./helpers";

// Zod schemas for request validation
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password must be less than 100 characters"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password must be less than 100 characters"),
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
  // User registration
  app.post("/api/auth/register", async (req, res): Promise<void> => {
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
        res.status(400).json({
          error: passwordValidation.errors[0]
        });
        return;
      }

      // Check if user already exists
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ error: 'User already exists' });
        return;
      }

      // Hash password
      const passwordHash = await hashPassword(password); // SECURITY: NEVER expose passwordHash

      // SECURITY: Use storage layer which handles SERIALIZABLE transaction with retry
      // to prevent race condition on first admin check
      const { user, isFirstUser } = await storage.createUserWithTransaction(username, email, passwordHash);

      // SECURITY: Log successful registration
      logSecurityEvent(SecurityEventType.REGISTER, req, {
        userId: user!.id,
        username: user!.username,
        email: user!.email,
        success: true,
        metadata: {
          role: user!.role,
          isFirstUser,
        }
      });

      // Log the user in after registration
      req.login(user as Express.User, (err): void => {
        if (err) {
          handleRouteError(res, err, 'LoginAfterRegistration');
          return;
        }
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user'
          }
        });
      });
    } catch (error: unknown) {
      handleRouteError(res, error, 'Register');
    }
  });

  // User login
  app.post("/api/auth/login", (req, res, next) => {
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

        return res.status(401).json({
          error: info?.message || 'Authentication failed',
          locked: info?.locked,
          remainingTime: info?.remainingTime,
          remainingAttempts: info?.remainingAttempts,
        });
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

        res.json({
          success: true,
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
  app.post("/api/auth/logout", (req, res): void => {
    // Capture user before logout (may or may not be authenticated)
    const user = isAuthenticated(req) ? req.user : undefined;

    req.logout((err): void => {
      if (err) {
        handleRouteError(res, err, 'Logout');
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

      res.json({ success: true });
    });
  });

  // Password reset - Request token
  app.post("/api/auth/forgot-password", async (req, res): Promise<void> => {
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
          res.json({
            success: true,
            message: "If an account exists with this email, a password reset link has been sent.",
          });
          return;
        }

        // Check if email service is configured
        if (!emailService.isReady()) {
          logPasswordResetAttempt(req, email, user, false, "Email service not configured");

          res.status(503).json({
            error: "Password reset is temporarily unavailable. Please contact support.",
          });
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
      res.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    } catch (error: unknown) {
      logger.error("Forgot password error", { error: error instanceof Error ? error.message : String(error) });
      // SECURITY: Don't reveal internal errors
      res.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }
  });

  // Password reset - Validate token
  app.get("/api/auth/reset-password/:token", async (req, res): Promise<void> => {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({ error: "Token is required" });
        return;
      }

      const tokenRecord = await validatePasswordResetToken(token);

      if (!tokenRecord) {
        res.status(400).json({
          error: "Invalid or expired password reset token",
          expired: true,
        });
        return;
      }

      // Get user info (without sensitive data)
      const user = await getUserByResetToken(token);

      if (!user) {
        res.status(400).json({
          error: "Invalid password reset token",
        });
        return;
      }

      res.json({
        success: true,
        email: user.email,
        username: user.username,
      });
    } catch (error: unknown) {
      handleRouteError(res, error, 'ValidateResetToken');
    }
  });

  // Password reset - Complete reset
  app.post("/api/auth/reset-password", async (req, res): Promise<void> => {
    try {
      // Validate input with Zod schema
      const { token, password } = resetPasswordSchema.parse(req.body);

      // Validate password strength using shared validation
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        res.status(400).json({
          error: passwordValidation.errors[0],
        });
        return;
      }

      // Validate the token
      const user = await getUserByResetToken(token);

      if (!user) {
        logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
          success: false,
          message: "Invalid or expired token",
        });

        res.status(400).json({
          error: "Invalid or expired password reset token",
        });
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

      res.json({
        success: true,
        message: "Password has been reset successfully. You can now log in with your new password.",
      });
    } catch (error: unknown) {
      handleRouteError(res, error, 'ResetPassword');
    }
  });

  // Get current user
  app.get("/api/auth/user", async (req, res): Promise<void> => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Not authenticated' });
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

    res.json({
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
