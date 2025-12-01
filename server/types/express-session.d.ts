/**
 * Type extensions for express-session and express
 * SECURITY: Proper type safety for session data to prevent type confusion vulnerabilities
 */
import 'express-session';
import 'express';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    csrfToken?: string;
  }
}

declare module 'express' {
  interface Locals {
    /** CSP nonce for script/style tags - set by security middleware */
    cspNonce?: string;
    /** Request ID for logging correlation */
    requestId?: string;
    /** Request start timestamp for performance monitoring */
    requestStartTime?: number;
    /** User ID from authenticated session */
    userId?: number;
  }
}
