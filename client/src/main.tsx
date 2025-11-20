import { createRoot } from "react-dom/client";
import React from "react";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";
import "./styles/mobile-optimizations.css";

/**
 * Sentry Error Monitoring Initialization
 * Captures frontend errors, performance metrics, and user sessions
 * Matches backend Sentry configuration in server/config/sentry.ts
 */
const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.MODE; // 'development' or 'production'
const isProduction = environment === 'production';

if (dsn) {
  console.log(`🔍 Initializing Sentry error monitoring (${environment})...`);

  Sentry.init({
    dsn,
    environment,

    // Performance Monitoring
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration({
        // Trace navigation and user interactions
        tracingOrigins: ["localhost", /^\//],
      }),

      // Session replay for debugging user sessions
      Sentry.replayIntegration({
        maskAllText: false, // Show actual text in replays
        blockAllMedia: false, // Show images/videos in replays
      }),

      // React-specific integration
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect: React.useEffect,
      } as any), // Wouter doesn't have official integration, but works with v6 API
    ],

    // Tracing - adjust sample rate based on environment
    // Production: 10% of transactions (cost optimization)
    // Development: 100% for debugging
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Session Replay
    // Production: 10% of sessions, 100% of error sessions
    // Development: 100% of sessions for debugging
    replaysSessionSampleRate: isProduction ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0, // Always capture sessions with errors

    // Filter out operational errors (expected errors like 404s, network errors)
    beforeSend(event, hint) {
      const error = hint.originalException;

      if (error instanceof Error) {
        // Don't send network errors (CORS, timeouts, etc.)
        if (
          error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('Network request failed')
        ) {
          return null;
        }

        // Don't send 404 errors (expected)
        if (error.message.includes('404') || error.message.includes('Not Found')) {
          return null;
        }

        // Don't send validation errors (handled by UI)
        if (error.name === 'ValidationError' || error.name === 'ZodError') {
          return null;
        }

        // Don't send React Query errors (handled by error boundaries)
        if (error.message.includes('Query') && error.message.includes('failed')) {
          return null;
        }
      }

      return event;
    },

    // Set release version from package.json
    release: import.meta.env.VITE_SENTRY_RELEASE || '1.0.0',

    // Enable debug mode in development
    debug: !isProduction,

    // Attach stack traces to messages
    attachStacktrace: true,

    // Maximum breadcrumbs to capture
    maxBreadcrumbs: 50,
  });

  console.log('✅ Sentry initialized successfully');
} else {
  if (isProduction) {
    console.warn('⚠️  WARNING: VITE_SENTRY_DSN not configured in production!');
    console.warn('   Frontend error tracking is disabled.');
  } else {
    console.log('ℹ️  Sentry not configured (VITE_SENTRY_DSN missing) - error tracking disabled');
  }
}

createRoot(document.getElementById("root")!).render(<App />);
