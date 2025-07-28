# Affiliate Link Generation System
**Date**: June 26, 2025  
**Status**: Implementation Plan  
**Integration**: Seamless with existing multi-agent architecture

## Overview

This document outlines the implementation of an intelligent affiliate link generation system that transforms product URLs into revenue-generating affiliate links while maintaining the existing system architecture.

## System Architecture

### Database Schema Extensions

#### Retailers Table Enhancements
```sql
ALTER TABLE retailers ADD COLUMN affiliate_id VARCHAR(100);
ALTER TABLE retailers ADD COLUMN affiliate_program VARCHAR(50);
ALTER TABLE retailers ADD COLUMN base_affiliate_url TEXT;
ALTER TABLE retailers ADD COLUMN commission_rate DECIMAL(4,2);
ALTER TABLE retailers ADD COLUMN affiliate_status VARCHAR(20) DEFAULT 'inactive';
ALTER TABLE retailers ADD COLUMN affiliate_config JSONB;
```

#### Product Offers Table Enhancements
```sql
ALTER TABLE product_offers ADD COLUMN affiliate_url TEXT;
ALTER TABLE product_offers ADD COLUMN link_health_status VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE product_offers ADD COLUMN last_link_check TIMESTAMP;
ALTER TABLE product_offers ADD COLUMN click_count INTEGER DEFAULT 0;
```

### Affiliate Program Support

#### Amazon Associates
- **URL Pattern**: `https://amazon.com/dp/{ASIN}?tag={AFFILIATE_TAG}`
- **Configuration**: `{ "tag": "yourtag-20", "region": "com" }`
- **Link Type**: Direct product links with tracking tag

#### Walmart Connect
- **URL Pattern**: `https://goto.walmart.com/c/{PUBLISHER_ID}/{PRODUCT_ID}`
- **Configuration**: `{ "publisherId": "12345", "campaignId": "default" }`
- **Link Type**: Redirect-based affiliate links

#### Target Partners
- **URL Pattern**: `https://goto.target.com/c/{CAMPAIGN_ID}?u={ENCODED_URL}`
- **Configuration**: `{ "campaignId": "abc123", "publisherId": "target123" }`
- **Link Type**: URL encoding with campaign tracking

#### Best Buy Affiliate Network
- **URL Pattern**: `https://bestbuy.7tiv.net/c/{OFFER_ID}?u={ENCODED_URL}`
- **Configuration**: `{ "offerId": "12345", "networkId": "7tiv" }`
- **Link Type**: Commission Junction network links

#### Generic UTM Tracking
- **URL Pattern**: `{ORIGINAL_URL}?utm_source={SOURCE}&utm_campaign={CAMPAIGN}`
- **Configuration**: `{ "source": "pricecompare", "campaign": "product" }`
- **Link Type**: Analytics tracking for direct partnerships

## Implementation Components

### 1. Affiliate Link Service (`server/services/affiliate-link-service.ts`)

**Core Responsibilities**:
- Transform product URLs into affiliate links
- Support multiple affiliate program formats
- Validate affiliate link functionality
- Handle fallback scenarios
- Track link performance

**Key Methods**:
- `generateAffiliateLink(retailerId, productUrl, metadata)`
- `validateAffiliateLink(affiliateUrl)`
- `getRetailerConfig(retailerId)`
- `trackLinkClick(offerId)`
- `healthCheckLinks()`

### 2. Affiliate Link Agent (`server/agents/affiliate-agent.ts`)

**Integration with Existing System**:
- Extends `BaseAgent` class
- Processes affiliate link generation jobs
- Integrates with job queue system
- Reports to coordination agent

**Agent Workflow**:
1. Receives product URL from extraction/search agents
2. Identifies retailer from URL pattern matching
3. Retrieves retailer affiliate configuration
4. Applies appropriate link transformation
5. Validates generated affiliate link
6. Updates product offer with affiliate URL
7. Schedules periodic health checks

### 3. Admin Interface Extensions

**Retailer Management Panel**:
- CRUD operations for retailer affiliate settings
- Affiliate program configuration interface
- Link generation testing tools
- Performance analytics dashboard
- Commission rate management

**New Admin Routes**:
- `/admin/retailers` - Retailer management interface
- `/admin/affiliate-stats` - Performance analytics
- `/admin/link-health` - Link monitoring dashboard

### 4. Frontend Enhancements

**Product Card Updates**:
- Replace direct retailer links with affiliate links
- Track click-through events
- Maintain user experience consistency
- Handle affiliate link failures gracefully

**Analytics Integration**:
- Click tracking for affiliate links
- Conversion rate monitoring
- Revenue attribution reporting
- Performance optimization suggestions

## Affiliate Program Configurations

### Amazon Associates Setup
```json
{
  "name": "Amazon",
  "affiliate_program": "amazon_associates",
  "affiliate_id": "yourtag-20",
  "base_affiliate_url": "https://amazon.com/dp/{asin}?tag={tag}&linkCode=as2",
  "commission_rate": 4.00,
  "affiliate_config": {
    "tag": "yourtag-20",
    "region": "com",
    "linkCode": "as2",
    "trackingId": "yourtag-20"
  }
}
```

### Walmart Connect Setup
```json
{
  "name": "Walmart",
  "affiliate_program": "walmart_connect",
  "affiliate_id": "12345",
  "base_affiliate_url": "https://goto.walmart.com/c/{publisherId}/{itemId}",
  "commission_rate": 3.00,
  "affiliate_config": {
    "publisherId": "12345",
    "campaignId": "default",
    "subId": "pricecompare"
  }
}
```

### Target Partners Setup
```json
{
  "name": "Target",
  "affiliate_program": "target_partners",
  "affiliate_id": "target123",
  "base_affiliate_url": "https://goto.target.com/c/{campaignId}?u={encodedUrl}",
  "commission_rate": 2.50,
  "affiliate_config": {
    "campaignId": "abc123",
    "publisherId": "target123",
    "source": "pricecompare"
  }
}
```

## Link Generation Logic

### URL Pattern Recognition
```javascript
const retailerPatterns = {
  amazon: /amazon\.com\/(?:dp\/|gp\/product\/)([A-Z0-9]{10})/,
  walmart: /walmart\.com\/ip\/.*\/(\d+)/,
  target: /target\.com\/p\/.*\/-\/A-(\d+)/,
  bestbuy: /bestbuy\.com\/site\/.*\/(\d+)\.p/
};
```

### Link Transformation Pipeline
1. **URL Analysis**: Extract product identifiers from original URLs
2. **Retailer Matching**: Identify retailer using URL patterns
3. **Config Retrieval**: Get affiliate configuration for retailer
4. **Link Generation**: Apply appropriate transformation template
5. **Validation**: Test generated link functionality
6. **Storage**: Save both original and affiliate URLs
7. **Monitoring**: Schedule periodic health checks

### Error Handling & Fallbacks
- **Invalid URLs**: Return original URL with UTM tracking
- **Missing Config**: Use generic tracking parameters
- **Link Validation Failure**: Fall back to direct retailer link
- **API Errors**: Queue for retry with exponential backoff

## Integration with Existing Agents

### Search Agent Integration
- Automatically generate affiliate links for discovered products
- Store affiliate URLs alongside original URLs
- Validate affiliate links during product processing

### Extraction Agent Integration
- Transform extracted product URLs into affiliate links
- Update existing product offers with affiliate versions
- Monitor affiliate link health during regular updates

### Coordination Agent Integration
- Schedule affiliate link generation jobs
- Manage affiliate link health check cycles
- Coordinate with other agents for link updates

## Performance Monitoring

### Link Health Monitoring
- **Daily Health Checks**: Validate all affiliate links
- **Broken Link Detection**: Identify and flag non-functional links
- **Automatic Repair**: Regenerate broken affiliate links
- **Performance Tracking**: Monitor click-through and conversion rates

### Analytics Dashboard
- **Click Tracking**: Monitor affiliate link usage
- **Revenue Attribution**: Track commissions by retailer
- **Performance Optimization**: Identify best-performing affiliate programs
- **Conversion Analysis**: Analyze customer behavior patterns

## Implementation Timeline

### Phase 1: Database & Service Layer (Week 1)
- Extend database schema for affiliate data
- Implement affiliate link service
- Create basic link generation logic
- Add retailer configuration management

### Phase 2: Agent Integration (Week 2)
- Develop affiliate link agent
- Integrate with existing coordination system
- Implement link health monitoring
- Add job queue processing

### Phase 3: Admin Interface (Week 3)
- Build retailer management interface
- Create affiliate configuration forms
- Implement link testing tools
- Add performance analytics dashboard

### Phase 4: Frontend Integration (Week 4)
- Update product cards with affiliate links
- Implement click tracking
- Add fallback handling
- Optimize user experience

## Success Metrics

### Technical Metrics
- **Link Generation Success Rate**: >95% successful transformations
- **Link Health Score**: >90% functional affiliate links
- **Processing Speed**: <500ms average link generation time
- **System Uptime**: >99.9% availability for affiliate services

### Business Metrics
- **Click-Through Rate**: Monitor affiliate link engagement
- **Conversion Rate**: Track purchase completions
- **Revenue Attribution**: Measure commission earnings
- **Retailer Performance**: Compare affiliate program effectiveness

This system provides a comprehensive affiliate link generation solution that integrates seamlessly with your existing architecture while maximizing revenue potential from your price comparison platform.