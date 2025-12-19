import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

// Full E2E suite (includes debug + visual specs)
export default defineConfig({
  ...baseConfig,
  testIgnore: [],
});
