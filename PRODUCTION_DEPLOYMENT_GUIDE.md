# Production Deployment Guide

**Application:** PriceCompare - AI Agent Price Comparison Platform
**Date:** 2025-11-14
**Version:** 2.0 (with Distributed Locking & Monitoring)
**Status:** 🚀 PRODUCTION READY

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Redis Configuration](#redis-configuration)
6. [Application Deployment](#application-deployment)
7. [Horizontal Scaling](#horizontal-scaling)
8. [Monitoring Setup](#monitoring-setup)
9. [Health Checks](#health-checks)
10. [Backup & Recovery](#backup--recovery)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services

- **Node.js**: v18+ (recommended v22+)
- **PostgreSQL**: v14+ (for main database)
- **Redis**: v7+ (for distributed caching & locking)
- **Docker** (optional, recommended for containerized deployment)

### Required Accounts/Keys

- OpenAI API Key (for AI agents)
- Slack Webhook URL (optional, for monitoring alerts)
- SMTP Server (optional, for password reset emails)
- Google Custom Search API (for discovery agent)

### Minimum Server Requirements

**Single Instance:**

- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB SSD
- Network: 100 Mbps

**Production (3+ instances):**

- **Application Servers (each):**
  - CPU: 4 cores
  - RAM: 8 GB
  - Storage: 20 GB SSD

- **Database Server:**
  - CPU: 4 cores
  - RAM: 16 GB
  - Storage: 100 GB SSD (with backup)

- **Redis Server:**
  - CPU: 2 cores
  - RAM: 4 GB
  - Storage: 10 GB SSD

---

## Infrastructure Setup

### Option 1: Cloud Deployment (Recommended)

#### AWS Architecture

```
┌─────────────────────────────────────────────┐
│          Application Load Balancer          │
│         (Port 80/443 - HTTPS/SSL)           │
└─────────────┬───────────────────────────────┘
              │
     ┌────────┴──────────┐
     │                   │
┌────▼─────┐      ┌─────▼─────┐      ┌──────────┐
│ EC2 App  │      │ EC2 App   │ ...  │ EC2 App  │
│ Instance │      │ Instance  │      │ Instance │
│  (5000)  │      │  (5000)   │      │  (5000)  │
└────┬─────┘      └─────┬─────┘      └────┬─────┘
     │                  │                  │
     └──────────┬───────┴──────────────────┘
                │
     ┌──────────┴───────────────────┐
     │                              │
┌────▼─────────┐         ┌─────────▼────────┐
│  RDS         │         │  ElastiCache     │
│ PostgreSQL   │         │  Redis           │
│ (Primary +   │         │  (Cluster)       │
│  Replica)    │         │                  │
└──────────────┘         └──────────────────┘
```

#### AWS Services Setup

**1. RDS PostgreSQL:**

```bash
# Create DB instance
Instance Class: db.t3.medium (or larger)
Storage: 100 GB GP3 SSD
Multi-AZ: Yes (for high availability)
Backup Retention: 7 days
```

**2. ElastiCache Redis:**

```bash
# Create Redis cluster
Node Type: cache.t3.medium
Engine: Redis 7.x
Cluster Mode: Enabled
Replicas: 2 (for high availability)
```

**3. EC2 Instances:**

```bash
# Launch 3+ application instances
Instance Type: t3.large
AMI: Amazon Linux 2023 or Ubuntu 22.04
Security Group: Allow 5000 (internal), 22 (SSH), 443 (HTTPS)
```

**4. Application Load Balancer:**

```bash
# Create ALB
Type: Application Load Balancer
Scheme: Internet-facing
Listeners: HTTPS (443) → Target Group (port 5000)
Health Check: GET /api/monitoring/health (every 30s)
```

---

### Option 2: Docker Compose Deployment

#### Production docker-compose.yml

```yaml
version: '3.8'

services:
  # Application instances (scale with docker-compose up --scale app=3)
  app:
    build: .
    restart: always
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
      - CSRF_SECRET=${CSRF_SECRET}
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
    depends_on:
      - db
      - redis
    ports:
      - '5000-5002:5000' # 3 instances
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:5000/api/monitoring/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: price_db
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache & Locks
  redis:
    image: redis:7-alpine
    restart: always
    command: >
      redis-server
      --appendonly yes
      --maxmemory 2gb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
    volumes:
      - redis-data:/data
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 3

  # Nginx Load Balancer (if not using cloud LB)
  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app

volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
```

---

## Environment Configuration

### Create Production .env File

```bash
# COPY .env.example to .env
cp .env.example .env

# IMPORTANT: Generate secure secrets!
openssl rand -base64 32  # Use for each secret below
```

### Required Configuration

```bash
# Database (use RDS endpoint or docker service name)
DATABASE_URL=postgresql://user:password@db-host:5432/price_db
POSTGRES_PASSWORD=<STRONG_PASSWORD_HERE>

# Security Secrets (CRITICAL - generate unique values)
SESSION_SECRET=<GENERATE_WITH_openssl_rand_-base64_32>
CSRF_SECRET=<GENERATE_WITH_openssl_rand_-base64_32>
DISCOURSE_SSO_SECRET=<GENERATE_WITH_openssl_rand_-base64_32>
DISCOURSE_WEBHOOK_SECRET=<GENERATE_WITH_openssl_rand_-base64_32>

# Redis (use ElastiCache endpoint or docker service name)
REDIS_URL=redis://redis-cluster.abc123.use1.cache.amazonaws.com:6379
REDIS_HOST=redis-cluster.abc123.use1.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=<REDIS_PASSWORD_IF_REQUIRED>

# OpenAI API
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Custom Search
GOOGLE_CUSTOM_SEARCH_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
GOOGLE_SEARCH_ENGINE_ID=xxxxxxxxxxxxxxxxxxxx

# Monitoring & Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/xxxxxxxx

# Email (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=<APP_SPECIFIC_PASSWORD>
SMTP_FROM_ADDRESS=noreply@pricecompare.com

# Application
NODE_ENV=production
PORT=5000
APP_URL=https://pricecompare.com
CLIENT_URL=https://pricecompare.com

# Admin
ADMIN_EMAIL=admin@pricecompare.com
```

### Security Checklist

- [ ] All secrets are unique and strong (32+ characters)
- [ ] No default passwords used
- [ ] `.env` file is NOT committed to git
- [ ] Secrets are stored in vault (AWS Secrets Manager, HashiCorp Vault, etc.)
- [ ] Database password is rotated regularly
- [ ] Redis has password protection enabled (if exposed)
- [ ] HTTPS/TLS enabled for all external traffic
- [ ] Security groups/firewalls configured correctly

---

## Database Setup

### 1. Create Database

```bash
# Connect to PostgreSQL
psql -h <DB_HOST> -U postgres

# Create database
CREATE DATABASE price_db;
CREATE USER pricecompare WITH ENCRYPTED PASSWORD '<STRONG_PASSWORD>';
GRANT ALL PRIVILEGES ON DATABASE price_db TO pricecompare;

# Switch to database
\c price_db

# Grant schema privileges
GRANT ALL ON SCHEMA public TO pricecompare;
```

### 2. Run Migrations

```bash
# Push database schema
npm run db:push

# Verify tables created
psql -h <DB_HOST> -U pricecompare -d price_db -c "\dt"
```

### 3. Create Indexes (Production Optimization)

```sql
-- Critical indexes for performance
CREATE INDEX CONCURRENTLY idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX CONCURRENTLY idx_scraping_jobs_created_at ON scraping_jobs(created_at DESC);
CREATE INDEX CONCURRENTLY idx_scraping_jobs_job_type ON scraping_jobs(job_type);

CREATE INDEX CONCURRENTLY idx_trending_products_status ON trending_products(status);
CREATE INDEX CONCURRENTLY idx_trending_products_discovered_at ON trending_products(discovered_at DESC);

CREATE INDEX CONCURRENTLY idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX CONCURRENTLY idx_agent_sessions_agent_type ON agent_sessions(agent_type);

CREATE INDEX CONCURRENTLY idx_product_offers_product_id ON product_offers(product_id);
CREATE INDEX CONCURRENTLY idx_product_offers_scraped_at ON product_offers(scraped_at DESC);
```

---

## Redis Configuration

### Production Redis Settings

**For ElastiCache:**

- Parameter Group: Create custom from default.redis7
- Cluster Mode: Enabled
- Replicas: 2-3 per shard
- Automatic Failover: Enabled
- Encryption in-transit: Enabled
- Encryption at-rest: Enabled

**For Self-Hosted Redis:**

```bash
# /etc/redis/redis.conf
bind 0.0.0.0
protected-mode yes
port 6379
requirepass <STRONG_PASSWORD>

# Persistence
appendonly yes
appendfilename "appendonly.aof"
save 900 1
save 300 10
save 60 10000

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Security
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

---

## Application Deployment

### Step-by-Step Deployment

**1. Clone Repository**

```bash
git clone https://github.com/yourorg/PriceCompare.git
cd PriceCompare
git checkout main  # or specific release tag
```

**2. Install Dependencies**

```bash
npm ci --production
```

**3. Build Application**

```bash
npm run build
```

**4. Configure Environment**

```bash
# Create .env from template
cp .env.example .env

# Edit with production values
nano .env
```

**5. Database Migration**

```bash
npm run db:push
```

**6. Start Application**

```bash
# Option A: Direct Node
NODE_ENV=production node dist/index.js

# Option B: PM2 (recommended for process management)
npm install -g pm2
pm2 start dist/index.js --name pricecompare -i 3  # 3 instances

# Option C: Docker
docker-compose up -d --scale app=3
```

**7. Verify Deployment**

```bash
# Check health endpoint
curl http://localhost:5000/api/monitoring/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-11-14T...",
  "services": {
    "database": true,
    "redis": true,
    "agents": true
  }
}
```

---

## Horizontal Scaling

### Scaling with PM2 (Single Server)

```bash
# Start 5 instances
pm2 start dist/index.js -i 5 --name pricecompare

# Auto-scale based on CPU
pm2 start dist/index.js -i max  # Uses all CPU cores

# Monitor instances
pm2 monit

# View logs from all instances
pm2 logs pricecompare

# Reload instances (zero-downtime)
pm2 reload pricecompare
```

### Scaling with Docker Compose

```bash
# Scale to 5 instances
docker-compose up -d --scale app=5

# Check running containers
docker-compose ps

# View logs from all instances
docker-compose logs -f app
```

### Scaling with Kubernetes (Advanced)

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pricecompare-app
spec:
  replicas: 5 # Number of instances
  selector:
    matchLabels:
      app: pricecompare
  template:
    metadata:
      labels:
        app: pricecompare
    spec:
      containers:
        - name: app
          image: pricecompare:latest
          ports:
            - containerPort: 5000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: pricecompare-secrets
                  key: database-url
            - name: REDIS_URL
              value: redis://redis-service:6379
          livenessProbe:
            httpGet:
              path: /api/monitoring/health
              port: 5000
            initialDelaySeconds: 30
            periodSeconds: 10
          resources:
            requests:
              memory: '2Gi'
              cpu: '1000m'
            limits:
              memory: '4Gi'
              cpu: '2000m'
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pricecompare-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pricecompare-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Load Balancer Configuration

**Nginx Configuration (nginx.conf):**

```nginx
upstream pricecompare_backend {
    least_conn;  # Use least-connections algorithm

    server app1:5000 max_fails=3 fail_timeout=30s;
    server app2:5000 max_fails=3 fail_timeout=30s;
    server app3:5000 max_fails=3 fail_timeout=30s;

    keepalive 32;
}

server {
    listen 80;
    server_name pricecompare.com www.pricecompare.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pricecompare.com www.pricecompare.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # WebSocket Support (for monitoring dashboard)
    location /socket.io/ {
        proxy_pass http://pricecompare_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API & Static Files
    location / {
        proxy_pass http://pricecompare_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Health check endpoint should return quickly
        proxy_cache off;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

---

## Monitoring Setup

### 1. Access Monitoring Dashboard

Navigate to: `https://your-domain.com/monitoring` (admin access required)

### 2. Configure Slack Alerts

```bash
# Get Slack webhook URL
# Visit: https://api.slack.com/messaging/webhooks
# Create new webhook for #pricecompare-alerts channel

# Add to .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Test alert
curl -X POST http://localhost:5000/api/monitoring/alerts/test
```

### 3. Alert Rules (Configured Automatically)

The system monitors:

- **High Error Rate** (>20%) - Critical alert every 5 minutes
- **Queue Backlog** (>50 jobs) - Warning every 10 minutes
- **Low Cache Hit Rate** (<40%) - Warning every 10 minutes
- **No Active Agents** - Warning every 5 minutes
- **Redis Disconnection** - Critical alert every 1 minute
- **Database Issues** - Critical alert every 1 minute

### 4. External Monitoring (Recommended)

**AWS CloudWatch:**

```bash
# Install CloudWatch agent on EC2 instances
# Monitor: CPU, Memory, Disk I/O, Network

# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name high-cpu \
  --alarm-description "Alert when CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

**Datadog / New Relic:**

- Install APM agent
- Monitor application performance
- Track custom metrics (job processing, lock contention)
- Set up custom dashboards

---

## Health Checks

### Application Health Endpoint

**GET /api/monitoring/health**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T12:00:00.000Z",
  "uptime": 86400,
  "services": {
    "database": true,
    "redis": true,
    "agents": true
  },
  "version": "2.0.0"
}
```

### Load Balancer Health Check Configuration

```yaml
Health Check Settings:
  Protocol: HTTP
  Path: /api/monitoring/health
  Port: 5000
  Interval: 30 seconds
  Timeout: 5 seconds
  Healthy Threshold: 2
  Unhealthy Threshold: 3
  Success Codes: 200
```

### Readiness vs. Liveness Probes

**Liveness Probe** (Is the app running?):

- Endpoint: `/api/monitoring/health`
- Frequency: Every 30s
- Action on Failure: Restart container

**Readiness Probe** (Can the app serve traffic?):

- Endpoint: `/api/monitoring/health`
- Check: All services (DB, Redis, Agents) are healthy
- Action on Failure: Remove from load balancer

---

## Backup & Recovery

### Database Backups

**Automated Daily Backups:**

```bash
# Cron job for daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-db.sh

# /usr/local/bin/backup-db.sh
#!/bin/bash
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="/backups/price_db_${DATE}.sql.gz"

pg_dump -h $DB_HOST -U $DB_USER price_db | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://pricecompare-backups/daily/

# Keep only last 30 days locally
find /backups -name "*.sql.gz" -mtime +30 -delete
```

**Manual Backup:**

```bash
pg_dump -h $DB_HOST -U $DB_USER -Fc price_db > backup_$(date +%Y%m%d).dump
```

**Restore from Backup:**

```bash
pg_restore -h $DB_HOST -U $DB_USER -d price_db -c backup_20251114.dump
```

### Redis Persistence

Redis is configured with:

- AOF (Append-Only File) enabled
- RDB snapshots every 15 minutes
- Automatic backups to `/data` volume

---

## Troubleshooting

### Common Issues

**1. Application Won't Start**

```bash
# Check logs
pm2 logs pricecompare
# or
docker-compose logs app

# Common causes:
- Database connection failure (check DATABASE_URL)
- Redis connection failure (check REDIS_URL)
- Missing environment variables
- Port 5000 already in use
```

**2. High Lock Contention**

```bash
# Check dashboard: /monitoring
# Look for "Contention" badge

# Solutions:
- Scale up instances (more workers)
- Optimize job processing time
- Review lock TTL settings
```

**3. Database Connection Pool Exhausted**

```bash
# Symptoms: "sorry, too many clients already"

# Solutions:
# Increase PostgreSQL max_connections
ALTER SYSTEM SET max_connections = 200;
SELECT pg_reload_conf();

# Reduce connection pool size per instance
# In code: pgPool.max = 10 (instead of 20)
```

**4. Memory Leaks**

```bash
# Monitor memory usage
pm2 monit

# If memory keeps growing:
- Check for event listener leaks
- Review cache size limits
- Restart instances periodically (pm2 reload)
```

**5. WebSocket Connection Failures**

```bash
# Check nginx configuration
# Ensure Upgrade headers are set

# Test WebSocket
wscat -c wss://your-domain.com/socket.io/

# Check firewall rules allow WebSocket traffic
```

---

## Post-Deployment Checklist

- [ ] All environment variables configured correctly
- [ ] Database migrations applied successfully
- [ ] Redis is accessible from all app instances
- [ ] HTTPS/SSL certificates installed and valid
- [ ] Load balancer health checks passing
- [ ] Monitoring dashboard accessible
- [ ] Slack alerts working (test alert sent)
- [ ] Database backups configured and tested
- [ ] DNS records updated
- [ ] Firewall rules configured
- [ ] Log aggregation set up
- [ ] Performance baseline recorded
- [ ] Incident response plan documented
- [ ] Team trained on monitoring dashboard

---

## Performance Benchmarks

**Expected Performance (3 instances):**

- Job Throughput: 500-1000 jobs/hour
- Lock Success Rate: >95%
- Lock Contention: <15%
- Avg Lock Acquisition: <100ms
- Cache Hit Rate: >80%
- API Response Time: <200ms (p95)
- WebSocket Update Latency: <5s

---

## Support & Maintenance

### Regular Maintenance Tasks

**Weekly:**

- Review monitoring dashboard for anomalies
- Check error logs for patterns
- Verify backup success

**Monthly:**

- Review and optimize database queries
- Clean up old jobs (>90 days)
- Update dependencies (security patches)
- Review resource usage and scaling needs

**Quarterly:**

- Load testing
- Security audit
- Disaster recovery drill
- Performance optimization review

---

## Contacts

- **Technical Lead:** [Your Name]
- **DevOps:** [DevOps Team]
- **On-Call:** [Pager Duty / Slack Channel]
- **Monitoring:** https://your-domain.com/monitoring
- **Status Page:** https://status.your-domain.com

---

**Last Updated:** 2025-11-14
**Document Version:** 1.0
**Deployment Status:** ✅ READY FOR PRODUCTION
