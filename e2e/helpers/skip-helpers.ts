/**
 * E2E Test Helpers: Standardized Skips
 */
import type { Locator } from '@playwright/test';

type SkipCapable = {
  skip: (condition?: boolean, description?: string) => void;
};

export async function skipIfMissing(
  test: SkipCapable,
  locator: Locator,
  reason: string
): Promise<boolean> {
  const count = await locator.count();
  if (count === 0) {
    test.skip(true, reason);
    return true;
  }
  return false;
}
