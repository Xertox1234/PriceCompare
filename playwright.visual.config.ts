import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

// Visual regression specs only
export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: ['**/*.visual.spec.ts'],
});
