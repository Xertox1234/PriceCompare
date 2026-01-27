import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    // Performance optimization: Manual chunking for better caching and loading
    // See docs/PERFORMANCE_GUIDE.md for code splitting strategy
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries + router (shared across all pages)
          'vendor-react': ['react', 'react-dom', 'wouter'],

          // React Query for data fetching (needed on most pages)
          'vendor-query': ['@tanstack/react-query'],

          // UI component libraries - Core (Radix UI)
          // Split into core and extended for better granularity
          'vendor-ui-core': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
            '@radix-ui/react-tabs',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
          ],

          // UI component libraries - Extended (less commonly used)
          'vendor-ui-extended': [
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-switch',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-progress',
            '@radix-ui/react-label',
            '@radix-ui/react-accordion',
            '@radix-ui/react-slider',
          ],

          // Charts library - CRITICAL: Keep separate for lazy loading
          // This is 367KB and should only load on chart pages
          'vendor-charts': ['recharts'],

          // Form handling (lazy load with form-heavy pages)
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],

          // Icons library
          'vendor-icons': ['lucide-react'],

          // Utility libraries (frequently used, small)
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority', 'date-fns'],

          // Socket.io for real-time features (only needed on specific pages)
          'vendor-socket': ['socket.io-client'],

          // Helmet for SEO (small, used across pages)
          'vendor-seo': ['react-helmet-async'],

          // Carousel libraries (used on home page and product pages)
          'vendor-carousel': ['swiper', 'embla-carousel-react'],
        },
      },
    },
    // Warn for chunks larger than 650KB (matches bundlesize config)
    chunkSizeWarningLimit: 650,
    // Enable source maps for production debugging (required for Sentry error tracking)
    sourcemap: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
});
