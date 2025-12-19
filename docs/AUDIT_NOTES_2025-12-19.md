# Audit Notes (2025-12-19)

## Scope

This note documents intentional test-environment behavior and a couple of small consistency fixes applied while auditing recent E2E-enablement changes.

## Intentional `NODE_ENV=test` behavior

To keep Playwright/Vitest runs deterministic (fresh data after seeding) and avoid cross-test interference, we intentionally bypass:

- **Response caching**
  - `server/middleware/redis-cache.ts`: skips caching middleware entirely in `NODE_ENV=test`.
  - `server/services/storage-cache.ts`: bypasses `storageCache.getOrSet()` and executes the underlying fetch function directly in `NODE_ENV=test`.

- **Account lockout side-effects**
  - `server/auth.ts`: disables account lockout checks and avoids recording failed login attempts in `NODE_ENV=test`.

These are test-only gates; production behavior is unchanged.

## Consistency fixes from audit

- `server/index.ts`: clarified the comment about Sentry being initialized first **after env loading**.
- `shared/schema.ts`: added a Drizzle `unique()` constraint for `watch_lists.public_share_token` to match the migration constraint `watch_lists_public_share_token_unique`.
