import { Express, Request } from "express";
import { db } from "../db";
import { passport, createUser, findUserByEmail, findUserById, hashPassword, User, SafeUser } from "../auth";
import { generateCsrfToken } from "../middleware/security";
import { logSecurityEvent, SecurityEventType } from "../utils/security-logger";
import { logger } from "../utils/logger";
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  getUserByResetToken,
  isRateLimitExceeded
} from "../services/password-reset-service";
import { emailService } from "../services/email-service";
import * as schema from "@shared/schema";
import { eq, sql } from 'drizzle-orm';

// Type for authenticated request
interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Authentication Routes
 *
 * Handles user registration, login, logout, and password reset functionality.
 */
export function registerAuthRoutes(app: Express): void {
  // User registration
  app.post("/api/auth/register", async (req, res) => {
    try {
      // SECURITY: Do not log request bodies in production (may contain sensitive data)
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Registration request', { hasEmail: !!req.body.email });
      }

      // Validate required fields manually first
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({
          error: "Missing required fields",
          details: {
            username: !username ? "Username is required" : null,
            email: !email ? "Email is required" : null,
            password: !password ? "Password is required" : null
          }
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters long"
        });
      }

      if (!/[a-z]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one lowercase letter"
        });
      }

      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one uppercase letter"
        });
      }

      if (!/[0-9]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one number"
        });
      }

      // Check if user already exists
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // SECURITY: Use SERIALIZABLE transaction to prevent race condition on first admin check
      // Without SERIALIZABLE isolation, concurrent registrations could both see count=0 and become admins
      let user: SafeUser;
      let isFirstUser: boolean;
      await db.transaction(async (tx) => {
        // Check if this is the first user (make them admin)
        const userCount = await tx.select({ count: sql`count(*)` }).from(schema.users);
        isFirstUser = parseInt(userCount[0].count as string) === 0;

        // Hash password
        const passwordHash = await hashPassword(password); // SECURITY: NEVER expose passwordHash

        // Create user - must be in same transaction as count check
        const newUserResult = await tx.insert(schema.users).values({
          username,
          email,
          passwordHash, // SECURITY: NEVER expose - only used internally
          role: isFirstUser ? 'admin' : 'user',
        }).returning();

        // SECURITY: Explicitly extract safe fields, never expose passwordHash
        user = {
          id: newUserResult[0].id,
          username: newUserResult[0].username,
          email: newUserResult[0].email,
          role: newUserResult[0].role,
          trustLevel: newUserResult[0].trustLevel,
          isActive: newUserResult[0].isActive,
          isSuspended: newUserResult[0].isSuspended,
          createdAt: newUserResult[0].createdAt,
          updatedAt: newUserResult[0].updatedAt,
        };
      }, {
        isolationLevel: 'serializable', // Prevent concurrent first-user race condition
      });

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
      req.login(user, (err) => {
        if (err) {
          logger.error('Login after registration failed', { error: err.message, userId: user.id });
          return res.status(500).json({ error: 'Registration successful but login failed' });
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
    } catch (error) {
      logger.error('Registration error', { error: error instanceof Error ? error.message : String(error) });
      res.status(400).json({ error: 'Registration failed' });
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
      req.login(user, (err) => {
        if (err) {
          logger.error('Session creation error', { error: err.message, userId: user.id });
          return next(err);
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
  app.post("/api/auth/logout", (req, res) => {
    const authenticatedReq = req as AuthenticatedRequest;
    const user = authenticatedReq.user;

    req.logout((err) => {
      if (err) {
        logger.error('Logout error', { error: err.message, userId: user?.id });
        return res.status(500).json({ error: 'Logout failed' });
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
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // SECURITY: Always return success to prevent email enumeration
      // Even if the user doesn't exist, we return a success message
      const user = await findUserByEmail(email);

      if (user) {
        // Check rate limiting to prevent abuse
        const rateLimitExceeded = await isRateLimitExceeded(user.id);
        if (rateLimitExceeded) {
          // Log the rate limit event
          logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
            email,
            success: false,
            message: "Rate limit exceeded",
            metadata: {
              rateLimitExceeded: true,
            },
          });

          // SECURITY: Still return success to prevent email enumeration
          return res.json({
            success: true,
            message: "If an account exists with this email, a password reset link has been sent.",
          });
        }

        // Check if email service is configured
        if (!emailService.isReady()) {
          logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
            email,
            success: false,
            message: "Email service not configured",
          });

          return res.status(503).json({
            error: "Password reset is temporarily unavailable. Please contact support.",
          });
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

        if (emailSent) {
          logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
            userId: user.id,
            email: user.email,
            username: user.username,
            success: true,
          });
        } else {
          logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
            userId: user.id,
            email: user.email,
            username: user.username,
            success: false,
            message: "Failed to send email",
          });
        }
      } else {
        // User doesn't exist, but log this attempt
        logSecurityEvent(SecurityEventType.PASSWORD_RESET_REQUESTED, req, {
          email,
          success: false,
          message: "User not found",
        });
      }

      // SECURITY: Always return the same response regardless of whether user exists
      res.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    } catch (error) {
      logger.error("Forgot password error", { error: error instanceof Error ? error.message : String(error) });
      // SECURITY: Don't reveal internal errors
      res.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }
  });

  // Password reset - Validate token
  app.get("/api/auth/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      const tokenRecord = await validatePasswordResetToken(token);

      if (!tokenRecord) {
        return res.status(400).json({
          error: "Invalid or expired password reset token",
          expired: true,
        });
      }

      // Get user info (without sensitive data)
      const user = await getUserByResetToken(token);

      if (!user) {
        return res.status(400).json({
          error: "Invalid password reset token",
        });
      }

      res.json({
        success: true,
        email: user.email,
        username: user.username,
      });
    } catch (error) {
      logger.error("Validate reset token error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "An error occurred" });
    }
  });

  // Password reset - Complete reset
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          error: "Token and password are required",
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters long",
        });
      }

      if (!/[a-z]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one lowercase letter",
        });
      }

      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one uppercase letter",
        });
      }

      if (!/[0-9]/.test(password)) {
        return res.status(400).json({
          error: "Password must contain at least one number",
        });
      }

      // Validate the token
      const user = await getUserByResetToken(token);

      if (!user) {
        logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
          success: false,
          message: "Invalid or expired token",
        });

        return res.status(400).json({
          error: "Invalid or expired password reset token",
        });
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
    } catch (error) {
      logger.error("Reset password error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "An error occurred while resetting password" });
    }
  });

  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    const authenticatedReq = req as AuthenticatedRequest;
    if (authenticatedReq.user) {
      // Refresh session with latest user data from database
      const userId = authenticatedReq.user.id;
      const updatedUser = await findUserById(userId);
      if (updatedUser) {
        authenticatedReq.user = updatedUser;
      }

      const user = authenticatedReq.user;
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
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });
}
