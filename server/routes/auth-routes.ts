import { Express, Request } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { storage } from '../storage';
import { passport, findUserByEmail, findUserById, hashPassword, User, SafeUser } from '../auth';
import { generateCsrfToken, csrfProtection } from '../middleware/security';
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';
import { logger } from '../utils/logger';
import { validatePassword } from '../utils/validation-helpers';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  getUserByResetToken,
  isRateLimitExceeded,
  resetPasswordAtomic,
} from '../services/password-reset-service';
import { emailService } from '../services/email-service';
import { isAuthenticated } from './helpers';
import {
  passwordResetLimiter,
  loginLimiter,
  registrationLimiter,
} from '../middleware/auth-rate-limiter';

// Import PASSWORD constants for consistency
import { PASSWORD } from '../utils/constants';

// Zod schemas for request validation
const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH, `Password must be less than ${PASSWORD.MAX_LENGTH} characters`),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH, `Password must be less than ${PASSWORD.MAX_LENGTH} characters`),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH, `Password must be less than ${PASSWORD.MAX_LENGTH} characters`),
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
 * SECURITY: Normalize response time to prevent timing-based email enumeration
 *
 * Typical password reset flow (when user exists) takes 200-600ms due to:
 * - Database lookup (~50ms)
 * - Token generation (~10ms)
 * - Email sending (~150-500ms)
 *
 * When user doesn't exist, the operation would take ~10ms (immediate return).
 * This timing difference allows attackers to enumerate valid emails.
 *
 * This function ensures non-existent email requests take similar time by:
 * 1. Measuring elapsed time since request start
 * 2. Adding random delay to match typical user-exists response time
 * 3. Using randomization to prevent statistical analysis
 *
 * @param startTime - Request start timestamp from Date.now()
 */
async function normalizeResponseTime(startTime: number): Promise<void> {
  const crypto = await import('crypto');

  // Typical time for full password reset flow (ms)
  const TYPICAL_RESET_TIME_MIN = 200;
  const TYPICAL_RESET_TIME_MAX = 600;

  const elapsedTime = Date.now() - startTime;
  const targetTime = crypto.randomInt(TYPICAL_RESET_TIME_MIN, TYPICAL_RESET_TIME_MAX);
  const remainingDelay = Math.max(0, targetTime - elapsedTime);

  if (remainingDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingDelay));
  }
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
  app.get('/api/csrf-token', (req, res) => {
    try {
      const token = generateCsrfToken(req);
      sendSuccess(res, { csrfToken: token });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'GetCsrfToken');
    }
  });

  // User registration
  app.post('/api/auth/register', registrationLimiter, csrfProtection, async (req, res): Promise<void> => {
    try {
      // SECURITY: Do not log request bodies in production (may contain sensitive data)
      // Use type guard to safely access email for logging
      const hasEmail = typeof req.body === 'object' && req.body !== null && 'email' in req.body;
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Registration request', { hasEmail });
      }

      // Validate input with Zod schema
      const { username, email, password } = registerSchema.parse(req.body);

      // VALIDATION: Explicit email format validation before encryption (defense-in-depth)
      // Even though Zod validates email format, explicit check ensures valid emails before encryption
      // Invalid emails would be stored encrypted and only discovered during password reset/notifications
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        sendError(res, 'Invalid email format', 400);
        return;
      }

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
      const { user, isFirstUser } = await storage.createUserWithTransaction(
        username,
        email,
        passwordHash
      );

      // SECURITY: Log successful registration
      logSecurityEvent(SecurityEventType.REGISTER, req, {
        userId: user.id,
        username: user.username,
        email: user.email,
        success: true,
        metadata: {
          role: user.role,
          isFirstUser,
        },
      });

      // SECURITY: Regenerate session ID after registration to prevent session fixation
      // Log the user in after registration
      req.login(user as Express.User, (err): void => {
        if (err) {
          logger.error('Login after registration failed', {
            error: err instanceof Error ? err.message : String(err),
            userId: user.id,
          });
          sendErrorFromException(res, err, 'LoginAfterRegistration');
          return;
        }

        // Regenerate session ID to prevent session fixation
        const userData = user;
        req.session.regenerate((regenerateErr: Error | null): void => {
          if (regenerateErr) {
            logger.error('Session regeneration failed after registration', {
              error: regenerateErr.message,
              userId: user.id,
            });
            // Continue with original session - registration was successful
            sendSuccess(
              res,
              {
                user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  role: user.role || 'user',
                },
              },
              201
            );
            return;
          }

          // Re-establish user in the new session
          req.login(userData as Express.User, (reloginErr: Error | null): void => {
            if (reloginErr) {
              logger.error('Re-login after regeneration failed', {
                error: reloginErr.message,
                userId: userData.id,
              });
              // Registration succeeded but session setup failed
              sendError(res, 'Registration successful but session setup failed. Please login.', 500);
              return;
            }

            sendSuccess(
              res,
              {
                user: {
                  id: userData.id,
                  username: userData.username,
                  email: userData.email,
                  role: userData.role || 'user',
                },
              },
              201
            );
          });
        });
      });
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'Register');
    }
  });

  // User login
  app.post('/api/auth/login', loginLimiter, csrfProtection, (req, res, next) => {
    // Use custom callback to capture authentication result for logging
    // Type the authenticate callback properly
    type AuthInfo = {
      message?: string;
      locked?: boolean;
      remainingTime?: number;
      remainingAttempts?: number;
    };
    const authenticateCallback = (err: Error | null, user: User | false, info?: AuthInfo) => {
      if (err) {
        logger.error('Login error', { error: err.message || String(err) });
        return next(err);
      }

      if (!user) {
        // SECURITY: Log failed login attempt
        // Safely extract email from request body for logging
        const loginEmail =
          typeof req.body === 'object' && req.body !== null && 'email' in req.body
            ? String((req.body as { email?: unknown }).email ?? '')
            : '';
        logSecurityEvent(SecurityEventType.LOGIN_FAILED, req, {
          email: loginEmail,
          success: false,
          message: info?.message ?? 'Authentication failed',
          metadata: {
            reason: info?.message,
            locked: info?.locked,
            remainingAttempts: info?.remainingAttempts,
          },
        });

        sendError(res, info?.message ?? 'Authentication failed', 401);
        return;
      }

      // Log in the user
      req.login(user, (loginErr: Error | null): void => {
        if (loginErr) {
          logger.error('Session creation error', { error: loginErr.message, userId: user.id });
          next(loginErr);
          return;
        }

        // SECURITY: Regenerate session ID to prevent session fixation attacks
        // This ensures that any pre-login session ID cannot be used by an attacker
        const userData = user;
        req.session.regenerate((regenerateErr: Error | null): void => {
          if (regenerateErr) {
            logger.error('Session regeneration failed after login', {
              error: regenerateErr.message,
              userId: user.id,
            });
            // Continue with original session rather than failing the login
            logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, req, {
              userId: user.id,
              username: user.username,
              email: user.email,
              success: true,
              metadata: { sessionRegenerated: false },
            });

            sendSuccess(res, {
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role || 'user',
              },
            });
            return;
          }

          // Re-establish user in the new session
          req.login(userData, (reloginErr: Error | null): void => {
            if (reloginErr) {
              logger.error('Re-login after regeneration failed', {
                error: reloginErr.message,
                userId: userData.id,
              });
              // Session was regenerated but user data lost - this is a critical error
              sendError(res, 'Login failed', 500);
              return;
            }

            // SECURITY: Log successful login with session regeneration
            logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, req, {
              userId: userData.id,
              username: userData.username,
              email: userData.email,
              success: true,
              metadata: { sessionRegenerated: true },
            });

            sendSuccess(res, {
              user: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                role: userData.role || 'user',
              },
            });
          });
        });
      });
    };

    // Call passport.authenticate with the typed callback
    // passport.authenticate() returns (req, res, next) => void but types as 'any' in some @types/passport versions
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- passport.authenticate returns untyped middleware
    passport.authenticate('local', authenticateCallback)(req, res, next);
  });

  // User logout
  app.post('/api/auth/logout', csrfProtection, (req, res): void => {
    // Capture user before logout (may or may not be authenticated)
    const user = isAuthenticated(req) ? req.user : undefined;

    req.logout((err): void => {
      if (err) {
        logger.error('Logout error', {
          error: err instanceof Error ? err.message : String(err),
          userId: user?.id,
        });
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
  app.post('/api/auth/forgot-password', passwordResetLimiter, csrfProtection, async (req, res): Promise<void> => {
    // SECURITY: Track timing to prevent timing-based email enumeration
    const startTime = Date.now();

    try {
      // Validate input with Zod schema
      const { email } = forgotPasswordSchema.parse(req.body);

      // SECURITY: Always return success to prevent email enumeration
      // Even if the user doesn't exist, we return a success message
      const user = await findUserByEmail(email);

      // SECURITY: Always generate a token (even for non-existent users)
      // This prevents timing leaks from token generation itself
      const crypto = await import('crypto');
      const _dummyToken = crypto.randomBytes(32).toString('hex');

      if (user) {
        // Check rate limiting to prevent abuse
        const rateLimitExceeded = await isRateLimitExceeded(user.id);
        if (rateLimitExceeded) {
          // Log the rate limit event using helper
          logPasswordResetAttempt(req, email, user, false, 'Rate limit exceeded');

          // SECURITY: Normalize response time even for rate-limited requests
          await normalizeResponseTime(startTime);

          // SECURITY: Still return success to prevent email enumeration
          sendSuccess(res, {
            message: 'If an account exists with this email, a password reset link has been sent.',
          });
          return;
        }

        // Check if email service is configured
        if (!emailService.isReady()) {
          logPasswordResetAttempt(req, email, user, false, 'Email service not configured');

          sendError(res, 'Password reset is temporarily unavailable. Please contact support.', 503);
          return;
        }

        // Create a password reset token
        const token = await createPasswordResetToken(user.id, req.ip, req.get('user-agent'));

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
          emailSent ? undefined : 'Failed to send email'
        );
      } else {
        // SECURITY: User doesn't exist - simulate similar operations to prevent timing attack
        // This ensures response time is similar to when user exists
        // Note: _dummyToken already generated above (prevents token generation timing leak)
        await normalizeResponseTime(startTime);

        // User doesn't exist, but log this attempt
        logPasswordResetAttempt(req, email, null, false, 'User not found');
      }

      // SECURITY: Always return the same response regardless of whether user exists
      sendSuccess(res, {
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (error: unknown) {
      logger.error('Forgot password error', {
        error: error instanceof Error ? error.message : String(error),
      });

      // SECURITY: Normalize timing even for errors to prevent enumeration
      // Note: dummyToken generation may or may not have occurred depending on where error happened
      await normalizeResponseTime(startTime);

      // SECURITY: Don't reveal internal errors
      sendSuccess(res, {
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }
  });

  // Password reset - Validate token
  app.get('/api/auth/reset-password/:token', async (req, res): Promise<void> => {
    try {
      const { token } = req.params;

      if (!token) {
        sendError(res, 'Token is required', 400);
        return;
      }

      const tokenRecord = await validatePasswordResetToken(token);

      if (!tokenRecord) {
        sendError(res, 'Invalid or expired password reset token', 400);
        return;
      }

      // Get user info (without sensitive data)
      const user = await getUserByResetToken(token);

      if (!user) {
        sendError(res, 'Invalid password reset token', 400);
        return;
      }

      sendSuccess(res, {
        email: user.email,
        username: user.username,
      });
    } catch (error: unknown) {
      logger.error('Validate reset token error', {
        error: error instanceof Error ? error.message : String(error),
      });
      sendErrorFromException(res, error, 'ValidateResetToken');
    }
  });

  // Password reset - Complete reset
  app.post('/api/auth/reset-password', csrfProtection, async (req, res): Promise<void> => {
    try {
      // Validate input with Zod schema
      const { token, password } = resetPasswordSchema.parse(req.body);

      // Validate password strength using shared validation
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        sendError(res, passwordValidation.errors[0], 400);
        return;
      }

      // Hash the new password - SECURITY: NEVER expose in responses, passed to storage layer only
      const newPasswordHash = await hashPassword(password);

      // SECURITY: Use atomic password reset with READ COMMITTED transaction
      // This prevents the critical vulnerability where a server crash between password update
      // and token marking could allow token reuse.
      // All steps (validate token, update password, invalidate all tokens, clear sessions) are atomic.
      const userId = await resetPasswordAtomic(token, newPasswordHash); // NEVER exposed in API

      // Get user info for logging and email using userId from atomic operation
      // SECURITY: getUserByIdSafe never exposes passwordHash
      const user = await storage.getUserByIdSafe(userId);

      if (!user) {
        // This should never happen since resetPasswordAtomic validates the user
        // but we handle it defensively
        logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
          success: false,
          message: 'User not found after successful reset',
          metadata: { userId },
        });

        sendError(res, 'Password reset failed', 500);
        return;
      }

      // Log the successful password reset
      logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
        userId: user.id,
        email: user.email,
        username: user.username,
        success: true,
      });

      // Send confirmation email
      if (emailService.isReady()) {
        await emailService.sendPasswordResetConfirmationEmail(user.email, user.username);
      }

      sendSuccess(res, {
        message: 'Password has been reset successfully. You can now log in with your new password.',
      });
    } catch (error: unknown) {
      logger.error('Reset password error', {
        error: error instanceof Error ? error.message : String(error),
      });
      sendErrorFromException(res, error, 'ResetPassword');
    }
  });

  // Password change - Change password for authenticated user
  app.post('/api/auth/change-password', csrfProtection, async (req, res): Promise<void> => {
    try {
      // Check authentication
      if (!isAuthenticated(req)) {
        sendError(res, 'Not authenticated', 401);
        return;
      }

      // Validate input with Zod schema
      const parseResult = changePasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        sendError(res, 'Validation failed', 400, parseResult.error.flatten().fieldErrors);
        return;
      }

      const { currentPassword, newPassword } = parseResult.data;

      // Validate new password strength
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        sendError(res, passwordValidation.errors[0], 400);
        return;
      }

      // Fetch user with password hash
      const user = await storage.getUserWithPassword(req.user.id);
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        // SECURITY: Log failed password change attempt
        logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
          userId: req.user.id,
          email: user.email,
          username: user.username,
          success: false,
          message: 'Incorrect current password',
        });

        sendError(res, 'Current password is incorrect', 401);
        return;
      }

      // Prevent setting same password
      const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
      if (isSamePassword) {
        sendError(res, 'New password must be different from current password', 400);
        return;
      }

      // Hash and save new password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPasswordHash(req.user.id, hashedPassword);

      // Invalidate other sessions (keep current one)
      await storage.invalidateUserSessions(req.user.id, req.sessionID);

      // SECURITY: Log successful password change
      logSecurityEvent(SecurityEventType.PASSWORD_RESET_COMPLETED, req, {
        userId: req.user.id,
        email: user.email,
        username: user.username,
        success: true,
        message: 'Password changed via authenticated endpoint',
      });

      // Send confirmation email if email service is ready
      if (emailService.isReady()) {
        await emailService.sendPasswordResetConfirmationEmail(user.email, user.username);
      }

      sendSuccess(res, { message: 'Password changed successfully' });
    } catch (error: unknown) {
      logger.error('Change password error', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });
      sendErrorFromException(res, error, 'ChangePassword');
    }
  });

  // Get current user
  app.get('/api/auth/user', async (req, res): Promise<void> => {
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
