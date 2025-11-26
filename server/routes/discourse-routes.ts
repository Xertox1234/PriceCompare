import type { Express, Request, Response } from "express";
import { logger } from "../utils/logger";
import crypto from 'crypto';
import type { User } from '@shared/schema';
import { requireAuth } from '../auth';
import { getRequiredEnv } from '../config/env-validation';
import { handleRouteError, notFound } from "./helpers";

// SECURITY: Required for secure SSO HMAC signing - never use default values
const DISCOURSE_SSO_SECRET = getRequiredEnv('DISCOURSE_SSO_SECRET');

// SECURITY: Separate secret for webhook verification (best practice)
// Falls back to SSO secret for backward compatibility
const DISCOURSE_WEBHOOK_SECRET = process.env.DISCOURSE_WEBHOOK_SECRET || DISCOURSE_SSO_SECRET;

/**
 * Generate Discourse SSO payload and signature
 */
function generateDiscourseSSO(user: User, nonce: string, returnUrl: string) {
  const payload = Buffer.from([
    `nonce=${nonce}`,
    `email=${encodeURIComponent(user.email)}`,
    `external_id=${user.id}`,
    `username=${encodeURIComponent(user.username)}`,
    `name=${encodeURIComponent(user.username)}`,
    user.role === 'admin' ? 'admin=true' : '',
    user.role === 'moderator' ? 'moderator=true' : '',
    `return_sso_url=${encodeURIComponent(returnUrl)}`
  ].filter(Boolean).join('&')).toString('base64');
  
  const signature = crypto
    .createHmac('sha256', DISCOURSE_SSO_SECRET)
    .update(payload)
    .digest('hex');
    
  return { payload, signature };
}

/**
 * Verify SSO signature from Discourse
 */
function verifySSO(sso: string, sig: string): boolean {
  const computedSig = crypto
    .createHmac('sha256', DISCOURSE_SSO_SECRET)
    .update(sso)
    .digest('hex');

  return computedSig === sig;
}

/**
 * Verify webhook signature from Discourse
 * SECURITY: Critical for preventing unauthorized webhook submissions
 */
function verifyWebhookSignature(payload: string | Record<string, unknown>, signature: string | undefined): boolean {
  if (!signature) {
    logger.warn('Webhook verification failed: No signature provided');
    return false;
  }

  // Support both sha256= prefix and raw hex
  const signatureValue = signature.startsWith('sha256=')
    ? signature.substring(7)
    : signature;

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const computedSig = crypto
    .createHmac('sha256', DISCOURSE_WEBHOOK_SECRET)
    .update(payloadString)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureValue),
      Buffer.from(computedSig)
    );
  } catch (error: unknown) {
    logger.warn('Webhook verification failed: Invalid signature format');
    return false;
  }
}

/**
 * Parse SSO payload from Discourse
 */
function parseSSO(sso: string): Record<string, string> {
  const decodedPayload = Buffer.from(sso, 'base64').toString();
  const params = new URLSearchParams(decodedPayload);
  const result: Record<string, string> = {};
  
  params.forEach((value, key) => {
    result[key] = value;
  });
  
  return result;
}

export function registerDiscourseRoutes(app: Express): void {
  /**
   * Discourse SSO login endpoint
   */
  app.get("/discourse/sso", async (req: Request, res: Response) => {
    try {
      const { sso, sig } = req.query;
      
      if (!sso || !sig) {
        res.status(400).json({ error: 'Missing SSO parameters' });
        return;
      }

      // Verify the request signature
      if (!verifySSO(sso as string, sig as string)) {
        res.status(403).json({ error: 'Invalid SSO signature' });
        return;
      }

      // Check if user is authenticated
      if (!req.user) {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(req.originalUrl);
        res.redirect(`/login?return_to=${returnUrl}`);
        return;
      }

      // Parse the SSO payload
      const params = parseSSO(sso as string);
      const nonce = params.nonce;
      const returnUrl = params.return_sso_url;

      if (!nonce || !returnUrl) {
        res.status(400).json({ error: 'Missing required SSO parameters' });
        return;
      }

      // Generate SSO response
      const { payload, signature } = generateDiscourseSSO(req.user as User, nonce, returnUrl);
      
      // Redirect back to Discourse with SSO response
      const redirectUrl = `${returnUrl}?sso=${encodeURIComponent(payload)}&sig=${signature}`;
      res.redirect(redirectUrl);
      
    } catch (error: unknown) {
      handleRouteError(res, error, 'DiscourseSSOLogin');
    }
  });

  /**
   * Discourse webhook endpoint for user synchronization
   * SECURITY: Requires signature verification to prevent unauthorized webhook submissions
   */
  app.post("/discourse/webhook", async (req: Request, res: Response) => {
    try {
      // SECURITY: Verify webhook signature before processing
      const signature = req.headers['x-discourse-event-signature'] as string;

      if (!signature) {
        logger.warn('Discourse webhook rejected: Missing signature header');
        res.status(401).json({
          error: 'Missing webhook signature',
          message: 'X-Discourse-Event-Signature header is required'
        });
        return;
      }

      if (!verifyWebhookSignature(req.body, signature)) {
        logger.warn('Discourse webhook rejected: Invalid signature', {
          receivedSignature: signature.substring(0, 10) + '...',
          eventType: req.body.event_type,
        });
        res.status(403).json({
          error: 'Invalid webhook signature',
          message: 'Webhook signature verification failed'
        });
        return;
      }

      const { event_type, user } = req.body;

      // Log successful webhook receipt
      logger.info('Discourse webhook received:', { event_type, userId: user?.id });

      if (event_type === 'user_created' && user) {
        // Sync Discourse user creation back to main app if needed
        logger.info('Discourse user created:', { username: user.username, email: user.email });
      }

      res.json({ success: true, event_type });
    } catch (error: unknown) {
      handleRouteError(res, error, 'DiscourseWebhook');
    }
  });

  /**
   * Test Discourse SSO configuration
   */
  app.get("/api/admin/discourse/test-sso", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const testNonce = crypto.randomBytes(16).toString('hex');
      const testReturnUrl = 'http://localhost:3000/session/sso_login';

      const { payload, signature } = generateDiscourseSSO(req.user as User, testNonce, testReturnUrl);
      
      res.json({
        success: true,
        test_payload: payload,
        test_signature: signature,
        sso_secret_configured: !!process.env.DISCOURSE_SSO_SECRET,
        discourse_url_configured: !!process.env.DISCOURSE_URL
      });
    } catch (error: unknown) {
      handleRouteError(res, error, 'DiscourseSSOTest');
    }
  });

  /**
   * Health check for Discourse integration
   */
  app.get("/api/discourse/health", async (req: Request, res: Response) => {
    try {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      handleRouteError(res, error, 'DiscourseHealthCheck');
    }
  });
}