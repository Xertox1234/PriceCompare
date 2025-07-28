# Project File Structure

## Complete Package Contents (1.8MB, 124 source files, 25 documentation files)

```
price-comparison-platform/
├── README.md                           # Main project overview
├── INSTALLATION_GUIDE.md               # Setup instructions
├── FILE_STRUCTURE.md                   # This file
├── package.json                        # Dependencies and scripts
├── package-lock.json                   # Lock file for dependencies
├── tsconfig.json                       # TypeScript configuration
├── vite.config.ts                      # Vite build configuration
├── drizzle.config.ts                   # Database ORM configuration
├── components.json                     # shadcn/ui component configuration
├── .env.example                        # Environment variables template
├── .gitignore                          # Git ignore patterns
├── replit.md                           # Main project documentation
├── BUILD_PLAN.md                       # Development roadmap
├── FEATURE_ROADMAP.md                  # Future features planning
├── CODE_REVIEW_REPORT.md               # Code quality analysis
├── MERGE_SUMMARY.md                    # Recent changes summary
├── design_overview.md                  # UI/UX design specifications
├── css_migration.md                    # Tailwind CSS v4 migration
│
├── client/                             # Frontend React Application
│   ├── src/
│   │   ├── App.tsx                     # Main React application
│   │   ├── main.tsx                    # Application entry point
│   │   ├── index.css                   # Global styles and Tailwind CSS
│   │   │
│   │   ├── components/                 # React Components (62 files)
│   │   │   ├── ui/                     # shadcn/ui components
│   │   │   ├── auth/                   # Authentication components
│   │   │   ├── forum/                  # Forum system components
│   │   │   ├── lazy/                   # Lazy-loaded components
│   │   │   ├── optimized/              # Performance-optimized components
│   │   │   ├── enhanced-search-header.tsx
│   │   │   ├── filter-sidebar.tsx
│   │   │   ├── product-grid.tsx
│   │   │   ├── product-card.tsx
│   │   │   ├── shared-navigation.tsx
│   │   │   └── [other components...]
│   │   │
│   │   ├── hooks/                      # Custom React Hooks (10 files)
│   │   │   ├── use-enhanced-products-search.ts
│   │   │   ├── use-advanced-search.ts
│   │   │   ├── use-auth.ts
│   │   │   ├── use-products.ts
│   │   │   └── [other hooks...]
│   │   │
│   │   ├── pages/                      # Page Components
│   │   │   ├── home.tsx                # Landing page
│   │   │   ├── products.tsx            # Product search page
│   │   │   ├── advanced-search.tsx     # Advanced search page
│   │   │   ├── forum.tsx               # Community forum
│   │   │   ├── admin.tsx               # Admin dashboard
│   │   │   └── not-found.tsx           # 404 page
│   │   │
│   │   ├── lib/                        # Utility Libraries
│   │   │   ├── queryClient.ts          # TanStack Query configuration
│   │   │   └── utils.ts                # Helper functions
│   │   │
│   │   ├── contexts/                   # React Contexts
│   │   ├── utils/                      # Utility functions
│   │   └── test/                       # Testing utilities
│
├── server/                             # Backend Express Application (30 files)
│   ├── index.ts                        # Server entry point
│   ├── db.ts                           # Database connection
│   ├── auth.ts                         # Authentication middleware
│   ├── routes.ts                       # Main API routes
│   ├── storage.ts                      # Data storage interface
│   ├── validation.ts                   # Request validation
│   ├── vite.ts                         # Vite development integration
│   │
│   ├── agents/                         # AI Agent System
│   │   ├── base-agent.ts              # Base agent class
│   │   ├── coordinator-agent.ts       # Multi-agent coordination
│   │   ├── discovery-agent.ts         # Product discovery
│   │   ├── extraction-agent.ts        # Data extraction
│   │   ├── monitoring-agent.ts        # Price monitoring
│   │   ├── search-agent.ts            # Search orchestration
│   │   └── affiliate-agent.ts         # Affiliate link generation
│   │
│   ├── services/                      # Business Logic Services
│   │   ├── advanced-search.ts         # AI-powered search
│   │   ├── google-search.ts           # Google Custom Search API
│   │   ├── hybrid-data-collector.ts   # Data collection orchestration
│   │   ├── affiliate-link-service.ts  # Affiliate link management
│   │   └── product-discovery-fallback.ts
│   │
│   ├── middleware/                    # Express Middleware
│   │   └── cache.ts                   # Caching middleware
│   │
│   ├── utils/                         # Server Utilities
│   │   └── scraper-utils.ts           # Web scraping utilities
│   │
│   ├── scrapers/                      # Web Scrapers
│   ├── ai-models/                     # AI Model Configurations
│   ├── advanced-search-routes.ts      # Advanced search endpoints
│   ├── scraping-routes.ts             # Scraping API endpoints
│   ├── affiliate-routes.ts            # Affiliate management APIs
│   ├── hybrid-data-routes.ts          # Hybrid data collection APIs
│   ├── enhanced-forum-routes.ts       # Forum API endpoints
│   ├── enhanced-forum-storage.ts      # Forum data management
│   ├── forum-storage.ts               # Forum storage interface
│   ├── discourse-routes.ts            # Discourse integration
│   └── discourse-sso.ts               # Single sign-on for Discourse
│
├── shared/                            # Shared Code
│   └── schema.ts                      # Database schema and types
│
└── docs/                              # Documentation Suite (16 files)
    ├── README.md                      # Documentation index
    ├── ARCHITECTURE.md                # System architecture
    ├── API_DOCUMENTATION.md           # API reference
    ├── COMPONENT_GUIDE.md             # Component documentation
    ├── PERFORMANCE_GUIDE.md           # Performance optimization
    ├── DEPLOYMENT_GUIDE.md            # Production deployment
    ├── AGENT_SYSTEM_REVIEW.md         # AI agent system analysis
    ├── LINK_GENERATION.md             # Affiliate link system
    ├── AFFILIATE_MANAGEMENT_GUIDE.md  # Affiliate program management
    ├── API_ENDPOINTS_REFERENCE.md     # Complete API reference
    ├── API_INTEGRATION_STRATEGY.md    # API integration approach
    ├── SYSTEM_ARCHITECTURE_OVERVIEW.md # High-level architecture
    ├── DISCOURSE_INTEGRATION_PLAN.md  # Forum integration plan
    ├── DISCOURSE_DEPLOYMENT_GUIDE.md  # Discourse setup guide
    ├── scraping_plan.md               # Web scraping strategy
    └── google_search_setup.md         # Google API setup guide
```

## Key Features Included

### Core Application
- ✅ AI-powered product search with semantic matching
- ✅ Real-time price comparison across multiple retailers
- ✅ Advanced filtering and sorting capabilities
- ✅ Responsive design with dark/light theme support

### Technical Infrastructure
- ✅ React 18 with TypeScript and modern hooks
- ✅ Express.js backend with PostgreSQL database
- ✅ Tailwind CSS v4 with native Vite plugin
- ✅ TanStack Query for state management
- ✅ Drizzle ORM for database operations

### Advanced Features
- ✅ Multi-agent AI system for automated data collection
- ✅ Google Custom Search API integration
- ✅ OpenAI GPT-4 powered search analysis
- ✅ Affiliate link generation and management
- ✅ Community forum with discussion threads
- ✅ Administrative dashboard with analytics

### Quality Assurance
- ✅ Comprehensive documentation suite
- ✅ Type-safe development environment
- ✅ Performance optimized components
- ✅ Modern web standards compliance
- ✅ Production-ready deployment configuration

This package contains everything needed to run, modify, and deploy the price comparison platform.