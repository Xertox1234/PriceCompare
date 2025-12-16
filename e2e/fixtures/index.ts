import { test as base, expect, type Page } from '@playwright/test';
import {
  cleanDatabase,
  registerUser,
  generateTestEmail,
  generateTestUsername,
} from '../helpers';

type TestUser = {
  username: string;
  email: string;
  password: string;
};

type PriceCompareFixtures = {
  cleanDb: void;
  authenticatedUser: TestUser;
  authenticatedPage: Page;
  adminUser: TestUser;
  adminPage: Page;
};

const DEFAULT_USER_PASSWORD = 'Password123!';
const DEFAULT_ADMIN_PASSWORD = 'AdminPass123!';

export const test = base.extend<PriceCompareFixtures>({
  cleanDb: [
    async ({ page }, use) => {
      void page;
      await cleanDatabase();
      await use();
    },
    { scope: 'test', auto: true },
  ],

  authenticatedUser: async ({ page }, use) => {
    const username = generateTestUsername('e2e');
    const email = generateTestEmail('e2e');

    await registerUser(page, username, email, DEFAULT_USER_PASSWORD);

    await use({ username, email, password: DEFAULT_USER_PASSWORD });
  },

  authenticatedPage: async ({ page, authenticatedUser }, use) => {
    void authenticatedUser;
    await use(page);
  },

  adminUser: async ({ page }, use) => {
    const username = 'admin';
    const email = 'admin@pricecompare.com';

    await registerUser(page, username, email, DEFAULT_ADMIN_PASSWORD);

    await use({ username, email, password: DEFAULT_ADMIN_PASSWORD });
  },

  adminPage: async ({ page, adminUser }, use) => {
    void adminUser;
    await use(page);
  },
});

export { expect };
export type { TestUser };
