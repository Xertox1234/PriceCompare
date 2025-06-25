# Insightify - System Architecture Documentation

## Overview
Insightify is a comprehensive price comparison platform that enables users to search, filter, and compare product prices across multiple retailers. The system is built with accessibility-first principles and follows modern web development practices.

## Architecture Principles

### Core Design Philosophy
- **Accessibility First**: WCAG 2.1 AA compliance with semantic HTML, ARIA labels, and keyboard navigation
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

### Accessibility Features
- Skip navigation links
- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Reduced motion preferences

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