/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./client/src/test/setup.ts', './server/test/setup.ts'],
    fileParallelism: false, // Disable file parallelism to prevent database deadlocks in service tests
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/download_package/**',
      '**/attached_assets/**',
      '**/docs/**',
      '**/.worktrees/**'
    ],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        // Dependencies
        'node_modules/',
        'dist/',

        // Test files
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        'client/src/test/**',
        'server/test/**',
        'e2e/**',

        // Config files
        '**/*.d.ts',
        '**/*.config.*',
        'vitest.config.ts',
        'playwright.config.ts',
        'tailwind.config.ts',
        'postcss.config.js',

        // Build and tooling
        'scripts/**',
        'migrations/**',
        '.claude/**',

        // Entry points (minimal logic)
        'client/src/main.tsx',
        'server/index.ts',

        // Third-party components
        'client/src/components/ui/**', // shadcn/ui components are already tested upstream

        // Static assets and docs
        'download_package/',
        'attached_assets/',
        'docs/',
        'public/',

        // Generated files
        '**/*.generated.ts',
        '**/generated/**'
      ],
      include: [
        'client/src/**/*.{ts,tsx}',
        'server/**/*.{ts,tsx}',
        'shared/**/*.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Per-file thresholds can be stricter for critical files
        'server/auth.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'server/middleware/csrf.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      // Fail CI if coverage drops below thresholds
      all: true,
      skipFull: false,
      clean: true
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@server': path.resolve(__dirname, './server'),
    }
  }
})