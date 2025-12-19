import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

// Diagnostic/debug specs only
export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: ['**/*debug*.spec.ts'],
});
