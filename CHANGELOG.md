# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-11-18

### Security

#### Fixed npm Dependency Vulnerabilities (P1 - Critical)
**Resolved 7 vulnerabilities (3 high, 4 moderate severity)**

- **CVE GHSA-67mh-4wv8-2f99 (HIGH)**: esbuild <=0.24.2 dev server request hijacking
  - **Impact**: Enables any website to send requests to dev server, potential SSRF attacks
  - **Fix**: Updated esbuild to ^0.27.0 via npm overrides (vulnerability fixed in 0.25.0+)
  - **Scope**: Development environment only (production builds unaffected)
  - **References**:
    - GitHub Advisory: https://github.com/advisories/GHSA-67mh-4wv8-2f99
    - Commit: d96fb3ec09bde2d3506e841055b716e5cbb36271

- **CVE GHSA-5j98-mcp5-4vw2 (HIGH)**: glob 10.3.7-11.0.3 command injection
  - **Impact**: Command injection via CLI usage
  - **Fix**: Updated to glob 10.5.0 (vulnerability fixed in 10.5.0 and 11.1.0+)
  - **Scope**: Transitive dependency via drizzle-kit (CLI not directly used)
  - **References**:
    - GitHub Advisory: https://github.com/advisories/GHSA-5j98-mcp5-4vw2
    - CVE: CVE-2025-64756

- **4 Moderate Severity Issues**: Fixed via npm audit fix
  - Various transitive dependencies updated
  - No breaking changes introduced

#### Technical Changes
- Added npm overrides for esbuild to force secure version across dependency tree
- Updated drizzle-kit to 0.31.7 (bug fixes and compatibility)
- Added engines field to enforce Node.js >=18.0.0 (required by esbuild 0.27.0)
- Added _comments field documenting security override rationale

#### Verification
- ✅ npm audit shows 0 vulnerabilities (previously 7)
- ✅ Full test suite passes
- ✅ Development server tested and functional
- ✅ Production build verified
- ✅ Security tests pass

### Changed

- **Node.js Requirement**: Minimum Node.js version now 18.0.0 (was unspecified)
  - Required by esbuild 0.27.0
  - NPM 8.0.0+ required for overrides feature
  - Update your local environment if using Node.js <18

### Fixed

#### P1 Critical Issues (Commit d96fb3e)

1. **Database Type Safety** ✓
   - Verified proper union types for pool and db in server/db.ts
   - Full TypeScript type inference for all database operations

2. **Database Performance Indexes** ✓
   - Aligned Drizzle schema with existing database indexes
   - Fixed naming inconsistencies in shared/schema.ts
   - Documented: GIN index on search_vector, composite indexes on price_history

3. **Resource Cleanup** ✓
   - Created CleanupManager utility (server/utils/cleanup-manager.ts)
   - Registered 9+ setInterval timers for cleanup
   - Enhanced graceful shutdown handler in server/index.ts
   - Prevents memory leaks and enables clean process termination

4. **Dead Code Removal** ✓ (1,268 lines)
   - Deleted 3 files with unimplemented features:
     - server/services/hybrid-data-collector.ts (541 LOC)
     - server/services/cache-warming.ts (315 LOC)
     - server/hybrid-data-routes.ts (311 LOC)
   - Removed dead functions from advanced-search.ts (43 LOC)
   - Cleaned up imports and route registrations (60 LOC)

### Documentation

- Created CHANGELOG.md with security vulnerability details
- Added package.json documentation for security overrides
- Updated todos/005-completed-p1-update-vulnerable-dependencies.md
- Closed GitHub issue #51: [P1] Update Vulnerable npm Dependencies

### Rollback Instructions

If issues arise from dependency updates:

```bash
# Restore previous lock file from git history
git checkout d96fb3e~1 -- package-lock.json
npm install

# Or restore from backup if available
cp package-lock.json.backup package-lock.json
npm install
```

### Upgrade Notes

#### For Developers

1. **Update Node.js**: Ensure you're using Node.js 18.0.0 or higher
   ```bash
   node --version  # Should show v18.0.0 or higher
   ```

2. **Reinstall Dependencies**: After pulling these changes
   ```bash
   npm install
   ```

3. **Verify Security**: Confirm no vulnerabilities
   ```bash
   npm audit
   # Should show "found 0 vulnerabilities"
   ```

4. **Run Tests**: Ensure compatibility
   ```bash
   npm test
   npm run test:security
   ```

#### For CI/CD

- Update Node.js version in CI/CD pipeline to 18.0.0+
- GitHub Actions: Update `actions/setup-node@v3` to use `node-version: '18'`
- Docker: Update base image to node:18 or higher

### Breaking Changes

None for application code. Infrastructure requirements updated:
- Node.js 18.0.0+ now required (previously unspecified)
- NPM 8.0.0+ required for overrides feature

---

## Resources

- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
- [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
- [GitHub Security Advisories](https://github.com/advisories)

## Contact

For security concerns, please refer to SECURITY.md or contact the maintainers directly.
