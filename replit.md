# Product Price Comparison Platform

## Overview

This is a full-stack web application designed for comparing product prices across multiple retailers, featuring integrated community forum functionality and a comprehensive administrative dashboard. The platform enables users to search for products, filter results, compare prices, and engage in discussions about products and deals. It includes a modern React frontend with shadcn/ui, an Express.js backend with PostgreSQL, embedded forum capabilities, and an interactive analytics dashboard. The project aims to provide a robust, AI-powered solution for consumers to find the best deals and for administrators to manage the platform effectively.

## User Preferences

Preferred communication style: Simple, everyday language.

Architectural Change Policy: All major architectural changes must be approved through the documented process in BUILD_PLAN.md before implementation. This includes database schema changes, new API endpoints, dependency updates, and security modifications.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS v4 with native Vite plugin and CSS-based theme configuration
- **State Management**: TanStack Query (React Query)
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database ORM**: Drizzle ORM with PostgreSQL

### AI-Powered Scraping System
- **Multi-Agent Architecture**: Coordination, Discovery, Search Orchestration, Data Extraction, and Price Monitoring agents.
- **AI Integration**: OpenAI GPT-4o-mini for trend analysis, product categorization, and search optimization.
- **Job Queue System**: Priority-based task management with retry logic.
- **Anti-Detection Measures**: Rotating user agents, random delays, and rate limiting.
- **Real-Time Monitoring**: Price change detection with alerts.

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM.
- **Schema Management**: Drizzle Kit for migrations.

### API Structure
A RESTful API supports core application features, administrative functions, AI-powered scraping, and enhanced search capabilities. Key API categories include:
- **Core Application APIs**: For product search, authentication, forum management, and price alerts.
- **Admin Dashboard APIs**: For analytics and platform management.
- **AI-Powered Scraping & Price Monitoring APIs**: To control and monitor the scraping agents and data extraction.
- **Enhanced Search APIs**: For advanced product search, suggestions, and AI-powered query analysis.

### Enhanced Search and Filtering
- **Smart Search Mode**: AI-powered semantic search with fuzzy matching and intent detection using OpenAI's `text-embedding-3-small`.
- **Comprehensive Filtering**: Category, price range, retailer, rating, and availability filters.
- **Advanced Sorting**: Price, rating, popularity, and relevance.

### User Interface Components
The UI utilizes shadcn/ui components for a consistent design, including an `EnhancedSearchHeader`, `AdvancedSearch` page, `FilterSidebar`, `ProductGrid`, `ComparisonModal`, `EmbeddedForum`, `AdminDashboard`, and `AnalyticsCharts`. Components are optimized for performance with lazy loading and virtual scrolling where appropriate.

### Data Flow
- **User-Initiated Product Search**: Frontend requests `/api/products/search`, backend queries the database, and results are displayed using React Query.
- **AI-Powered Automated Pipeline**: AI agents discover trends, orchestrate searches via Google Custom Search, extract data from retailer URLs, store data, and continuously monitor prices.

## External Dependencies

### UI and Styling
- Radix UI primitives
- Tailwind CSS
- Lucide React
- class-variance-authority

### Data and API
- TanStack Query
- Drizzle ORM
- Zod
- React Hook Form

### Official Retailer APIs
- Amazon Product Advertising API (PA-API 5.0)
- Walmart Open API
- Best Buy API
- Target Partner API

### AI Services
- Google Custom Search API
- OpenAI GPT-4o-mini
- OpenAI Embeddings (`text-embedding-3-small`)

### Development Tools
- Vite
- TypeScript
- ESBuild
- tsx