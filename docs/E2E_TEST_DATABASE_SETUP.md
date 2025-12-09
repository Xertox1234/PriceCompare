# E2E Test Database Setup Guide

**Version:** 1.0
**Last Updated:** 2025-12-08
**Purpose:** Complete guide for setting up the E2E test database for PriceCompare

---

## Overview

End-to-end (E2E) tests require a separate PostgreSQL database to avoid polluting development or production data. This guide walks you through setting up `pricecompare_test_e2e` database with smart defaults that work across different platforms.

**Key Features:**
- ✅ Smart defaults work without configuration for most developers
- ✅ Platform-aware (macOS, Linux, Windows)
- ✅ Uses your system username by default
- ✅ Optional `.env.test` configuration for custom setups
- ✅ Real database tests (not mocks) for high confidence

---

## Quick Start (TL;DR)

For most developers, these 3 commands are all you need:

```bash
# 1. Create test database
createdb pricecompare_test_e2e

# 2. Run migrations
DATABASE_NAME=pricecompare_test_e2e npm run db:push

# 3. Verify setup
npm run test:e2e
```

If this works, you're done! If not, see [Detailed Setup](#detailed-setup) below.

---

## Detailed Setup

### Step 1: Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
- Download installer from https://www.postgresql.org/download/windows/
- Run installer and follow prompts
- Start PostgreSQL service from Services app

**Docker:**
```bash
docker run --name pricecompare-test-db \
  -e POSTGRES_PASSWORD=test123 \
  -e POSTGRES_DB=pricecompare_test_e2e \
  -p 5432:5432 \
  -d postgres:16
```

---

### Step 2: Create Test Database

**Method 1: Using createdb (Recommended)**
```bash
createdb pricecompare_test_e2e
```

**Method 2: Using psql**
```bash
psql -c "CREATE DATABASE pricecompare_test_e2e;"
```

**Method 3: Using PostgreSQL GUI (pgAdmin, Postico, etc.)**
- Connect to local PostgreSQL server
- Right-click "Databases" → "Create" → "Database..."
- Name: `pricecompare_test_e2e`
- Owner: Your username
- Click "Save"

**Verify Database Created:**
```bash
psql -l | grep pricecompare_test_e2e
# Should show: pricecompare_test_e2e | your_username | UTF8 | ...
```

---

### Step 3: Run Database Migrations

The test database needs the same schema as your development database.

**Option 1: Using db:push (Development Only)**
```bash
DATABASE_NAME=pricecompare_test_e2e npm run db:push
```

**Option 2: Using Migrations (Production-Ready)**
```bash
DATABASE_NAME=pricecompare_test_e2e npm run migrate
```

**Verify Migrations:**
```bash
psql pricecompare_test_e2e -c "\dt"
```
You should see tables: `users`, `products`, `retailers`, `price_history`, etc.

---

### Step 4: Configure Environment (Optional)

The test setup uses smart defaults from `server/test/setup.ts`:

**Default Connection Values:**
```
User:     process.env.USER (your system username)
Password: (empty - works for trust/peer authentication)
Host:     localhost
Port:     5432
Database: pricecompare_test_e2e
```

**Only create `.env.test` if defaults don't work:**

```bash
# Create .env.test file
touch .env.test

# Edit with your values
nano .env.test
```

**Example `.env.test` Configuration:**
```bash
# Database Configuration
DATABASE_USER=your_username       # Default: system username
DATABASE_PASSWORD=your_password   # Default: empty
DATABASE_HOST=localhost           # Default: localhost
DATABASE_PORT=5432               # Default: 5432
DATABASE_NAME=pricecompare_test_e2e  # Required for E2E tests

# Test-Mode Security (these work by default - no need to change)
NODE_ENV=test
ENCRYPTION_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
SESSION_SECRET=test-session-secret-min-32-chars-long
CSRF_SECRET=test-csrf-secret-min-32-chars

# Optional: Redis (if testing with Redis)
# REDIS_URL=redis://localhost:6379
```

**Notes:**
- `ENCRYPTION_KEY`: 64 'a' characters - triggers no-op encryption in test mode
- `SESSION_SECRET`/`CSRF_SECRET`: Test-only values, not used in production
- `NODE_ENV=test`: Disables encryption for faster tests (no real PII in tests)

---

### Step 5: Verify Setup

**Run Existing E2E Tests:**
```bash
npm run test:e2e
```

**Expected Output:**
```
 ✓ e2e/auth.spec.ts (3)
   ✓ User registration flow (1234ms)
   ✓ User login flow (567ms)
   ✓ Password reset flow (890ms)
 ✓ e2e/price-alerts.spec.ts (2)
   ✓ Create price alert (456ms)
   ✓ Receive alert notification (789ms)
 ✓ e2e/product-discovery.spec.ts (2)
   ✓ Search for products (345ms)
   ✓ View product details (678ms)

 Test Files  3 passed (3)
      Tests  7 passed (7)
   Duration  4.13s
```

**If tests pass:** ✅ Setup complete!
**If tests fail:** See [Troubleshooting](#troubleshooting) below.

---

## Environment Variable Priority

The test setup tries multiple connection methods in this order:

1. **`DATABASE_URL`** (if explicitly set)
   ```bash
   DATABASE_URL=postgresql://user:pass@host:5432/pricecompare_test_e2e
   ```

2. **Individual `DATABASE_*` variables** (if set in `.env.test`)
   ```bash
   DATABASE_USER=myuser
   DATABASE_PASSWORD=mypass
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_NAME=pricecompare_test_e2e
   ```

3. **System defaults** (fallback)
   ```javascript
   {
     user: process.env.USER,  // System username
     password: '',            // Empty (trust authentication)
     host: 'localhost',
     port: 5432,
     database: 'pricecompare_test_e2e'
   }
   ```

---

## Troubleshooting

### Error: "database 'pricecompare_test_e2e' does not exist"

**Cause:** Database not created
**Solution:**
```bash
createdb pricecompare_test_e2e
```

**Verify:**
```bash
psql -l | grep pricecompare_test_e2e
```

---

### Error: "role 'postgres' does not exist"

**Cause:** Hardcoded username doesn't match your PostgreSQL user
**Solution:** Create `.env.test` and set your actual username:

```bash
# Find your username
whoami  # macOS/Linux
echo %USERNAME%  # Windows

# Add to .env.test
DATABASE_USER=your_actual_username
```

---

### Error: "password authentication failed"

**Cause:** PostgreSQL requires password but none provided

**Solution 1:** Set password in `.env.test`:
```bash
DATABASE_PASSWORD=your_password
```

**Solution 2:** Configure PostgreSQL to trust local connections:

**macOS (Homebrew):**
```bash
# Edit pg_hba.conf
code /opt/homebrew/var/postgresql@16/pg_hba.conf

# Change this line:
# local   all   all   md5
# To:
local   all   all   trust

# Restart PostgreSQL
brew services restart postgresql
```

**Linux:**
```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Change this line:
# local   all   all   peer
# To:
local   all   all   trust

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

### Error: "connection refused" or "could not connect to server"

**Cause:** PostgreSQL not running

**Solution:**

**macOS:**
```bash
brew services start postgresql
```

**Linux:**
```bash
sudo systemctl start postgresql
sudo systemctl status postgresql  # Verify running
```

**Windows:**
- Open Services app
- Find "PostgreSQL" service
- Click "Start"

**Docker:**
```bash
docker start pricecompare-test-db
docker ps | grep pricecompare-test-db  # Verify running
```

---

### Error: "permission denied for schema public"

**Cause:** User lacks schema permissions
**Solution:** Grant permissions:

```sql
-- Connect as superuser
psql pricecompare_test_e2e

-- Grant permissions
GRANT ALL ON SCHEMA public TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_username;

-- Exit
\q
```

---

### Error: "relation 'users' does not exist"

**Cause:** Migrations not run
**Solution:**
```bash
DATABASE_NAME=pricecompare_test_e2e npm run db:push
```

**Verify tables exist:**
```bash
psql pricecompare_test_e2e -c "\dt"
```

---

### Tests Fail with "TRUNCATE CASCADE" Errors

**Cause:** Foreign key constraints or insufficient permissions
**Solution:**

1. **Check permissions:**
   ```sql
   psql pricecompare_test_e2e
   \du  -- List users and roles
   GRANT ALL PRIVILEGES ON DATABASE pricecompare_test_e2e TO your_username;
   ```

2. **Verify CASCADE works:**
   ```sql
   TRUNCATE TABLE users CASCADE;  -- Should work without errors
   ```

---

## Platform-Specific Notes

### macOS (Homebrew PostgreSQL)

**Default Configuration:**
- User: Your system username
- Password: None required (peer authentication)
- Data directory: `/opt/homebrew/var/postgresql@16/`
- Config file: `/opt/homebrew/var/postgresql@16/postgresql.conf`
- HBA file: `/opt/homebrew/var/postgresql@16/pg_hba.conf`

**Common Commands:**
```bash
brew services start postgresql  # Start server
brew services stop postgresql   # Stop server
brew services restart postgresql  # Restart server
psql postgres  # Connect to default database
```

---

### Linux (Ubuntu/Debian)

**Default Configuration:**
- User: `postgres` (superuser) or your system username
- Password: May be required depending on `pg_hba.conf`
- Data directory: `/var/lib/postgresql/16/main/`
- Config file: `/etc/postgresql/16/main/postgresql.conf`
- HBA file: `/etc/postgresql/16/main/pg_hba.conf`

**Common Commands:**
```bash
sudo systemctl start postgresql  # Start server
sudo systemctl stop postgresql   # Stop server
sudo systemctl status postgresql # Check status
sudo -u postgres psql  # Connect as postgres user
```

**Create User (if needed):**
```bash
sudo -u postgres createuser --superuser $USER
```

---

### Windows

**Default Configuration:**
- User: `postgres` (set during installation)
- Password: Set during installation
- Data directory: `C:\Program Files\PostgreSQL\16\data\`
- Config file: `C:\Program Files\PostgreSQL\16\data\postgresql.conf`
- HBA file: `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`

**Common Commands (PowerShell):**
```powershell
# Start service
Start-Service postgresql-x64-16

# Stop service
Stop-Service postgresql-x64-16

# Connect
psql -U postgres
```

**Set Up Test User:**
```sql
CREATE USER your_username WITH PASSWORD 'your_password';
ALTER USER your_username CREATEDB;
```

---

### Docker

**Docker Compose Setup** (`docker-compose.test.yml`):
```yaml
version: '3.8'
services:
  postgres-test:
    image: postgres:16
    container_name: pricecompare-test-db
    environment:
      POSTGRES_USER: testuser
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: pricecompare_test_e2e
    ports:
      - "5433:5432"  # Use 5433 to avoid conflict with local PostgreSQL
    volumes:
      - test-db-data:/var/lib/postgresql/data

volumes:
  test-db-data:
```

**Start Test Database:**
```bash
docker-compose -f docker-compose.test.yml up -d
```

**Configure `.env.test` for Docker:**
```bash
DATABASE_USER=testuser
DATABASE_PASSWORD=testpass
DATABASE_HOST=localhost
DATABASE_PORT=5433  # Different port!
DATABASE_NAME=pricecompare_test_e2e
```

---

## Database Cleanup Between Tests

E2E tests automatically clean the database using helpers in `e2e/helpers.ts`:

**Automatic Cleanup (Already Implemented):**
```typescript
import { cleanDatabase } from './helpers';

test.beforeAll(async ({ page }) => {
  await cleanDatabase(page);  // Truncates all tables with CASCADE
});
```

**Manual Cleanup (if needed):**
```bash
# Connect to test database
psql pricecompare_test_e2e

# Truncate all tables
TRUNCATE TABLE
  users,
  products,
  retailers,
  product_offers,
  price_history,
  price_alerts,
  watch_lists,
  product_watches
CASCADE;
```

**Why TRUNCATE CASCADE?**
- Faster than DELETE (doesn't generate WAL logs)
- Resets sequence counters (IDs start from 1)
- Handles foreign key constraints automatically

---

## Test Data Management

### Test Fixtures

The project uses factory functions for test data:

```typescript
// From server/__tests__/helpers/test-fixtures.ts
import {
  createTestUser,
  createTestProduct,
  createTestRetailer,
  createTestPriceHistory
} from '../../server/__tests__/helpers/test-fixtures';

// Create test data
const user = await createTestUser({ username: 'testuser' });
const retailer = await createTestRetailer({ name: 'Test Store' });
const product = await createTestProduct({
  name: 'Test Product',
  category: 'Electronics'
});
```

### E2E Test Helpers

E2E tests have high-level helpers:

```typescript
// From e2e/helpers.ts
import {
  registerUser,
  loginUser,
  generateTestEmail,
  generateTestUsername
} from './helpers';

// Register and login
const email = generateTestEmail();
const username = generateTestUsername();
await registerUser(page, { username, email, password: 'Test123!' });
await loginUser(page, { email, password: 'Test123!' });
```

---

## Security Considerations

### Test Database Security

**1. Separate Database:**
- ✅ Test database isolated from development/production
- ✅ No risk of data corruption or leaks

**2. Test-Mode Encryption:**
```typescript
// In shared/schema.ts
const isTestMode = process.env.NODE_ENV === 'test';

// Email encryption disabled in test mode
email: text('email').notNull().$defaultFn(() => {
  if (isTestMode) return email;  // No-op in tests
  return encrypt(email);  // Encrypt in production
});
```

**Why disable encryption in tests?**
- Test data is ephemeral (deleted after each run)
- No real PII in test data
- Faster test execution (no encryption overhead)
- Production encryption still active (`NODE_ENV !== 'test'`)

**3. Test Secrets (Already Configured):**
```bash
# These are ONLY for tests - never use in production!
ENCRYPTION_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
SESSION_SECRET=test-session-secret-min-32-chars-long
CSRF_SECRET=test-csrf-secret-min-32-chars
```

---

## Performance Optimization

### Parallel Test Execution

**Playwright Config** (`playwright.config.ts`):
```typescript
export default defineConfig({
  workers: 1,  // Single worker prevents database race conditions
  fullyParallel: false,  // Sequential test execution
});
```

**Why single worker?**
- Prevents concurrent database writes
- Avoids deadlocks and race conditions
- Ensures test isolation

**For faster tests (if safe):**
- Use separate databases per worker
- Or implement database locking per test file

### Test Database Size

**Keep test database small:**
- Only create data needed for specific test
- Clean up after each test suite
- Don't accumulate test data over time

**Monitor database size:**
```bash
psql pricecompare_test_e2e -c "
  SELECT
    pg_size_pretty(pg_database_size('pricecompare_test_e2e')) as size;
"
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: pricecompare_test_e2e
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/pricecompare_test_e2e
        run: npm run migrate

      - name: Run E2E tests
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/pricecompare_test_e2e
        run: npm run test:e2e

      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-screenshots
          path: test-results/
```

---

## Additional Resources

### Useful Commands

**Database Information:**
```bash
# List all databases
psql -l

# List tables in database
psql pricecompare_test_e2e -c "\dt"

# Show table schema
psql pricecompare_test_e2e -c "\d users"

# Count rows in table
psql pricecompare_test_e2e -c "SELECT COUNT(*) FROM users;"

# Check database size
psql pricecompare_test_e2e -c "
  SELECT pg_size_pretty(pg_database_size('pricecompare_test_e2e'));
"
```

**Connection Testing:**
```bash
# Test connection with psql
psql -h localhost -U $USER -d pricecompare_test_e2e -c "SELECT 1;"

# Test connection with Node.js
node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ database: 'pricecompare_test_e2e' });
  pool.query('SELECT NOW()').then(res => console.log(res.rows));
"
```

### Related Documentation

- [Testing Patterns Guide](./08_TESTING_PATTERNS.md) - Complete testing patterns
- [User Stories](./USER_STORIES.md) - All 60 user stories for E2E tests
- [E2E Testing Guide](./E2E_TESTING_GUIDE.md) - How to write and run E2E tests
- [Playwright Documentation](https://playwright.dev/) - Official Playwright docs
- [PostgreSQL Documentation](https://www.postgresql.org/docs/16/) - Official PostgreSQL docs

---

## Summary

**Quick Setup (Most Developers):**
1. `createdb pricecompare_test_e2e`
2. `DATABASE_NAME=pricecompare_test_e2e npm run db:push`
3. `npm run test:e2e`

**Custom Setup:**
1. Create database
2. Create `.env.test` with your connection details
3. Run migrations
4. Verify with E2E tests

**Key Takeaways:**
- ✅ Smart defaults work without configuration
- ✅ Separate test database prevents data pollution
- ✅ Test-mode encryption disabled for performance
- ✅ TRUNCATE CASCADE ensures clean tests
- ✅ Platform-specific notes for macOS/Linux/Windows/Docker

**Need Help?**
- Check [Troubleshooting](#troubleshooting) section
- Review [Platform-Specific Notes](#platform-specific-notes)
- See existing test patterns in `e2e/helpers.ts`
- Refer to `server/test/setup.ts` for connection logic

---

**Last Updated:** 2025-12-08
**Maintainers:** PriceCompare Team
