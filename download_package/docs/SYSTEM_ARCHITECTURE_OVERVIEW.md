# System Architecture Overview
**Date**: June 26, 2025  
**Version**: 2.0  
**Complete system architecture for AI-powered price comparison platform**

## Executive Summary

This document provides a comprehensive overview of the price comparison platform architecture, featuring automated product discovery, intelligent affiliate revenue generation, and community engagement tools. The system processes live data from major retailers using AI agents and transforms it into a revenue-generating comparison platform.

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  React 18 + TypeScript  │  Tailwind CSS v4  │  shadcn/ui       │
│  Wouter Routing         │  TanStack Query    │  Responsive UI   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                            API Calls (REST)
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Express.js + TypeScript │  Session Auth     │  Rate Limiting   │
│  Passport.js            │  Admin Panel      │  API Validation  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                        Database & External APIs
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                    Data & Services Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL Database    │  Google Search API │  OpenAI GPT-4   │
│  Drizzle ORM           │  Affiliate Networks │  Multi-Agent AI │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Architecture

**Technology Stack:**
- **React 18**: Modern component-based UI framework
- **TypeScript**: Type-safe development environment
- **Tailwind CSS v4**: Utility-first styling with native Vite plugin
- **Wouter**: Lightweight client-side routing
- **TanStack Query**: Server state management and caching
- **shadcn/ui**: Accessible component library with Radix UI

**Key Features:**
- Responsive design optimized for all devices
- Real-time product search with 300ms debounced queries
- Lazy loading for performance optimization
- Dark mode support with CSS variables
- Modern web standards compliance

### 2. Backend Architecture

**Technology Stack:**
- **Express.js**: Web application framework
- **TypeScript**: Type-safe server development
- **Passport.js**: Authentication strategy
- **Express Session**: Session management
- **Drizzle ORM**: Type-safe database operations

**API Structure:**
- RESTful endpoints with consistent response format
- Role-based access control (user, admin)
- Input validation with Zod schemas
- Error handling with detailed logging
- Rate limiting for API protection

### 3. Database Design

**PostgreSQL Schema:**
```sql
-- Core Business Tables
retailers (id, name, logo, website, affiliate_config)
products (id, name, category, brand, description)
product_offers (id, product_id, retailer_id, price, affiliate_url)

-- User & Community Tables  
users (id, username, email, role, trust_level)
forum_categories (id, name, description, color)
forum_topics (id, title, category_id, author_id, tags)
forum_posts (id, topic_id, author_id, content, likes)

-- AI Scraping System Tables
agent_sessions (id, agent_type, session_id, performance_metrics)
scraping_jobs (id, job_type, status, priority, target_data)
trending_products (id, name, trend_score, source, discovery_date)
search_queries (id, query_text, retailer, success_rate)
product_urls (id, retailer_id, product_url, extraction_status)
price_history (id, product_id, price, change_date, change_type)
agent_metrics (id, agent_id, execution_time, success_rate)
```

## AI-Powered Automation System

### Multi-Agent Architecture

**Agent Hierarchy:**
```
Coordination Agent (Orchestrator)
├── Product Discovery Agent (AI Trend Analysis)
├── Search Orchestration Agent (Google API)
├── Data Extraction Agent (Web Scraping)
├── Price Monitoring Agent (Change Detection)
└── Affiliate Link Agent (Revenue Generation)
```

**Agent Responsibilities:**

1. **Coordination Agent**
   - Orchestrates all scraping operations
   - Manages job queue and task distribution  
   - Monitors system performance and health
   - Handles workflow automation

2. **Product Discovery Agent**
   - AI-powered trend analysis using OpenAI GPT-4
   - Identifies trending products from multiple sources
   - Categorizes products automatically
   - Generates search optimization strategies

3. **Search Orchestration Agent**
   - Google Custom Search API integration
   - Retailer-specific search query generation
   - URL discovery and validation
   - Search result optimization

4. **Data Extraction Agent**
   - Retailer-specific scraping strategies
   - Anti-detection measures and rate limiting
   - Product data normalization
   - Quality validation and verification

5. **Price Monitoring Agent**
   - Automated price change detection
   - Configurable threshold alerting
   - Historical price tracking
   - Trend analysis and forecasting

6. **Affiliate Link Agent**
   - Automatic affiliate link generation
   - Link health monitoring and repair
   - Performance tracking and optimization
   - Revenue attribution analysis

### External API Integrations

**Google Custom Search API:**
- Live product discovery across major retailers
- Rate limiting: 100 queries per day (free tier)
- Retailer-specific search optimization
- Real-time product URL extraction

**OpenAI GPT-4 API:**
- Intelligent trend analysis and categorization
- Product description enhancement
- Search query optimization
- Content moderation for forum

**Affiliate Networks:**
- Amazon Associates Program
- Walmart Connect
- Target Partners Network
- Commission Junction (Best Buy)
- Generic UTM tracking for others

## Revenue Generation System

### Affiliate Link Architecture

**Link Transformation Pipeline:**
```
Original Product URL
        │
        ▼
Retailer Pattern Recognition
        │
        ▼
Affiliate Configuration Lookup
        │
        ▼
URL Transformation Logic
        │
        ▼
Link Validation & Health Check
        │
        ▼
Database Storage with Analytics
```

**Supported Affiliate Programs:**
- **Amazon Associates**: Tag-based affiliate links with 1-10% commission
- **Walmart Connect**: Publisher ID system with 1-4% commission  
- **Target Partners**: Campaign tracking with 1-8% commission
- **Best Buy Network**: Commission Junction integration
- **Generic UTM**: Analytics tracking for direct partnerships

**Revenue Optimization Features:**
- Automatic link health monitoring
- Performance analytics and reporting
- Commission rate optimization
- Click-through rate tracking
- Conversion attribution analysis

## Data Flow Architecture

### Product Discovery Workflow
```
AI Trend Analysis → Search Query Generation → Google API Search → 
URL Extraction → Product Data Scraping → Database Storage → 
Affiliate Link Generation → User Interface Display
```

### User Interaction Flow
```
User Search → Query Processing → Database Lookup → 
Price Comparison → Affiliate Link Tracking → 
Purchase Attribution → Revenue Recording
```

### Admin Management Flow
```
Admin Dashboard → Retailer Configuration → Affiliate Setup → 
Link Testing → Performance Monitoring → Revenue Analytics
```

## Performance & Scalability

### Caching Strategy
- **API Responses**: 5-minute cache for product data
- **Retailer Information**: 1-hour cache for static data
- **Search Results**: 15-minute cache with stale-while-revalidate
- **Static Assets**: CDN caching with long TTL

### Database Optimization
- **Indexing**: Optimized indexes for search queries
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Early returns and selective loading
- **Data Archival**: Historical data management strategy

### Scalability Features
- **Horizontal Scaling**: Replit Autoscale deployment
- **Load Balancing**: Automatic traffic distribution
- **Rate Limiting**: API protection and fair usage
- **Monitoring**: Real-time performance tracking

## Security Architecture

### Authentication & Authorization
- **Session-based Authentication**: Secure session management
- **Role-based Access Control**: User, admin, moderator roles
- **Password Security**: bcrypt hashing with salt
- **Session Security**: HttpOnly, Secure, SameSite cookies

### Data Protection
- **Input Validation**: Zod schema validation on all inputs
- **SQL Injection Prevention**: Parameterized queries via ORM
- **XSS Protection**: Content sanitization and CSP headers
- **CSRF Protection**: Token-based request validation

### API Security
- **Rate Limiting**: Prevents abuse and DoS attacks
- **API Key Management**: Secure storage of external API keys
- **Request Validation**: Comprehensive input sanitization
- **Error Handling**: Secure error responses without data leakage

## Monitoring & Analytics

### System Monitoring
- **Health Checks**: Automated endpoint monitoring
- **Performance Metrics**: Response time and throughput tracking
- **Error Tracking**: Comprehensive error logging and alerting
- **Resource Usage**: CPU, memory, and database monitoring

### Business Analytics
- **Product Performance**: Search trends and popularity metrics
- **Affiliate Revenue**: Commission tracking and attribution
- **User Engagement**: Forum activity and user behavior
- **Conversion Tracking**: Purchase funnel analysis

### AI Agent Monitoring
- **Agent Performance**: Task completion rates and timing
- **Job Queue Status**: Pending, running, and failed jobs
- **Data Quality**: Extraction accuracy and validation metrics
- **External API Usage**: Rate limit monitoring and optimization

## Deployment Architecture

### Development Environment
- **Local Development**: Node.js 20 with hot reload
- **Database**: PostgreSQL 16 (Replit managed)
- **Build Tools**: Vite for frontend, tsx for backend
- **Type Checking**: TypeScript compilation and validation

### Production Deployment
- **Platform**: Replit Autoscale Deployment
- **Build Process**: Optimized production bundles
- **Environment Variables**: Secure secret management
- **SSL/TLS**: Automatic certificate management
- **Monitoring**: Real-time application monitoring

### Backup & Recovery
- **Database Backups**: Automated daily backups
- **Configuration Backups**: Environment and settings backup
- **Disaster Recovery**: Documented recovery procedures
- **Testing**: Regular backup restoration testing

## Integration Points

### Third-party Services
- **Google Custom Search**: Product discovery and search
- **OpenAI GPT-4**: AI-powered content analysis
- **Affiliate Networks**: Revenue generation partnerships
- **Email Services**: User notifications and alerts
- **Analytics Platforms**: User behavior tracking

### Internal APIs
- **Product Management**: CRUD operations for products
- **User Management**: Authentication and profile management
- **Forum System**: Community features and moderation
- **Admin Dashboard**: System management and analytics
- **Affiliate Management**: Revenue optimization tools

This architecture provides a scalable, secure, and maintainable foundation for the AI-powered price comparison platform with automated revenue generation capabilities.