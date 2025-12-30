# Discourse Integration Deployment Guide

## Overview

This guide provides step-by-step instructions to deploy the full Discourse integration alongside the price comparison platform. The setup includes Docker containerization, shared authentication via SSO, and seamless user experience between both applications.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database access
- SMTP server credentials (for email notifications)
- Domain name or server IP address

## Quick Start

### 1. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your specific values:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/price_db
POSTGRES_PASSWORD=your_secure_postgres_password

# Discourse Configuration
DISCOURSE_URL=http://your-domain.com:3000
DISCOURSE_SSO_SECRET=generate_a_secure_random_string_here
DISCOURSE_API_KEY=your_discourse_api_key_here
DISCOURSE_DB_PASSWORD=secure_discourse_db_password

# Session Configuration
SESSION_SECRET=generate_another_secure_random_string

# SMTP Configuration
SMTP_ADDRESS=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Admin Configuration
ADMIN_EMAIL=admin@your-domain.com
```

### 2. Generate Secure Secrets

Generate secure random strings for SSO and session secrets:

```bash
# For DISCOURSE_SSO_SECRET
openssl rand -hex 32

# For SESSION_SECRET
openssl rand -hex 32
```

### 3. Deploy with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Initial Discourse Setup

1. Wait for Discourse to start (may take 5-10 minutes on first run)
2. Access Discourse at http://localhost:3000
3. Complete the initial admin setup
4. Configure SSO settings in Discourse admin panel

## Detailed Configuration

### Discourse SSO Configuration

1. Access Discourse admin panel at `http://your-domain:3000/admin`
2. Navigate to Settings → Login
3. Configure the following settings:

```
enable sso: true
sso url: http://your-domain:5000/discourse/sso
sso secret: [same value as DISCOURSE_SSO_SECRET in .env]
sso overrides email: true
sso overrides username: true
sso overrides name: true
```

### Price Comparison App Configuration

The price comparison app automatically configures SSO endpoints:

- SSO Provider: `/discourse/sso`
- SSO Test Endpoint: `/api/admin/discourse/test-sso`
- Health Check: `/api/discourse/health`

### Database Schema Setup

The shared authentication tables are automatically created during initialization:

- `shared_users` - User accounts with SSO support
- `shared_sessions` - Cross-application sessions
- `sso_tokens` - Temporary SSO authentication tokens
- `discourse_user_mapping` - User synchronization between apps

## Production Deployment

### Security Considerations

1. **SSL/TLS Configuration**: Enable HTTPS for both applications
2. **Firewall Setup**: Restrict access to necessary ports only
3. **Environment Secrets**: Use secure secret management
4. **Database Security**: Use separate database users with minimal permissions

### Nginx Configuration for Production

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    # Main application
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Forum application
    location /forum/ {
        rewrite ^/forum(.*) $1 break;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Environment Variables for Production

```env
NODE_ENV=production
DISCOURSE_HOSTNAME=your-domain.com
DISCOURSE_ENABLE_CORS=true
DISCOURSE_FORCE_HTTPS=true
```

## Testing the Integration

### 1. Test SSO Configuration

```bash
# Test SSO endpoint
curl -H "Authorization: Bearer admin_token" \
     http://localhost:5000/api/admin/discourse/test-sso

# Check health status
curl http://localhost:5000/api/discourse/health
```

### 2. Test User Flow

1. Register a new user on the main app (localhost:5000)
2. Navigate to forum section
3. Verify automatic login to Discourse
4. Check user data synchronization

### 3. Verify Database Integration

```sql
-- Check shared users table
SELECT id, username, email, discourse_user_id FROM shared_users;

-- Check user mappings
SELECT * FROM discourse_user_mapping;

-- Check SSO tokens (should be empty if no active SSO flows)
SELECT * FROM sso_tokens WHERE expires_at > NOW();
```

## Troubleshooting

### Common Issues

#### 1. Discourse Container Won't Start

**Symptoms**: Discourse container exits with error
**Solutions**:
- Check SMTP configuration
- Verify database connection
- Check available memory (Discourse requires 2GB+ RAM)

```bash
# Check container logs
docker-compose logs discourse

# Restart with fresh data
docker-compose down -v
docker-compose up -d
```

#### 2. SSO Authentication Fails

**Symptoms**: Users redirected to login instead of auto-login
**Solutions**:
- Verify SSO secret matches in both applications
- Check SSO URL configuration in Discourse
- Test SSO endpoint directly

```bash
# Test SSO endpoint
curl "http://localhost:5000/discourse/sso?sso=test&sig=test"
```

#### 3. Database Connection Issues

**Symptoms**: Both apps can't connect to database
**Solutions**:
- Check DATABASE_URL format
- Verify PostgreSQL is running
- Check network connectivity between containers

```bash
# Test database connection
docker-compose exec price-app npm run db:push
```

### Monitoring and Logs

#### Application Logs

```bash
# Price comparison app logs
docker-compose logs -f price-app

# Discourse logs
docker-compose logs -f discourse

# Database logs
docker-compose logs -f postgres
```

#### Health Checks

The integration includes health check endpoints:

- Price App: `http://localhost:5000/health`
- Discourse Health: `http://localhost:5000/api/discourse/health`
- Forum Access: `http://localhost:3000`

## Backup and Recovery

### Database Backup

```bash
# Backup both databases
docker-compose exec postgres pg_dump -U postgres price_db > price_db_backup.sql
docker-compose exec postgres pg_dump -U postgres discourse_db > discourse_db_backup.sql
```

### Container Data Backup

```bash
# Backup Discourse uploads and data
docker run --rm -v discourse_uploads:/source -v $(pwd):/backup alpine \
    tar czf /backup/discourse_uploads.tar.gz -C /source .
```

### Recovery

```bash
# Restore database
docker-compose exec -T postgres psql -U postgres -d price_db < price_db_backup.sql

# Restore Discourse data
docker run --rm -v discourse_uploads:/target -v $(pwd):/backup alpine \
    tar xzf /backup/discourse_uploads.tar.gz -C /target
```

## Scaling and Performance

### Resource Requirements

- **Price App**: 512MB RAM, 1 CPU core
- **Discourse**: 2GB RAM, 2 CPU cores
- **PostgreSQL**: 1GB RAM, 1 CPU core
- **Redis**: 256MB RAM
- **Nginx**: 128MB RAM

### Performance Optimization

1. **Enable Redis Caching**: Configure Redis for both applications
2. **Database Optimization**: Add indexes for SSO queries
3. **CDN Integration**: Use CDN for static assets
4. **Load Balancing**: Use multiple app instances behind load balancer

## Support and Maintenance

### Regular Maintenance Tasks

1. **Database Cleanup**: Remove expired SSO tokens weekly
2. **Log Rotation**: Configure log rotation for all services
3. **Security Updates**: Keep Docker images updated
4. **SSL Certificate Renewal**: Automate certificate renewal

### Monitoring Dashboards

Consider setting up monitoring for:
- Application response times
- Database connection pool usage
- SSO authentication success rates
- Error rates and exceptions
- Resource utilization (CPU, memory, disk)

## Migration from Custom Forum

If migrating from the existing custom forum implementation:

1. **Export Existing Data**: Export topics, posts, and users
2. **Import to Discourse**: Use Discourse import scripts
3. **Update Navigation**: Update frontend navigation to point to Discourse
4. **Test SSO Flow**: Verify all existing users can access Discourse
5. **Remove Custom Forum**: Clean up old forum code and routes

This completes the full Discourse integration deployment guide. The integration provides a professional forum experience while maintaining seamless authentication between the price comparison platform and community discussions.