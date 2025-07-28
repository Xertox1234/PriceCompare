# Price Comparison Platform - Download Package

## Project Overview
This is a complete price comparison platform with AI-powered search capabilities, built with React 18, Express.js, and PostgreSQL. The application features modern UI components, advanced search functionality, and comprehensive administrative tools.

## Package Contents

### Core Application Files
- `client/` - React frontend application with TypeScript
- `server/` - Express.js backend with API routes
- `shared/` - Shared types and database schema
- `docs/` - Comprehensive documentation suite

### Configuration Files
- `package.json` - Project dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration
- `drizzle.config.ts` - Database ORM configuration
- `components.json` - shadcn/ui component configuration

### Documentation
- `replit.md` - Main project documentation and architecture
- `BUILD_PLAN.md` - Development roadmap and MVP requirements
- `FEATURE_ROADMAP.md` - Future feature planning
- `design_overview.md` - UI/UX design specifications
- `css_migration.md` - Tailwind CSS v4 migration details

### Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Configure DATABASE_URL for PostgreSQL
   - Add API keys for Google Custom Search and OpenAI (optional)

3. **Database Setup**
   ```bash
   npm run db:push
   ```

4. **Development Server**
   ```bash
   npm run dev
   ```

5. **Production Build**
   ```bash
   npm run build
   npm run start
   ```

## Technology Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack Query
- **Build Tool**: Vite
- **AI Integration**: OpenAI GPT-4, Google Custom Search API

## Key Features
- AI-powered product search with semantic matching
- Real-time price comparison across multiple retailers
- Community forum with discussion threads
- Administrative dashboard with analytics
- Responsive design with dark/light theme support
- Advanced filtering and sorting capabilities

## Current Status
- Core MVP functionality complete
- All accessibility features removed per user requirements
- Documentation cleaned and aligned with current codebase
- Application ready for production deployment

For detailed setup and deployment instructions, see the documentation in the `docs/` folder.