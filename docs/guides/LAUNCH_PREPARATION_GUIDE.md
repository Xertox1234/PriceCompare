# PriceCompare Launch Preparation Guide

This guide covers all preparation steps needed before launching PriceCompare to production. It focuses on business readiness, third-party service configuration, and launch validation.

**For infrastructure deployment details**, see [PRODUCTION_DEPLOYMENT_GUIDE.md](../deployment/PRODUCTION_DEPLOYMENT_GUIDE.md).

---

## Table of Contents

1. [Required Third-Party Services](#required-third-party-services)
2. [Pre-Launch Validation Checklist](#pre-launch-validation-checklist)
3. [Launch Day Checklist](#launch-day-checklist)
4. [Post-Launch Monitoring](#post-launch-monitoring)
5. [Common Launch Issues](#common-launch-issues)
6. [Cross-References](#cross-references)

---

## Required Third-Party Services

### CRITICAL - Required in ALL Environments

These services are **mandatory** in all environments. The application validates these on startup.

#### SESSION_SECRET
**Purpose:** Encrypts Express session cookies
**Requirements:** Minimum 32 characters, cryptographically random
**Generation:**
```bash
openssl rand -base64 32
```
**Example:** `hvP8K3jN2mQ9rL4sT6vX1yZ5cB7dF9gH2jK4lM6nP8qR0sT2vU4wX6yZ8aB1cD3e`

#### CSRF_SECRET
**Purpose:** Generates CSRF tokens for request validation
**Requirements:** Minimum 32 characters, cryptographically random
**Generation:**
```bash
openssl rand -base64 32
```
**Example:** `aB1cD3eF5gH7jK9lM2nP4qR6sT8vU0wX2yZ4aB6cD8eF0gH2jK4lM6nP8qR0sT2v`

#### ENCRYPTION_KEY
**Purpose:** AES-256 encryption for PII data at rest (emails, IP addresses)
**Requirements:** Exactly 64 hexadecimal characters (32 bytes)
**Generation:**
```bash
openssl rand -hex 32
```
**Example:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`

#### DISCOURSE_SSO_SECRET
**Purpose:** HMAC signing for Discourse SSO integration
**Requirements:** Minimum 32 characters, cryptographically random
**Generation:**
```bash
openssl rand -base64 32
```
**Example:** `cD3eF5gH7jK9lM2nP4qR6sT8vU0wX2yZ4aB6cD8eF0gH2jK4lM6nP8qR0sT2vU4w`

#### DATABASE_URL
**Purpose:** PostgreSQL database connection
**Format:** `postgresql://username:password@hostname:5432/database_name`
**Example:** `postgresql://pricecompare_user:secure_password@db.example.com:5432/pricecompare_prod`

**Requirements:**
- User must have full permissions on database
- Database must exist before first deployment
- SSL/TLS recommended for production
- Connection pooling configured automatically

---

### CRITICAL - Required in PRODUCTION Only

#### REDIS_URL
**Purpose:** Distributed caching, sessions, rate limiting, job locks
**Requirements:** **MANDATORY in production** - application exits on startup without this
**Format:**
- Standard: `redis://hostname:6379`
- With password: `redis://:password@hostname:6379`
- TLS: `rediss://username:password@hostname:6379`

**Recommended Providers:**
- **Upstash** (serverless, free tier available)
- **Redis Cloud** (managed Redis)
- **AWS ElastiCache** (AWS native)
- **Azure Cache for Redis** (Azure native)

**Setup Validation:**
```bash
# Test connection
redis-cli -u $REDIS_URL ping
# Expected output: PONG

# Verify persistence
redis-cli -u $REDIS_URL INFO persistence
# Check: rdb_last_save_time or aof_enabled

# Check memory limits
redis-cli -u $REDIS_URL CONFIG GET maxmemory
```

**Configuration Requirements:**
- Persistence enabled (RDB snapshots or AOF)
- Password authentication (if not using VPC security)
- Memory limits configured to match instance size
- Eviction policy: `allkeys-lru` or `volatile-lru`

---

### STRONGLY RECOMMENDED

These services are optional but strongly recommended for production use.

#### Error Monitoring (Sentry)

**SENTRY_DSN**
**Purpose:** Backend error tracking and monitoring
**Setup:**
1. Create account at [sentry.io](https://sentry.io)
2. Create new project (Node.js)
3. Copy DSN from project settings
4. Set environment variable

**Example:** `https://abc123def456@o123456.ingest.sentry.io/7891011`

**VITE_SENTRY_DSN**
**Purpose:** Frontend error tracking (can be same as backend or separate)
**Setup:** Same as backend, or create separate "React" project for frontend isolation

**SENTRY_RELEASE**
**Purpose:** Release version tracking in Sentry
**Default:** Automatically uses `package.json` version
**Override:** Set to custom release identifier (e.g., `git-commit-sha`, `v1.2.3-prod`)

**Post-Setup:**
- Configure alert thresholds in Sentry dashboard
- Set up Slack/email notifications
- Create release tracking automation
- Review error grouping and fingerprinting

#### Email Service (SMTP)

Required for password reset functionality.

**SMTP_HOST**
**Purpose:** SMTP server hostname
**Examples:**
- Gmail: `smtp.gmail.com`
- SendGrid: `smtp.sendgrid.net`
- AWS SES: `email-smtp.us-east-1.amazonaws.com`

**SMTP_PORT**
**Purpose:** SMTP server port
**Standard Values:**
- `587` - TLS/STARTTLS (recommended)
- `465` - SSL (legacy)
- `25` - Unencrypted (not recommended)

**SMTP_USERNAME**
**Purpose:** SMTP authentication username
**Gmail Note:** Use full email address as username

**SMTP_PASSWORD**
**Purpose:** SMTP authentication password
**Gmail Note:** Use App-Specific Password, not account password
1. Enable 2FA on Google account
2. Visit: https://myaccount.google.com/apppasswords
3. Generate app-specific password
4. Use generated password (16 characters, no spaces)

**SMTP_FROM_ADDRESS**
**Purpose:** "From" address for outgoing emails
**Example:** `noreply@pricecompare.com`
**Requirements:**
- Must be authorized sender on SMTP provider
- Should be no-reply or support address

**APP_URL**
**Purpose:** Base URL for password reset links
**Example:** `https://pricecompare.com`
**Requirements:** Full URL with protocol, no trailing slash

**Email Deliverability Setup:**
```bash
# SPF Record (DNS TXT)
v=spf1 include:_spf.google.com ~all

# DKIM (configure through email provider)
# DMARC Record (DNS TXT)
v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

**Testing:**
1. Configure all SMTP variables
2. Restart application
3. Test password reset flow
4. Check spam folder if not received
5. Verify email template rendering

---

### OPTIONAL - Feature Enhancement

These services enable additional features but are not required for core functionality.

#### AI Features (OpenAI)

**OPENAI_API_KEY**
**Purpose:** AI-powered product discovery and smart search
**Setup:**
1. Create account at [platform.openai.com](https://platform.openai.com)
2. Add payment method
3. Generate API key
4. Set rate limits and spending caps

**Features Enabled:**
- AI product discovery agents
- Smart search with natural language
- Product recommendations

**Cost Management:**
- Set monthly spending limits in OpenAI dashboard
- Monitor token usage via API
- Consider caching AI responses

#### Google Search Integration

**GOOGLE_CUSTOM_SEARCH_API_KEY**
**Purpose:** Google Custom Search API access
**Setup:**
1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Enable Custom Search API
3. Create API credentials
4. Copy API key

**GOOGLE_SEARCH_ENGINE_ID**
**Purpose:** Custom Search Engine identifier
**Setup:**
1. Visit [Google Programmable Search](https://programmablesearchengine.google.com)
2. Create new search engine
3. Copy Search Engine ID

#### Discourse Forum Integration

**DISCOURSE_URL**
**Example:** `https://community.pricecompare.com`

**DISCOURSE_API_KEY**
**Setup:** Generate in Discourse admin panel

**DISCOURSE_DB_PASSWORD**
**Purpose:** Direct database access (if needed)

**DISCOURSE_WEBHOOK_SECRET**
**Purpose:** Webhook signature verification
**Fallback:** Uses `DISCOURSE_SSO_SECRET` if not set

#### Slack Notifications

**SLACK_WEBHOOK_URL**
**Purpose:** Send alerts to Slack channel
**Setup:**
1. Create Slack app or incoming webhook
2. Copy webhook URL
3. Configure alert routing

**Note:** Alerts still appear in dashboard/logs without Slack

#### Affiliate Program Configuration

See [AFFILIATE_REQUIREMENTS.md](../api/AFFILIATE_REQUIREMENTS.md) for complete affiliate setup.

**AMAZON_ASSOCIATE_TAG**
**Format:** `your-tag-20`

**WALMART_PUBLISHER_ID**
**Source:** Impact Radius dashboard

**TARGET_CAMPAIGN_ID**
**Source:** Impact Radius dashboard

**BESTBUY_OFFER_ID**
**Source:** Best Buy affiliate portal

**AFFILIATE_SOURCE**
**Purpose:** Generic tracking identifier
**Default:** `pricecompare`

---

### OPTIONAL - Performance Tuning

**L1_CACHE_SIZE**
**Purpose:** In-memory cache item limit
**Default:** `2500`
**Range:** `1000-5000`
**Recommendation:** Start with default, increase if high cache hit rate

**L1_CACHE_TTL**
**Purpose:** Cache time-to-live in seconds
**Default:** `60`
**Range:** `30-120`
**Recommendation:** Start with default, adjust based on data freshness needs

**CSP_ENFORCE**
**Purpose:** Content Security Policy enforcement
**Values:** `true` (enforce) | `false` (report-only)
**Recommendation:**
1. Start with `false` in production
2. Monitor CSP reports for 24-48 hours
3. Fix any violations
4. Set to `true` to enforce

---

## Pre-Launch Validation Checklist

### 1. Environment Configuration

**Validate Required Environment Variables:**
```bash
# All CRITICAL variables must be set
[ -z "$SESSION_SECRET" ] && echo "ERROR: SESSION_SECRET missing"
[ -z "$CSRF_SECRET" ] && echo "ERROR: CSRF_SECRET missing"
[ -z "$ENCRYPTION_KEY" ] && echo "ERROR: ENCRYPTION_KEY missing"
[ -z "$DISCOURSE_SSO_SECRET" ] && echo "ERROR: DISCOURSE_SSO_SECRET missing"
[ -z "$DATABASE_URL" ] && echo "ERROR: DATABASE_URL missing"

# Production-only validation
if [ "$NODE_ENV" = "production" ]; then
  [ -z "$REDIS_URL" ] && echo "ERROR: REDIS_URL required in production"
fi
```

**Validate Secret Strength:**
```bash
# Secrets must be at least 32 characters
echo $SESSION_SECRET | awk '{if(length<32) print "ERROR: SESSION_SECRET too short"; else print "OK"}'
echo $CSRF_SECRET | awk '{if(length<32) print "ERROR: CSRF_SECRET too short"; else print "OK"}'

# ENCRYPTION_KEY must be exactly 64 hex characters
echo $ENCRYPTION_KEY | awk '{if(length!=64) print "ERROR: ENCRYPTION_KEY must be 64 chars"; else print "OK"}'
```

### 2. Database Validation

**Apply Migrations:**
```bash
npm run migrate
```

**Verify Schema-Migration Alignment (P0 CRITICAL):**
```bash
npm run validate:schema
```
This is critical to prevent runtime errors from schema/migration mismatches. See `docs/learnings/database/LEARNINGS_SCHEMA_MIGRATION_MISMATCH_PREVENTION.md` for details.

**Verify Foreign Key Cascade Rules:**
```bash
npm run validate:fk-cascades
```

**Checklist:**
- [ ] All migrations applied successfully
- [ ] Schema validation passes
- [ ] Foreign key cascades validated
- [ ] `job_locks` table exists (required for distributed jobs)
- [ ] Test database connection from production environment
- [ ] Database backups configured and tested

**Test Database Connection:**
```bash
psql $DATABASE_URL -c "SELECT version();"
```

### 3. Redis Validation

**Test Connection:**
```bash
redis-cli -u $REDIS_URL ping
# Expected: PONG
```

**Verify Persistence:**
```bash
redis-cli -u $REDIS_URL INFO persistence | grep -E "rdb_last_save_time|aof_enabled"
# At least one should be enabled
```

**Test Cache Operations:**
```bash
# Set test key
redis-cli -u $REDIS_URL SET test:key "test-value"
# Get test key
redis-cli -u $REDIS_URL GET test:key
# Expected: "test-value"
# Clean up
redis-cli -u $REDIS_URL DEL test:key
```

**Verify Memory Limits:**
```bash
redis-cli -u $REDIS_URL CONFIG GET maxmemory
# Should match your Redis instance size
```

**Test Session Storage:**
```bash
# Start application
# Create test session (login)
# Verify session persists across restarts
```

**Checklist:**
- [ ] Redis connection successful (PONG response)
- [ ] Persistence enabled (RDB or AOF)
- [ ] Memory limits configured appropriately
- [ ] Test keys can be set and retrieved
- [ ] Sessions persist correctly

### 4. Health Check Endpoints

**Basic Infrastructure Health:**
```bash
curl https://your-domain.com/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-02T12:00:00.000Z",
  "uptime": 3600
}
```

**Detailed Component Health:**
```bash
curl https://your-domain.com/api/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "components": {
    "database": "ok",
    "redis_cache": "ok",
    "redis_sessions": "ok"
  }
}
```

**Checklist:**
- [ ] `/health` returns 200 OK
- [ ] `/api/health` returns 200 OK
- [ ] All components show "ok" status
- [ ] Response times < 500ms

### 5. Security Validation

**HTTPS Configuration:**
- [ ] HTTPS enabled and enforced
- [ ] SSL certificate valid (not expired, correct domain)
- [ ] HTTP redirects to HTTPS
- [ ] Secure cookies enabled (`secure: true` in session config)

**CSRF Protection:**
```bash
# Test CSRF protection on POST endpoint
curl -X POST https://your-domain.com/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'
# Expected: 403 Forbidden (missing CSRF token)

# With CSRF token (from cookies)
curl -X POST https://your-domain.com/api/products \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token-from-cookie>" \
  -d '{"name":"Test"}'
# Expected: 401 Unauthorized or 201 Created (depending on auth)
```

**Rate Limiting:**
```bash
# Test rate limiting with burst requests
for i in {1..60}; do curl https://your-domain.com/api/products; done
# Should eventually return 429 Too Many Requests
```

**Password Hash Protection:**
```bash
# Verify password hashes never exposed
curl https://your-domain.com/api/users/me
# Response should NOT include passwordHash field
```

**PII Encryption:**
```bash
# Verify email and IP addresses encrypted in database
psql $DATABASE_URL -c "SELECT email, last_login_ip FROM users LIMIT 1;"
# Values should be encrypted strings, not plaintext
```

**Checklist:**
- [ ] HTTPS enforced
- [ ] SSL certificate valid
- [ ] Secure cookies enabled
- [ ] CSRF protection functional
- [ ] Rate limiting operational
- [ ] Password hashes never exposed in API responses
- [ ] PII data encrypted at rest

### 6. Email Service Testing

**If SMTP configured:**

**Test SMTP Connection:**
```bash
# Using openssl
openssl s_client -connect $SMTP_HOST:587 -starttls smtp
# Should connect successfully
```

**Test Password Reset Flow:**
1. Navigate to password reset page
2. Enter email address
3. Submit form
4. Check email inbox (and spam folder)
5. Verify email received within 2 minutes
6. Verify email template renders correctly
7. Click reset link
8. Verify link works and loads reset form

**DNS Configuration (if using custom domain):**
```bash
# Check SPF record
dig TXT yourdomain.com | grep spf
# Should include your email provider's SPF

# Check DMARC record
dig TXT _dmarc.yourdomain.com
# Should return DMARC policy
```

**Checklist:**
- [ ] SMTP credentials validated
- [ ] Password reset email delivers successfully
- [ ] Email appears in inbox (not spam)
- [ ] Email template renders correctly
- [ ] Reset link works and loads form
- [ ] SPF/DKIM/DMARC configured (if custom domain)

### 7. Affiliate Link Testing

See [AFFILIATE_REQUIREMENTS.md](../api/AFFILIATE_REQUIREMENTS.md) for complete affiliate validation.

**Quick Validation:**
```bash
# Test affiliate link health
curl -X POST https://your-domain.com/api/affiliate/health-check
# Expected: All retailers return "ok" status
```

**Checklist:**
- [ ] All affiliate accounts approved and active
- [ ] Affiliate links generate with correct tracking parameters
- [ ] Health check endpoint returns 200 for all retailers
- [ ] Retailer dashboards accessible
- [ ] Environment variables set correctly

### 8. AI Features Testing

**If OPENAI_API_KEY configured:**

**Test API Key:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
# Should return list of available models
```

**Test Product Discovery:**
1. Navigate to product discovery page
2. Enter search query
3. Verify AI suggestions appear
4. Check response time < 3 seconds

**Monitor Usage:**
- Check OpenAI dashboard for API calls
- Verify rate limits not exceeded
- Monitor token usage and costs

**Checklist:**
- [ ] API key validated
- [ ] Product discovery functional
- [ ] Smart search working
- [ ] Response times acceptable
- [ ] Rate limits and costs monitored

### 9. Error Monitoring Setup

**If Sentry configured:**

**Test Sentry Connection:**
```bash
# Trigger test error
curl https://your-domain.com/api/test-error
# Check Sentry dashboard for error
```

**Configure Alerts:**
1. Login to Sentry dashboard
2. Set alert thresholds (e.g., >10 errors in 5 minutes)
3. Configure notification channels (Slack, email)
4. Test alert delivery

**Verify Release Tracking:**
```bash
# Check Sentry shows correct release version
curl https://your-domain.com/health | jq .version
# Should match Sentry release
```

**Checklist:**
- [ ] Sentry DSN connectivity verified
- [ ] Test error appears in Sentry
- [ ] Alert thresholds configured
- [ ] Notifications working (Slack/email)
- [ ] Release versioning correct

### 10. Background Jobs Validation

**Verify Job Registration:**
```bash
# Check application startup logs
tail -f /var/log/app/output.log | grep "scheduler"
# Should see: Price snapshot scheduler initialized
#             Price history scheduler initialized
#             Analytics scheduler initialized
#             Smart notification processor initialized
```

**Test Job Execution:**
```bash
# Wait for next scheduled run or trigger manually
# Check job_locks table
psql $DATABASE_URL -c "SELECT * FROM job_locks;"
# Should see active locks for running jobs
```

**Verify Distributed Locking:**
```bash
# Start multiple app instances
# Only one should acquire each job lock
psql $DATABASE_URL -c "SELECT job_name, acquired_at FROM job_locks WHERE acquired_at > NOW() - INTERVAL '1 minute';"
# Should see one lock per job type
```

**Checklist:**
- [ ] Price snapshot scheduler running
- [ ] Price history jobs executing on schedule
- [ ] Analytics jobs (daily, weekly) configured
- [ ] Smart notification processor initialized
- [ ] Distributed locks preventing duplicate execution
- [ ] Job completion logged successfully

---

## Launch Day Checklist

### Pre-Launch (24 Hours Before)

**Environment Configuration:**
- [ ] All required environment variables set in production
- [ ] All optional desired services configured
- [ ] Environment variable validation passes
- [ ] Secret strength validation passes

**Data Preparation:**
- [ ] Database backup created
- [ ] Backup verified restorable
- [ ] Test data removed from production database
- [ ] Production data seeded (if applicable)

**Team Readiness:**
- [ ] Team trained on monitoring dashboards
- [ ] Rollback plan documented with specific steps
- [ ] Communication channels established (Slack, status page)
- [ ] Support rotation schedule confirmed
- [ ] Escalation paths defined

**Monitoring Setup:**
- [ ] Sentry dashboard configured
- [ ] Alert channels tested
- [ ] Response time monitoring enabled
- [ ] Error rate alerts configured

### Deployment

**Build Validation:**
```bash
# TypeScript type checking
npm run check

# ESLint validation (zero warnings tolerance)
npm run lint

# Unit and integration tests
npm test

# End-to-end tests
npm run test:e2e
```

**Production Build:**
```bash
# Build frontend (Vite) and backend (esbuild)
npm run build
```

**Database Migration:**
```bash
# Apply all pending migrations
npm run migrate

# Verify schema alignment
npm run validate:schema
```

**Application Startup:**
```bash
# Start production server
NODE_ENV=production npm run start
```

**Checklist:**
- [ ] All tests passing
- [ ] Build successful
- [ ] Migrations applied
- [ ] Application started without errors
- [ ] No warnings in startup logs

### Post-Deployment Verification

**Health Checks:**
```bash
# Basic health
curl https://your-domain.com/health

# Component health
curl https://your-domain.com/api/health
```

**Functionality Verification:**
- [ ] User registration working
- [ ] Login/logout functional
- [ ] Password reset email delivering
- [ ] Product search operational
- [ ] Affiliate links generating
- [ ] Price data displaying correctly

**Performance Baseline:**
```bash
# Test response times
time curl https://your-domain.com/api/products
# Should be < 500ms
```

**Error Monitoring:**
- [ ] Check Sentry for any immediate errors
- [ ] Verify no database connection errors
- [ ] Verify no Redis connection errors
- [ ] No unhandled promise rejections

**Infrastructure:**
- [ ] Database connections healthy
- [ ] Redis cache operational
- [ ] Redis sessions working
- [ ] Background jobs executing

**Checklist:**
- [ ] `/health` returns 200 OK
- [ ] `/api/health` all components "ok"
- [ ] Error monitoring active
- [ ] Performance baselines established (<500ms response time)
- [ ] All core features functional
- [ ] No critical errors in logs

---

## Post-Launch Monitoring

### First 24 Hours - Critical Monitoring

**Error Monitoring:**
- **Target:** <1% error rate
- **Alert Threshold:** >5% error rate
- **Monitoring Frequency:** Check Sentry dashboard every 2 hours
- **Focus Areas:**
  - Database connection errors
  - Redis connection errors
  - Unhandled promise rejections
  - Authentication failures
  - Payment processing errors (if applicable)

**Performance Monitoring:**
- **Target:** <500ms average response time
- **Alert Threshold:** >1000ms sustained for 5 minutes
- **Metrics to Track:**
  - Database query times (target: <100ms)
  - Cache hit rates (target: >80%)
  - API endpoint response times
  - Frontend load times

**Functionality Verification:**
- [ ] User registration working (test every 4 hours)
- [ ] Password reset emails delivering
- [ ] Affiliate links generating correctly
- [ ] Price data updating (background jobs running)
- [ ] Search functionality operational
- [ ] AI features working (if configured)

**Infrastructure Health:**
- [ ] Database connection pool: Monitor active connections
- [ ] Redis memory usage: Should be <80% of limit
- [ ] Application memory usage: Monitor for leaks
- [ ] CPU usage: Baseline and identify spikes
- [ ] Disk space: Monitor logs and database growth

**User Experience:**
- Monitor for user complaints or support tickets
- Check analytics for unusual patterns
- Review session duration and bounce rates
- Monitor conversion funnel completion rates

### First Week - Performance Validation

**Affiliate Link Performance:**

See [AFFILIATE_REQUIREMENTS.md](../api/AFFILIATE_REQUIREMENTS.md) for detailed affiliate monitoring.

**Quick Checklist:**
- [ ] Verify clicks tracked in retailer dashboards
- [ ] Monitor click-through rates (CTR target: 5-10%)
- [ ] Check for first conversions (timing depends on cookie duration)
- [ ] Validate commission amounts match expectations
- [ ] Review top-performing retailers and products

**Background Job Health:**
- [ ] Daily price snapshot jobs completing successfully
- [ ] Weekly analytics aggregation running on schedule
- [ ] Monthly aggregation preparation (if near month-end)
- [ ] No duplicate job execution (distributed locks working)
- [ ] Job execution times within acceptable ranges
- [ ] No job failures or timeouts

**Data Quality:**
- [ ] Price accuracy validated against retailer sites
- [ ] Product catalog completeness checked
- [ ] Search result relevance reviewed
- [ ] Analytics dashboard data accuracy verified
- [ ] User-generated content moderated

**User Experience:**
- [ ] Response times maintaining <500ms average
- [ ] Error rates staying <1%
- [ ] No widespread user complaints
- [ ] Form submissions working correctly
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility confirmed

**Performance Trends:**
- Review daily response time trends
- Monitor error rate patterns
- Analyze peak usage times
- Identify performance bottlenecks
- Plan optimizations if needed

---

## Common Launch Issues

### Health Check Fails with Database Error

**Symptoms:**
- `/api/health` returns error status
- "Database connection failed" in logs
- Application unable to start

**Checks:**
1. Verify `DATABASE_URL` correct in production environment
2. Confirm database accepts connections from production server
3. Check connection pool not exhausted
4. Verify database server is running
5. Check firewall rules allow connections

**Fixes:**
```bash
# Test connection manually
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool settings
# Increase max connections if needed (in PostgreSQL config)

# Restart application
pm2 restart app
```

### Redis Connection Errors

**Symptoms:**
- "Redis connection refused" in logs
- Session storage failing
- Cache operations failing
- Application exits on startup (production)

**Checks:**
1. Verify `REDIS_URL` format correct (`redis://` or `rediss://`)
2. Confirm Redis instance accessible from production server
3. Check Redis password correct (if applicable)
4. Verify Redis server is running
5. Check firewall rules allow connections

**Fixes:**
```bash
# Test connection
redis-cli -u $REDIS_URL ping
# Should return: PONG

# Check Redis server status
redis-cli -u $REDIS_URL INFO server

# Verify firewall rules
telnet redis-hostname 6379
```

### Background Jobs Not Running

**Symptoms:**
- Price data not updating
- Analytics not generating
- Scheduled tasks not executing

**Checks:**
1. Multiple application instances causing lock contention
2. `job_locks` table exists and migrations applied
3. Redis available for distributed locking
4. Job scheduler initialized in startup logs

**Fixes:**
```bash
# Check job locks
psql $DATABASE_URL -c "SELECT * FROM job_locks;"

# Verify job registration in logs
tail -f /var/log/app/output.log | grep "scheduler"

# Clear stuck locks (if needed)
psql $DATABASE_URL -c "DELETE FROM job_locks WHERE acquired_at < NOW() - INTERVAL '1 hour';"

# Restart application
pm2 restart app
```

### Affiliate Links Not Tracking

**Symptoms:**
- Clicks not appearing in retailer dashboards
- Affiliate links missing tracking parameters
- Commission attribution failing

**Checks:**
1. Verify affiliate config in database `retailers` table
2. Confirm environment variables for affiliate IDs set
3. Check link generation service initialized
4. Test link format manually

**Fixes:**
See [AFFILIATE_REQUIREMENTS.md - Troubleshooting](../api/AFFILIATE_REQUIREMENTS.md#troubleshooting) for complete affiliate troubleshooting guide.

```bash
# Check affiliate config
psql $DATABASE_URL -c "SELECT name, affiliate_status, affiliate_config FROM retailers WHERE affiliate_status = 'active';"

# Test link generation
curl https://your-domain.com/api/products/1/offers | jq '.offers[].affiliateUrl'

# Restart application
pm2 restart app
```

### Email Delivery Failing

**Symptoms:**
- Password reset emails not arriving
- SMTP connection errors in logs
- Email timeouts

**Checks:**
1. SMTP credentials correct
2. SMTP server allows connections from production
3. Port 587 (TLS) or 465 (SSL) open
4. Email provider not blocking IP

**Fixes:**
```bash
# Test SMTP connection
openssl s_client -connect $SMTP_HOST:587 -starttls smtp

# Check port accessibility
telnet $SMTP_HOST 587

# Verify credentials
# Try sending test email through provider's web interface

# Check provider logs/dashboard for errors
```

### High Error Rate (>5%)

**Symptoms:**
- Sentry showing spike in errors
- Users reporting issues
- Performance degradation

**Investigation:**
1. Check Sentry dashboard for error patterns
2. Review application logs for stack traces
3. Check database query performance
4. Monitor Redis connection status
5. Review recent deployments/changes

**Immediate Actions:**
```bash
# Check system resources
htop
df -h

# Review recent errors
tail -f /var/log/app/error.log

# Check database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Consider rollback if error rate critical
git revert <commit-sha>
npm run build
pm2 restart app
```

### Slow Response Times (>1000ms)

**Symptoms:**
- API responses taking >1 second
- Users reporting slow page loads
- Timeout errors

**Investigation:**
1. Check database query performance
2. Review cache hit rates
3. Monitor CPU and memory usage
4. Analyze slow query logs
5. Check for N+1 query patterns

**Optimizations:**
```bash
# Enable query logging (PostgreSQL)
psql $DATABASE_URL -c "ALTER SYSTEM SET log_min_duration_statement = 100;"
psql $DATABASE_URL -c "SELECT pg_reload_conf();"

# Review slow queries
psql $DATABASE_URL -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check cache hit rates
redis-cli -u $REDIS_URL INFO stats | grep keyspace_hits

# Increase cache TTL if needed
# Review and optimize slow queries
# Add database indexes if needed
```

---

## Cross-References

For detailed information on specific topics:

- **Infrastructure Deployment:** [PRODUCTION_DEPLOYMENT_GUIDE.md](../deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)
- **Deployment Verification:** [DEPLOYMENT_CHECKLIST.md](../deployment/DEPLOYMENT_CHECKLIST.md)
- **Affiliate Program Setup:** [AFFILIATE_REQUIREMENTS.md](../api/AFFILIATE_REQUIREMENTS.md)
- **API Testing:** [API_TESTING_CONTINUATION_PLAN.md](../api/API_TESTING_CONTINUATION_PLAN.md)
- **Quick Start Guide:** [QUICK_START_CHECKLIST.md](./QUICK_START_CHECKLIST.md)
- **Architecture Overview:** [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Security Patterns:** [04_SECURITY_PATTERNS.md](../04_SECURITY_PATTERNS.md)

---

## Additional Resources

**Project Documentation:**
- `CLAUDE.md` - Project rules and patterns
- `README.md` - Project overview and setup
- `docs/` - Complete documentation directory

**Pattern Documentation:**
- `docs/01_TYPESCRIPT_PATTERNS.md` - Type safety patterns
- `docs/02_DATABASE_PATTERNS.md` - Database best practices
- `docs/03_API_PATTERNS.md` - API development patterns
- `docs/04_SECURITY_PATTERNS.md` - Security guidelines

**Community Resources:**
- GitHub Issues: Report problems or request features
- Community Forum: Get help from other users (if Discourse configured)

---

*Last Updated: 2025-01-02*
*Version: 1.0.0*
