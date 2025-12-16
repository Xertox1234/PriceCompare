# PR Checklist: A11y smoke checks + fixtures + CI sharding

**Date**: 2025-12-15
**Branch**: `add_scraping`

## Scope

- Accessibility smoke checks (Axe + Playwright)
- Opt-in E2E fixtures (`cleanDb`)
- CI job-level sharding (`--shard`, `--workers=1`)
- A11y/UI fixes for icon-only controls

## ✅ Pre-Merge Verification

### Static checks

```bash
npm run type-check
npm run lint
```

### Targeted E2E

```bash
npm run test:e2e -- e2e/accessibility.spec.ts
npm run test:e2e -- e2e/price-analytics.spec.ts
```

### Optional (CI-style shard repro)

```bash
npx playwright test --shard=1/4 --workers=1
```

## Review Pointers

- Accessibility suite: `e2e/accessibility.spec.ts`
- Fixtures: `e2e/fixtures/index.ts`, `e2e/fixtures.ts`
- CI workflow: `.github/workflows/e2e-tests.yml`
- Docs: `docs/E2E_TEST_EXPANSION_PLAN.md`, `docs/08_TESTING_PATTERNS.md`, `e2e/README.md`

## Notes

- `npm run lint` may emit a `@typescript-eslint` TypeScript-version support warning; lint still passes.
