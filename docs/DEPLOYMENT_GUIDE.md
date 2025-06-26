# Deployment Guide
**Date**: June 26, 2025  
**Version**: 1.0  
**Platform**: Replit Deployments

## Overview

This guide covers deploying your AI-powered price comparison platform to production using Replit Deployments. The platform includes automated product discovery, affiliate link generation, and community features.

## Pre-Deployment Checklist

### Environment Configuration
- [ ] `DATABASE_URL` - PostgreSQL database connection
- [ ] `SESSION_SECRET` - Secure session encryption key  
- [ ] `GOOGLE_CUSTOM_SEARCH_API_KEY` - Google Custom Search API
- [ ] `OPENAI_API_KEY` - OpenAI GPT-4 API
- [ ] `NODE_ENV=production` - Production environment flag

### Database Preparation
- [ ] Run schema migrations: `npm run db:push`
- [ ] Seed initial data: `npm run seed` (if available)
- [ ] Verify all tables created correctly
- [ ] Test database connectivity

### Affiliate Accounts Setup
- [ ] Amazon Associates account approved
- [ ] Walmart Connect publisher approved
- [ ] Target Partners account configured
- [ ] Best Buy affiliate network joined
- [ ] Commission Junction accounts active

### Performance Optimization
- [ ] Bundle sizes optimized
- [ ] Image assets compressed
- [ ] Database queries indexed
- [ ] Caching strategies implemented
- [ ] CDN configured (if applicable)

## Deployment Process

### Step 1: Prepare for Deployment
1. **Ensure all dependencies are production-ready**
   ```bash
   npm install --production
   npm run build
   ```

2. **Test production build locally**
   ```bash
   npm run start
   ```

3. **Verify all environment variables**
   Check that all required secrets are configured in Replit

### Step 2: Deploy to Replit
1. **Access Deployment Settings**
   - Go to your Replit project
   - Click "Deploy" button
   - Select "Autoscale deployment"

2. **Configure Deployment**
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
   - **Port**: 5000 (default)
   - **Environment**: Production

3. **Set Environment Variables**
   Configure all production secrets in Replit Deployments:
   ```
   NODE_ENV=production
   DATABASE_URL=[production-database-url]
   SESSION_SECRET=[secure-random-string]
   GOOGLE_CUSTOM_SEARCH_API_KEY=[your-api-key]
   OPENAI_API_KEY=[your-openai-key]
   ```

### Step 3: Domain Configuration
1. **Custom Domain Setup** (Optional)
   - Add custom domain in Deployment settings
   - Configure DNS records
   - Enable SSL certificate

2. **Health Checks**
   - Verify application starts successfully
   - Test key endpoints
   - Monitor deployment logs

## Post-Deployment Configuration

### Database Setup
1. **Initialize Database Schema**
   ```sql
   -- Verify tables exist
   \dt
   
   -- Check sample data
   SELECT COUNT(*) FROM products;
   SELECT COUNT(*) FROM retailers;
   ```

2. **Configure Affiliate Settings**
   Access admin panel and update retailer configurations:
   - Amazon Associates tag
   - Walmart Connect publisher ID
   - Commission rates and tracking

### AI Agent Initialization
1. **Start AI Agents**
   ```bash
   curl -X POST https://[your-domain].replit.app/api/scraping/initialize
   curl -X POST https://[your-domain].replit.app/api/scraping/start-agents
   ```

2. **Verify Agent Status**
   ```bash
   curl https://[your-domain].replit.app/api/scraping/status
   ```

### Performance Monitoring
1. **Set Up Monitoring**
   - Monitor application logs
   - Track API response times
   - Watch database performance
   - Monitor affiliate link health

2. **Configure Alerts**
   - High error rates
   - Database connection issues
   - API rate limit warnings
   - Affiliate link failures

## Security Configuration

### SSL/TLS Setup
- Ensure HTTPS is enabled (automatic with Replit)
- Verify certificate validity
- Test secure connections

### Session Security
```javascript
// Production session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,          // HTTPS only
    httpOnly: true,        // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
}));
```

### API Rate Limiting
- Monitor rate limit usage
- Configure appropriate limits
- Set up IP-based restrictions if needed

## Backup Strategy

### Database Backups
1. **Automated Backups**
   - Enable daily automated backups
   - Test backup restoration process
   - Store backups in secure location

2. **Manual Backup**
   ```bash
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
   ```

### Configuration Backups
- Export environment variables
- Backup affiliate configurations
- Document deployment settings

## Monitoring & Maintenance

### Application Monitoring
1. **Health Checks**
   - `/api/health` endpoint
   - Database connectivity
   - External API status

2. **Performance Metrics**
   - Response times
   - Throughput
   - Error rates
   - Resource usage

### AI Agent Monitoring
1. **Agent Health**
   ```bash
   curl https://[domain]/api/scraping/status
   ```

2. **Job Queue Status**
   - Monitor pending jobs
   - Track completion rates
   - Watch for failures

### Affiliate Link Monitoring
1. **Link Health Checks**
   ```bash
   curl https://[domain]/api/admin/affiliate-stats
   ```

2. **Performance Tracking**
   - Click-through rates
   - Conversion tracking
   - Revenue attribution

## Scaling Considerations

### Horizontal Scaling
- Replit Autoscale handles traffic spikes
- Monitor resource usage
- Configure appropriate scaling triggers

### Database Optimization
- Add database indexes for popular queries
- Implement connection pooling
- Monitor query performance

### Caching Strategy
- API response caching
- Static asset CDN
- Database query caching

## Troubleshooting

### Common Issues

**Deployment Fails**
- Check build logs for errors
- Verify all dependencies installed
- Ensure environment variables set

**Database Connection Issues**
- Verify DATABASE_URL format
- Check network connectivity
- Validate credentials

**AI Agents Not Starting**
- Check API key configurations
- Monitor agent initialization logs
- Verify external API access

**Affiliate Links Not Working**
- Test affiliate configurations
- Check retailer API status
- Verify link generation logic

### Log Analysis
1. **Application Logs**
   ```bash
   # View recent logs
   replit logs --tail
   
   # Filter error logs
   replit logs --level error
   ```

2. **Database Logs**
   - Monitor slow queries
   - Check connection issues
   - Track error patterns

### Performance Issues
1. **Identify Bottlenecks**
   - Profile API endpoints
   - Analyze database queries
   - Monitor external API calls

2. **Optimization Steps**
   - Add database indexes
   - Implement caching
   - Optimize query logic

## Rollback Plan

### Quick Rollback
1. **Revert to Previous Version**
   - Use Replit deployment history
   - Rollback to last known good state
   - Monitor for stability

2. **Database Rollback**
   - Restore from backup if needed
   - Verify data integrity
   - Test application functionality

### Emergency Procedures
1. **Critical Issues**
   - Disable problematic features
   - Implement maintenance mode
   - Communicate with users

2. **Recovery Process**
   - Identify root cause
   - Apply fixes
   - Gradual feature re-enablement

## Success Metrics

### Key Performance Indicators
- **Uptime**: Target 99.9%
- **Response Time**: < 500ms average
- **Error Rate**: < 1%
- **Database Performance**: < 100ms queries

### Business Metrics
- **Product Discovery**: Daily trending products
- **Affiliate Revenue**: Monthly commission tracking
- **User Engagement**: Forum activity metrics
- **Search Performance**: Query success rates

This deployment ensures your AI-powered price comparison platform is production-ready with automated product discovery, affiliate revenue generation, and comprehensive monitoring.