import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Performance optimization: Manual chunking for better caching and loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'vendor-react': ['react', 'react-dom'],

          // React Query for data fetching
          'vendor-query': ['@tanstack/react-query'],

          // UI component libraries (Radix UI)
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

          // Additional UI components
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

          // Charts library (heavy)
          'vendor-charts': ['recharts'],

          // Form handling
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],

          // Icons
          'vendor-icons': ['lucide-react'],

          // Utilities
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority', 'date-fns'],
        },
      },
    },
    // Warn for chunks larger than 600KB
    chunkSizeWarningLimit: 600,
    // Enable source maps for production debugging (can be disabled if not needed)
    sourcemap: false,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
