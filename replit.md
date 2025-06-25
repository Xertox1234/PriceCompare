# Product Price Comparison Platform

## Overview

This is a full-stack web application for comparing product prices across multiple retailers with integrated community forum functionality and comprehensive administrative dashboard. The application allows users to search for products, filter results by various criteria, compare prices from different retailers, and engage in community discussions about products and deals. Features include a modern React frontend with shadcn/ui components, an Express.js backend with PostgreSQL database integration, embedded forum capabilities, and interactive analytics dashboard with real-time data visualization for administrators.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for API endpoints
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Development**: tsx for TypeScript execution in development
- **Production**: esbuild for server bundling

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Development Storage**: In-memory storage implementation for development/testing
- **Schema Management**: Drizzle Kit for migrations and schema management

## Key Components

### Database Schema
Three main entities with relationships:
- **Retailers**: Store information about retail partners (name, logo, website, active status)
- **Products**: Product catalog with metadata (name, description, category, brand, model)
- **Product Offers**: Price and availability data linking products to retailers

### API Structure
RESTful API with comprehensive endpoints:
- `GET /api/retailers` - Retrieve all active retailers
- `GET /api/products/search` - Search products with advanced filtering options
- `POST /api/auth/register` - User registration with validation
- `POST /api/auth/login` - User authentication
- `GET /api/auth/user` - Current user session with role refresh
- `POST /api/auth/logout` - User logout
- `GET /api/forum/categories` - Forum categories
- `GET /api/forum/topics` - Forum topics with filtering
- `POST /api/forum/topics` - Create new discussion topics
- `GET /api/forum/topics/:id/posts` - Retrieve posts for a topic
- `POST /api/forum/posts` - Create new forum posts
- `POST /api/price-alerts` - Create price alerts with community notifications
- `GET /api/admin/analytics/overview` - Dashboard overview metrics
- `GET /api/admin/analytics/user-growth` - User registration growth data
- `GET /api/admin/analytics/forum-activity` - Daily forum post activity
- `GET /api/admin/analytics/top-categories` - Category performance analytics
- `GET /api/admin/categories` - Admin forum category management
- `GET /api/admin/users` - Admin user management with roles

### Search and Filtering
Comprehensive filtering system supporting:
- Text-based product search
- Category filtering
- Price range filtering
- Retailer-specific filtering
- Rating-based filtering
- Availability status filtering
- Sorting by price, rating, and popularity

### User Interface Components
- **SearchHeader**: Main search interface with branded header
- **FilterSidebar**: Advanced filtering controls
- **ProductGrid**: Responsive product display with price comparison
- **ProductCard**: Individual product display with offer details and discussion links
- **ComparisonModal**: Side-by-side product comparison feature
- **SharedNavigation**: Unified navigation with authentication controls and role-based admin access
- **AuthModal**: Login and registration modal with form validation
- **EmbeddedForum**: Complete forum system with topics, posts, and categories
- **PriceAlertButton**: Community price alert creation and sharing
- **AdminDashboard**: Interactive analytics dashboard with real-time charts
- **AdminPanel**: Comprehensive administrative interface with tabbed organization
- **AnalyticsCharts**: Recharts-powered data visualization components

## Data Flow

1. **User Search**: Users enter search queries through the SearchHeader component
2. **API Request**: Frontend sends filtered requests to `/api/products/search`
3. **Data Processing**: Backend processes filters and queries the database
4. **Response Handling**: Results are cached and displayed using React Query
5. **Comparison**: Users can add products to comparison modal for side-by-side analysis

## External Dependencies

### UI and Styling
- Radix UI primitives for accessible components
- Tailwind CSS for utility-based styling
- Lucide React for consistent iconography
- class-variance-authority for component variants

### Data and API
- TanStack Query for server state management
- Drizzle ORM for type-safe database operations
- Zod for runtime type validation
- React Hook Form with resolvers for form handling

### Development Tools
- Vite with React plugin for fast development
- TypeScript for type safety
- ESBuild for production bundling
- tsx for TypeScript execution

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with hot reload via tsx
- **Database**: PostgreSQL 16 (managed by Replit)
- **Port Configuration**: Application runs on port 5000
- **Environment**: Replit-optimized with cartographer plugin for development

### Production Build
- **Frontend**: Vite builds optimized React bundle to `dist/public`
- **Backend**: ESBuild bundles server code to `dist/index.js`
- **Deployment**: Autoscale deployment target on Replit
- **Process**: npm run build followed by npm run start

### Database Management
- **Migrations**: Drizzle Kit manages schema migrations in `/migrations`
- **Connection**: Uses DATABASE_URL environment variable
- **Development**: `npm run db:push` for schema synchronization

## Changelog

### June 25, 2025
- **Type Safety Improvements Complete**: Comprehensive TypeScript type system enhancements
  - ✅ Created centralized type definitions in `shared/types.ts`
  - ✅ Added proper generic typing for API requests and responses
  - ✅ Enhanced form handling with strict mutation types (LoginFormData, RegisterFormData)
  - ✅ Implemented AuthenticatedRequest interface for server routes
  - ✅ Fixed all import statements to use type-only imports where appropriate
  - ✅ Added comprehensive analytics data types (AnalyticsOverview, UserGrowthData, etc.)
  - ✅ Enhanced error handling with proper Error types instead of 'any'
  - ✅ Improved component prop interfaces with strict typing
  - ✅ Updated all admin API endpoints with proper request/response typing

- **Admin Dashboard with Interactive Charts Complete**: Successfully implemented comprehensive analytics dashboard
  - ✅ Interactive charts using Recharts library for data visualization
  - ✅ Real-time metrics cards showing total users, topics, posts, and categories
  - ✅ User growth trend analysis with responsive line charts
  - ✅ Forum activity visualization with interactive bar charts
  - ✅ Top categories performance analytics with horizontal bar charts
  - ✅ Dashboard accessible as primary tab in admin panel
  - ✅ All charts display live data from PostgreSQL database
  - ✅ Responsive design adapting to different screen sizes
  - ✅ Backend analytics endpoints with proper SQL aggregations

- **Admin Panel Infrastructure Complete**: Unified administrative interface
  - ✅ Role-based access control with admin authentication
  - ✅ Admin panel accessible through profile dropdown for authorized users
  - ✅ Tabbed interface for Dashboard, Overview, Products, Retailers, Forum Categories, Users, Settings
  - ✅ User management with role assignments and account status controls
  - ✅ Forum category management with creation and editing capabilities
  - ✅ Platform settings configuration interface

- **Embedded Forum Integration Complete**: Successfully implemented Replit-optimized forum system
  - ✅ Shared authentication system with Passport.js and Express sessions
  - ✅ PostgreSQL database schema with users, forum categories, topics, and posts
  - ✅ React-based embedded forum components with consistent design
  - ✅ Product discussion linking and price alert community features
  - ✅ User registration and login working seamlessly
  - ✅ Forum topic creation and discussion functionality
  - ✅ Shared navigation between Products and Forum pages

- **Architecture Decisions**: Chose embedded React approach over containerization
  - Simplified deployment within Replit constraints
  - Maintained consistent UI/UX with shadcn/ui components
  - Integrated authentication without external SSO complexity

### December 25, 2024
- **Architecture Documentation**: Created comprehensive documentation suite
  - System architecture and design principles
  - API documentation with full endpoint specifications
  - Component guide with props and usage patterns
  - Accessibility implementation guide (WCAG 2.1 AA)
  - Build plan with MVP roadmap and approval processes

- **Architectural Governance**: Established change management process
  - Approval required for database, API, infrastructure, and security changes
  - Five-phase approval process: Proposal → Review → Approval → Implementation → Deployment
  - Quality gates for code, testing, and documentation

- **MVP Status**: Core functionality completed
  - Product search and comparison working
  - Accessibility compliance implemented
  - Responsive design with shadcn/ui components
  - Ready for production database integration

## Feature Development

### Current Status
**Phase 3 Complete**: Core platform, community features, admin analytics dashboard, type safety improvements, and performance optimizations are fully implemented and operational.

### Next Priority
**Phase 4 - Enhanced Features**: Focus on product reviews & ratings, price history tracking, advanced search capabilities, and recommendation engine.

### Performance Metrics
- **Bundle Splitting**: Reduced initial bundle size with lazy loading
- **Caching**: 5-minute query cache, 1-hour retailer cache, stale-while-revalidate
- **Database**: Optimized queries with early returns and indexed searches
- **Images**: Lazy loading with intersection observer
- **Search**: 300ms debounced queries to reduce server load

### Feature Roadmap
Complete feature roadmap and development phases are documented in `FEATURE_ROADMAP.md`.

## User Preferences

Preferred communication style: Simple, everyday language.

**Architectural Change Policy**: All major architectural changes must be approved through the documented process in BUILD_PLAN.md before implementation. This includes database schema changes, new API endpoints, dependency updates, and security modifications.