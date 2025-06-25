# Product Price Comparison Platform

## Overview

This is a full-stack web application for comparing product prices across multiple retailers. The application allows users to search for products, filter results by various criteria, and compare prices from different retailers in a single interface. It features a modern React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration.

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
RESTful API with the following endpoints:
- `GET /api/retailers` - Retrieve all active retailers
- `GET /api/products/search` - Search products with advanced filtering options

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
- **ProductCard**: Individual product display with offer details
- **ComparisonModal**: Side-by-side product comparison feature

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

- June 25, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.