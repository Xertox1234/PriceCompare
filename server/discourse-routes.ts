import type { Express, Request, Response } from "express";
import crypto from 'crypto';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import type { User } from '../shared/schema';
import { requireAuth } from './auth';
import { getRequiredEnv } from './config/env-validation';

// SECURITY: Required for secure SSO HMAC signing - never use default values
const DISCOURSE_SSO_SECRET = getRequiredEnv('DISCOURSE_SSO_SECRET');

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
function verifyWebhookSignature(payload: any, signature: string | undefined): boolean {
  if (!signature) {
    return false;
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const computedSig = crypto
    .createHmac('sha256', DISCOURSE_SSO_SECRET)
    .update(payloadString)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(computedSig, 'hex')
    );
  } catch {
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
        return res.status(400).json({ error: 'Missing SSO parameters' });
      }
      
      // Verify the request signature
      if (!verifySSO(sso as string, sig as string)) {
        return res.status(403).json({ error: 'Invalid SSO signature' });
      }
      
      // Check if user is authenticated
      if (!req.user) {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(req.originalUrl);
        return res.redirect(`/login?return_to=${returnUrl}`);
      }
      
      // Parse the SSO payload
      const params = parseSSO(sso as string);
      const nonce = params.nonce;
      const returnUrl = params.return_sso_url;
      
      if (!nonce || !returnUrl) {
        return res.status(400).json({ error: 'Missing required SSO parameters' });
      }
      
      // Generate SSO response
      const { payload, signature } = generateDiscourseSSO(req.user, nonce, returnUrl);
      
      // Redirect back to Discourse with SSO response
      const redirectUrl = `${returnUrl}?sso=${encodeURIComponent(payload)}&sig=${signature}`;
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('Discourse SSO error:', error);
      res.status(500).json({ error: 'SSO authentication failed' });
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
      if (!verifyWebhookSignature(req.body, signature)) {
        console.warn('Discourse webhook signature verification failed');
        return res.status(403).json({ error: 'Invalid webhook signature' });
      }

      const { event_type, user } = req.body;

      if (event_type === 'user_created' && user) {
        // Sync Discourse user creation back to main app if needed
        console.log('Discourse user created:', user);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Discourse webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Test Discourse SSO configuration
   */
  app.get("/api/admin/discourse/test-sso", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const testNonce = crypto.randomBytes(16).toString('hex');
      const testReturnUrl = 'http://localhost:3000/session/sso_login';
      
      const { payload, signature } = generateDiscourseSSO(req.user, testNonce, testReturnUrl);
      
      res.json({
        success: true,
        test_payload: payload,
        test_signature: signature,
        sso_secret_configured: !!process.env.DISCOURSE_SSO_SECRET,
        discourse_url_configured: !!process.env.DISCOURSE_URL
      });
    } catch (error) {
      console.error('Discourse SSO test error:', error);
      res.status(500).json({ error: 'SSO test failed' });
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
    } catch (error) {
      console.error('Discourse health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed'
      });
    }
  });
}