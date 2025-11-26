/**
 * Type extensions for express-session
 * SECURITY: Proper type safety for session data to prevent type confusion vulnerabilities
 */
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    csrfToken?: string;
  }
}
