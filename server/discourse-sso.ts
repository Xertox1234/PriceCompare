import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { sharedUsers, ssoTokens, discourseUserMapping } from '../shared/auth-schema';
import { eq, and, lt, gt } from 'drizzle-orm';
import type { SharedUser, SharedUserWithDiscourse } from '../shared/auth-schema';
import { getRequiredEnv, getOptionalEnv } from './config/env-validation';
import { createLogger } from './utils/logger';
import { sendError } from './utils/api-response';

const log = createLogger('DiscourseSSO');

// SECURITY: These values are required for SSO to function securely
// Never use default values for SSO secrets in production
const DISCOURSE_SSO_SECRET = getRequiredEnv('DISCOURSE_SSO_SECRET');
const _DISCOURSE_URL = getOptionalEnv('DISCOURSE_URL', 'http://localhost:3000');

/**
 * Generate Discourse SSO payload and signature
 */
export function generateDiscourseSSO(user: SharedUser, nonce: string, returnUrl: string) {
  const payload = Buffer.from(
    [
      `nonce=${nonce}`,
      `email=${encodeURIComponent(user.email)}`,
      `external_id=${user.id}`,
      `username=${encodeURIComponent(user.username)}`,
      `name=${encodeURIComponent(user.username)}`,
      user.avatarUrl ? `avatar_url=${encodeURIComponent(user.avatarUrl)}` : '',
      user.bio ? `bio=${encodeURIComponent(user.bio)}` : '',
      user.website ? `website=${encodeURIComponent(user.website)}` : '',
      user.role === 'admin' ? 'admin=true' : '',
      user.role === 'moderator' ? 'moderator=true' : '',
      `return_sso_url=${encodeURIComponent(returnUrl)}`,
    ]
      .filter(Boolean)
      .join('&')
  ).toString('base64');

  const signature = crypto.createHmac('sha256', DISCOURSE_SSO_SECRET).update(payload).digest('hex');

  return { payload, signature };
}

/**
 * Verify SSO signature from Discourse
 *
 * SECURITY: Uses constant-time comparison to prevent timing attacks.
 * String comparison (===) short-circuits on first mismatch, allowing
 * attackers to recover the secret by measuring response times.
 *
 * @internal Exported for testing only - do not use directly in application code
 */
export function verifySSO(sso: string, sig: string): boolean {
  const computedSig = crypto.createHmac('sha256', DISCOURSE_SSO_SECRET).update(sso).digest('hex');

  // SECURITY: Length check required before timingSafeEqual
  // Also prevents processing invalid signatures
  if (computedSig.length !== sig.length) {
    return false;
  }

  // SECURITY: Constant-time comparison prevents timing attacks
  // Always compares ALL bytes regardless of where mismatch occurs
  // NOTE: Both signatures are hex-encoded strings from digest('hex'), so decode as 'hex'
  return crypto.timingSafeEqual(Buffer.from(computedSig, 'hex'), Buffer.from(sig, 'hex'));
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

// Type for request with optional user (for type casting only)
type RequestWithUser = Request & { user?: SharedUser };

/**
 * Handle Discourse SSO login request
 */
export async function handleDiscourseSSO(req: RequestWithUser, res: Response) {
  try {
    const { sso, sig } = req.query;

    if (!sso || !sig) {
      sendError(res, 'Missing SSO parameters', 400);
      return;
    }

    // Verify the request signature
    if (!verifySSO(sso as string, sig as string)) {
      sendError(res, 'Invalid SSO signature', 403);
      return;
    }

    // Check if user is authenticated
    if (!req.user) {
      // Store SSO request in session for after login
      const token = crypto.randomBytes(32).toString('hex');
      const params = parseSSO(sso as string);

      await db.insert(ssoTokens).values({
        token,
        userId: null, // Will be set after login
        nonce: params.nonce || '',
        returnUrl: params.return_sso_url || '',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });

      return res.redirect(
        `/login?sso_token=${token}&return_to=${encodeURIComponent(req.originalUrl)}`
      );
    }

    // Parse the SSO payload
    const params = parseSSO(sso as string);
    const nonce = params.nonce;
    const returnUrl = params.return_sso_url;

    if (!nonce || !returnUrl) {
      sendError(res, 'Missing required SSO parameters', 400);
      return;
    }

    // Create/update Discourse user mapping
    await syncUserWithDiscourse(req.user);

    // Generate SSO response
    const { payload, signature } = generateDiscourseSSO(req.user, nonce, returnUrl);

    // Redirect back to Discourse with SSO response
    const redirectUrl = `${returnUrl}?sso=${encodeURIComponent(payload)}&sig=${signature}`;
    res.redirect(redirectUrl);
  } catch (error) {
    log.error('Discourse SSO error:', { error });
    sendError(res, 'SSO authentication failed', 500);
  }
}

/**
 * Complete SSO process after user login
 */
export async function completeSSOAfterLogin(req: RequestWithUser, res: Response) {
  try {
    const { sso_token } = req.query;

    if (!sso_token || !req.user) {
      sendError(res, 'Invalid SSO completion request', 400);
      return;
    }

    // Find the stored SSO token
    const [tokenRecord] = await db
      .select()
      .from(ssoTokens)
      .where(and(eq(ssoTokens.token, sso_token as string), gt(ssoTokens.expiresAt, new Date())))
      .limit(1);

    if (!tokenRecord) {
      sendError(res, 'Invalid or expired SSO token', 400);
      return;
    }

    // Update token with user ID
    await db.update(ssoTokens).set({ userId: req.user.id }).where(eq(ssoTokens.id, tokenRecord.id));

    // Create/update Discourse user mapping
    await syncUserWithDiscourse(req.user);

    // Generate SSO response
    const { payload, signature } = generateDiscourseSSO(
      req.user,
      tokenRecord.nonce || '',
      tokenRecord.returnUrl || ''
    );

    // Clean up the token
    await db.delete(ssoTokens).where(eq(ssoTokens.id, tokenRecord.id));

    // Redirect back to Discourse
    const redirectUrl = `${tokenRecord.returnUrl}?sso=${encodeURIComponent(payload)}&sig=${signature}`;
    return res.redirect(redirectUrl);
  } catch (error) {
    log.error('SSO completion error:', { error });
    sendError(res, 'SSO completion failed', 500);
    return;
  }
}

/**
 * Sync user data with Discourse
 */
async function syncUserWithDiscourse(user: SharedUser): Promise<void> {
  try {
    // Check if mapping already exists
    const [existingMapping] = await db
      .select()
      .from(discourseUserMapping)
      .where(eq(discourseUserMapping.priceAppUserId, user.id))
      .limit(1);

    if (existingMapping) {
      // Update last sync time
      await db
        .update(discourseUserMapping)
        .set({
          lastSyncAt: new Date(),
          discourseUsername: user.username,
        })
        .where(eq(discourseUserMapping.id, existingMapping.id));
    } else {
      // Create new mapping (discourse_user_id will be populated by Discourse)
      await db.insert(discourseUserMapping).values({
        priceAppUserId: user.id,
        discourseUserId: user.id, // Use same ID initially
        discourseUsername: user.username,
      });
    }
  } catch (error) {
    log.error('Error syncing user with Discourse:', { error });
    // Don't throw - SSO should still work even if sync fails
  }
}

/**
 * Get user with Discourse information
 */
export async function getUserWithDiscourse(
  userId: number
): Promise<SharedUserWithDiscourse | null> {
  try {
    const [user] = await db
      .select({
        // User fields
        id: sharedUsers.id,
        username: sharedUsers.username,
        email: sharedUsers.email,
        // SECURITY: Never expose passwordHash
        discourseUserId: sharedUsers.discourseUserId,
        role: sharedUsers.role,
        bio: sharedUsers.bio,
        location: sharedUsers.location,
        website: sharedUsers.website,
        avatarUrl: sharedUsers.avatarUrl,
        createdAt: sharedUsers.createdAt,
        updatedAt: sharedUsers.updatedAt,
        // Discourse mapping
        mappingId: discourseUserMapping.id,
        mappingDiscourseUserId: discourseUserMapping.discourseUserId,
        mappingDiscourseUsername: discourseUserMapping.discourseUsername,
        mappingLastSyncAt: discourseUserMapping.lastSyncAt,
      })
      .from(sharedUsers)
      .leftJoin(discourseUserMapping, eq(sharedUsers.id, discourseUserMapping.priceAppUserId))
      .where(eq(sharedUsers.id, userId))
      .limit(1);

    if (!user) return null;

    const result: SharedUserWithDiscourse = {
      id: user.id,
      username: user.username,
      email: user.email,
      passwordHash: '', // SECURITY: Never expose - empty string to satisfy type
      discourseUserId: user.discourseUserId,
      role: user.role,
      bio: user.bio,
      location: user.location,
      website: user.website,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    if (user.mappingId) {
      // Verify all mapping fields are present (database constraint ensures this)
      if (
        !user.mappingDiscourseUserId ||
        !user.mappingDiscourseUsername ||
        !user.mappingLastSyncAt
      ) {
        throw new Error('Mapping fields must be present when mappingId exists');
      }

      result.discourseMapping = {
        id: user.mappingId,
        priceAppUserId: user.id,
        discourseUserId: user.mappingDiscourseUserId,
        discourseUsername: user.mappingDiscourseUsername,
        lastSyncAt: user.mappingLastSyncAt,
      };
    }

    return result;
  } catch (error) {
    log.error('Error getting user with Discourse info:', { error });
    return null;
  }
}

/**
 * Clean up expired SSO tokens
 */
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    await db.delete(ssoTokens).where(lt(ssoTokens.expiresAt, new Date()));
  } catch (error) {
    log.error('Error cleaning up expired SSO tokens:', { error });
  }
}

/**
 * Middleware to handle SSO token completion
 */
export function handleSSOCompletion(req: RequestWithUser, res: Response, next: NextFunction) {
  if (req.query.sso_token && req.user) {
    // Complete SSO process
    return completeSSOAfterLogin(req, res);
  }
  return next();
}
