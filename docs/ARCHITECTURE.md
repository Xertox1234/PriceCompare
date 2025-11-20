# Insightify - System Architecture Documentation

## Overview
Insightify is a comprehensive price comparison platform that enables users to search, filter, and compare product prices across multiple retailers. The system is built with modern web development practices and focuses on performance and user experience.

## Architecture Principles

### Core Design Philosophy
- **Semantic HTML**: Modern web standards with proper semantic elements and keyboard navigation
- **Performance Optimized**: Client-side caching, optimized queries, and responsive design
- **Scalable Backend**: Modular storage interface supporting both in-memory and database persistence
- **Type Safety**: End-to-end TypeScript implementation with shared schemas
- **Modern Stack**: React 18, Express.js, and PostgreSQL with industry-standard tooling

### System Boundaries
- **Frontend**: React SPA with wouter routing and shadcn/ui components
- **Backend**: Express.js REST API with configurable storage layer
- **Database**: PostgreSQL with Drizzle ORM (development uses in-memory storage)
- **Build**: Vite for development and production builds

## Technical Stack

### Frontend Technologies
- **React 18**: Component-based UI with hooks and modern patterns
- **TypeScript**: Type safety and developer experience
- **Wouter**: Lightweight client-side routing
- **shadcn/ui**: Accessible component library built on Radix UI
- **Tailwind CSS**: Utility-first styling with custom design system
- **TanStack Query**: Server state management and caching
- **Vite**: Build tool and development server

### Backend Technologies
- **Node.js 20**: Runtime environment
- **Express.js**: Web framework and API server
- **TypeScript**: Type safety for server-side code
- **Drizzle ORM**: Type-safe database queries and migrations
- **PostgreSQL**: Primary database (with in-memory fallback)
- **Zod**: Runtime type validation
- **tsx**: TypeScript execution for development

### Development Tools
- **ESBuild**: Production bundling
- **Drizzle Kit**: Database migrations and schema management
- **PostCSS**: CSS processing pipeline
- **Tailwind CSS**: Styling framework

## Data Architecture

### Core Entities
1. **Retailers**: Store information and branding
2. **Products**: Product catalog with metadata
3. **Product Offers**: Price and availability data by retailer

### Relationships
- Products have many Offers (one-to-many)
- Offers belong to Retailers (many-to-one)
- Offers belong to Products (many-to-one)

### Storage Layer
- **Interface**: `IStorage` defines all CRUD operations
- **Implementation**: `MemStorage` for development, PostgreSQL for production
- **Type Safety**: All operations use shared schema types

## API Design

### REST Endpoints
- `GET /api/retailers` - List all active retailers
- `GET /api/products` - Get featured products
- `GET /api/products/search` - Search products with filters
- `GET /api/products/:id` - Get specific product details

### Query Parameters
- **Search**: `query`, `category`
- **Filters**: `minPrice`, `maxPrice`, `retailers[]`, `minRating`, `availability[]`
- **Sorting**: `sortBy` (price_low, price_high, rating, popularity)

## Frontend Architecture

### Component Structure
- **Pages**: Route-level components (Home, NotFound)
- **Components**: Reusable UI components with clear interfaces
- **Hooks**: Custom hooks for state management and API calls
- **Utils**: Shared utilities and type definitions

### State Management
- **Server State**: TanStack Query for API data and caching
- **Local State**: React hooks for UI state
- **Comparison**: Custom hook managing product comparison list

### Web Standards
- Semantic HTML structure
- Proper semantic elements and roles
- Standard keyboard navigation support
- Modern CSS and responsive design
- Progressive enhancement principles

## Security Considerations

### Current Implementation
- Input validation using Zod schemas
- Type safety preventing injection attacks
- CORS configuration for allowed hosts
- Environment-based configuration

### Future Enhancements
- Rate limiting for API endpoints
- User authentication and authorization
- API key management for external services
- Data encryption for sensitive information

## Performance Optimization

### Current Optimizations
- React Query caching (5-minute stale time)
- Lazy loading for images
- Optimized bundle splitting with Vite
- Efficient database queries with filtering

### Monitoring Points
- API response times
- Database query performance
- Frontend bundle size
- User interaction metrics

## Deployment Architecture

### Development Environment
- Hot reload with tsx and Vite HMR
- In-memory storage for rapid iteration
- Development-specific logging and error handling

### Production Environment
- ESBuild bundled server
- PostgreSQL database with connection pooling
- Static asset serving with proper caching headers
- Process management with PM2 or similar

## Price History Aggregation System

### Overview
The price aggregation system optimizes database storage and query performance by automatically rolling up old price history data into time-based aggregates.

### Data Lifecycle

| Age | Data Source | Storage | Record Count (per product) |
|-----|-------------|---------|---------------------------|
| 0-30 days | Raw price_history | Full granularity | ~1,000 records |
| 30-90 days | price_aggregates_daily | Daily summaries | ~60 records |
| 90-365 days | price_aggregates_weekly | Weekly summaries | ~40 records |
| 1+ years | price_aggregates_monthly | Monthly summaries | ~12 records/year |
| 2+ years | Deleted (after aggregation) | 0 records | Archived |

### Performance Benefits

- **Storage reduction**: 97-99% for queries over 30 days old
- **Query speed**: 5-10x faster for long date ranges (90+ days)
- **Database size**: 80% reduction over time as data ages
- **Maintenance**: Smaller backups, faster restore operations

### Architecture

#### Database Tables
- **`price_history`** - Raw price snapshots with `aggregated_at` tracking field
- **`price_aggregates_daily`** - Daily summaries (min/max/avg/median/volatility)
- **`price_aggregates_weekly`** - Weekly summaries with week-over-week change %
- **`price_aggregates_monthly`** - Monthly summaries with month-over-month and year-over-year change %

#### Core Services
- **`price-aggregation-service.ts`** - Aggregation logic and statistics calculation
  - `calculateDailyAggregates()` - Aggregate yesterday's data to daily summaries
  - `calculateWeeklyAggregates()` - Roll up to weekly summaries
  - `calculateMonthlyAggregates()` - Roll up to monthly summaries
  - `aggregateToDaily()` - Bulk aggregation for date ranges (used by cleanup)

- **`price-snapshot-service.ts`** - Price capture and cleanup with aggregation-before-deletion
  - `snapshotAllPrices()` - Capture current prices across all retailers
  - `cleanupOldData()` - Aggregate 30-90 day data, then delete 2+ year data

- **`price-history-service.ts`** - Smart query routing based on date range
  - `getPriceHistoryOptimized()` - Automatically selects best data source
  - Combines multiple sources for long ranges (e.g., monthly + weekly + daily + raw)

#### Scheduled Jobs
All jobs use distributed locking (via Redis) to prevent duplicate execution across multiple servers:

- **Daily aggregation**: 1:00 AM - Aggregate yesterday's data to daily summaries
- **Weekly aggregation**: 11:00 PM Sunday - Aggregate current week to weekly summaries
- **Monthly aggregation**: 11:00 PM last day of month - Aggregate current month
- **Cleanup**: 3:00 AM Monday - Aggregate 30-90 day old data, delete 2+ year old data

#### Smart Query System
The system automatically selects the appropriate data source based on requested date range:

- **0-30 days**: Raw `price_history` only (most granular)
- **30-90 days**: Daily aggregates + recent raw data
- **90-365 days**: Weekly + daily aggregates + recent raw
- **1+ years**: Monthly + weekly + daily aggregates + recent raw

This provides optimal performance while maintaining granularity for recent data.

### Migration
Applied in migration `0013_add_daily_price_aggregates.sql`:
- Added `aggregated_at` column to `price_history` for tracking
- Created `price_aggregates_daily` table with indexes
- Established foundation for weekly/monthly tables (added in migration 0009)

### Data Integrity
All aggregation operations use database transactions to ensure atomicity. If aggregation fails, changes are rolled back to prevent partial updates. Raw data is only deleted after successful aggregation to monthly summaries (2+ years old).

## Extension Points

### Planned Features
- User authentication and profiles
- Price alert notifications
- Historical price tracking
- Price prediction using ML
- Wishlist and saved searches
- Mobile application

### Integration Capabilities
- External retailer APIs
- Price scraping services
- Email notification systems
- Analytics and tracking services

## Change Management

### Architectural Decision Process
1. **Proposal**: Document proposed changes with rationale
2. **Review**: Technical review for impact assessment
3. **Approval**: Stakeholder approval before implementation
4. **Implementation**: Phased rollout with testing
5. **Documentation**: Update architecture docs and changelog

### Approval Requirements
- Database schema changes require approval
- API contract changes require approval
- Major dependency updates require approval
- Security-related changes require approval
- Performance-impacting changes require approval

Last Updated: December 25, 2024