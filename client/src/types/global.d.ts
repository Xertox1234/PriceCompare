/**
 * Global Window Type Extensions
 *
 * Provides type-safe declarations for window object extensions used throughout
 * the application. This eliminates the need for `window as any` casts.
 */

import type { WebSocketClient } from '@/lib/websocket-client';
import type DOMPurify from 'dompurify';

declare global {
  interface Window {
    /**
     * WebSocket client singleton exposed for debugging in development mode.
     * @see client/src/lib/websocket-client.ts
     */
    websocketClient?: WebSocketClient;

    /**
     * DOMPurify library for HTML sanitization.
     * Loaded dynamically via npm package or CDN fallback.
     * @see client/src/utils/sanitize.ts
     */
    DOMPurify?: typeof DOMPurify;

    /**
     * Webkit-prefixed AudioContext for older Safari versions.
     * Standard AudioContext is preferred when available.
     * @see client/src/hooks/use-notification-updates.ts
     */
    webkitAudioContext?: typeof AudioContext;
  }
}

export {};
