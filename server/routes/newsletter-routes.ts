import { Express } from 'express';
import { z } from 'zod';
import { csrfProtection } from '../middleware/security';
import { storage } from '../storage';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
import { logger } from '../utils/logger';

/**
 * Newsletter Routes
 *
 * Agent-accessible APIs for newsletter subscription management.
 * All routes use CSRF protection per project patterns.
 */

// Zod schemas for validation
// Note: insertNewsletterSubscriberSchema has refinements, so we use pick() + extend()
// to create a new schema instead of extending the refined schema directly
const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  source: z.string().max(50).optional(),
  userId: z.number().optional().nullable(),
  isActive: z.boolean().optional(),
});

const unsubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export function registerNewsletterRoutes(app: Express): void {
  /**
   * POST /api/newsletter/subscribe
   *
   * Subscribe an email to the newsletter.
   * Links to logged-in user if authenticated.
   *
   * NOTE: Email addresses are normalized to lowercase for case-insensitive matching.
   * Example: "User@Example.COM" is stored as "user@example.com"
   *
   * RACE CONDITION FIX: Uses atomic subscription method to prevent 500 errors
   * when concurrent requests try to subscribe the same email simultaneously.
   *
   * @body { email: string, source?: string }
   * @returns 201 { success: true, data: { subscriber } } - Successfully subscribed
   * @returns 200 { success: true, data: { subscriber } } - Reactivated subscription
   * @returns 409 { success: false, error: "Already subscribed" } - Email already active
   * @returns 400 { success: false, error: "Validation error" } - Invalid input
   */
  app.post('/api/newsletter/subscribe', csrfProtection, async (req, res) => {
    try {
      // Validate input
      const data = subscribeSchema.parse(req.body);
      const userId = req.user?.id;

      // Use atomic subscription method to prevent race conditions
      // This wraps check-then-act in a SERIALIZABLE transaction
      const result = await storage.subscribeToNewsletterAtomic(data.email, data.source, userId);

      // Handle already active subscription
      if (result.alreadyActive) {
        sendError(res, 'Email is already subscribed to the newsletter', 409);
        return;
      }

      // Log subscription event
      logger.info(
        result.isReactivation ? 'Newsletter subscription reactivated' : 'Newsletter subscription created',
        {
          email: data.email,
          userId,
          source: data.source,
          isReactivation: result.isReactivation,
        }
      );

      // Return 200 for reactivation, 201 for new subscription
      sendSuccess(res, { subscriber: result.subscriber }, result.isReactivation ? 200 : 201);
    } catch (error) {
      sendErrorFromException(res, error, 'NewsletterSubscribe');
    }
  });

  /**
   * POST /api/newsletter/unsubscribe
   *
   * Unsubscribe an email from the newsletter.
   * Sets is_active = false instead of deletion for audit trail.
   *
   * NOTE: Email addresses are normalized to lowercase for case-insensitive matching.
   *
   * @body { email: string }
   * @returns 200 { success: true, data: { message } } - Successfully unsubscribed
   * @returns 404 { success: false, error: "Not found" } - Email not subscribed
   * @returns 400 { success: false, error: "Validation error" } - Invalid input
   */
  app.post('/api/newsletter/unsubscribe', csrfProtection, async (req, res) => {
    try {
      // Validate input
      const data = unsubscribeSchema.parse(req.body);

      // Check if subscription exists
      const subscriber = await storage.getNewsletterSubscriberByEmail(data.email);

      if (!subscriber) {
        sendError(res, 'Email address not found in newsletter subscribers', 404);
        return;
      }

      if (!subscriber.isActive) {
        // Already unsubscribed
        sendSuccess(res, { message: 'Email is already unsubscribed' });
        return;
      }

      // Unsubscribe
      await storage.unsubscribeFromNewsletter(data.email);

      logger.info('Newsletter unsubscription processed', {
        email: data.email,
        subscriberId: subscriber.id,
      });

      sendSuccess(res, { message: 'Successfully unsubscribed from newsletter' });
    } catch (error) {
      sendErrorFromException(res, error, 'NewsletterUnsubscribe');
    }
  });

  /**
   * GET /api/newsletter/status/:email
   *
   * Check subscription status for an email (public endpoint, no CSRF).
   * Useful for UI to show current subscription state.
   *
   * NOTE: Email addresses are normalized to lowercase for case-insensitive matching.
   *
   * @param email - Email address to check (URL-encoded)
   * @returns 200 { success: true, data: { subscribed: boolean } }
   */
  app.get('/api/newsletter/status/:email', async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);

      // Validate email format
      const emailSchema = z.string().email();
      const validatedEmail = emailSchema.parse(email);

      const isSubscribed = await storage.isEmailSubscribed(validatedEmail);

      sendSuccess(res, { subscribed: isSubscribed });
    } catch (error) {
      sendErrorFromException(res, error, 'NewsletterStatus');
    }
  });

  logger.info('Newsletter routes registered');
}
