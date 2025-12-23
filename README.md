# PriceCompare

A full-stack price comparison platform with AI-powered product discovery, web scraping, price tracking, and community features.

## 🚀 Features

- **AI-Powered Product Discovery**: Google Custom Search + OpenAI for intelligent product finding
- **Automated Price Tracking**: Playwright-based web scraping with scheduled snapshots
- **Price Alerts**: Smart notifications when prices drop below target thresholds
- **Community Features**: Deal spotting, product reviews, and discussions
- **Chrome Extension**: Real-time price monitoring while browsing
- **Advanced Search**: Semantic search with vector embeddings
- **Watchlists**: Track multiple products with customizable alert preferences
- **Real-time Updates**: WebSocket-powered live notifications
- **Price Analytics**: Historical trends, aggregations, and forecasting

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Cache/Sessions**: Redis (ioredis + redis package)
- **Authentication**: Passport.js with local strategy
- **Browser Automation**: Playwright (Chromium)
- **Job Queues**: Bull with Redis
- **AI/ML**: OpenAI API (GPT-4o-mini, text-embedding-3-small)
- **Error Tracking**: Sentry
- **Testing**: Vitest + Supertest + Playwright

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query (TanStack Query)
- **Charts**: Recharts
- **UI Components**: Custom design system with shadcn/ui
- **Testing**: React Testing Library + Vitest

### Infrastructure
- **Type Safety**: TypeScript (strict mode)
- **Code Quality**: ESLint (zero warnings tolerance) + Prettier
- **Git Hooks**: Pre-commit validation (TypeScript, ESLint, security checks)
- **CI/CD**: GitHub Actions
- **Session Store**: connect-redis v9
- **Distributed Locking**: Redis-based job coordination

## 📋 Prerequisites

- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher
- **Redis**: 7.x or higher (MANDATORY in production)
- **Git**: For version control

## 🏁 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/PriceCompare.git
cd PriceCompare
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/pricecompare

# Redis (MANDATORY in production)
REDIS_URL=redis://localhost:6379

# Security Secrets (generate with: openssl rand -base64 32)
SESSION_SECRET=your-session-secret-min-32-chars
CSRF_SECRET=your-csrf-secret-min-32-chars
ENCRYPTION_KEY=your-encryption-key-64-chars

# OpenAI (optional - for AI features)
OPENAI_API_KEY=sk-...

# Sentry (optional - for error tracking)
SENTRY_DSN=https://...
```

### 4. Database Setup

```bash
# Create database
createdb pricecompare

# Run migrations
npm run migrate
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:5000/api

## 📖 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive development guide for Claude Code
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design decisions
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines and development workflow
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and security updates

### Pattern Documentation (docs/)

- **[TypeScript Patterns](docs/01_TYPESCRIPT_PATTERNS.md)** - Type safety, async/await, Zod integration
- **[Database Patterns](docs/02_DATABASE_PATTERNS.md)** - N+1 prevention, transactions, schema design
- **[API Patterns](docs/03_API_PATTERNS.md)** - Routes, middleware, testing
- **[Security Patterns](docs/04_SECURITY_PATTERNS.md)** - Auth, CSRF, validation
- **[Frontend Patterns](docs/05_FRONTEND_PATTERNS.md)** - React, React Query, forms
- **[Error Handling Patterns](docs/06_ERROR_HANDLING_PATTERNS.md)** - Error responses, sanitization
- **[Background Jobs Patterns](docs/07_BACKGROUND_JOBS_PATTERNS.md)** - Bull queues, cron jobs
- **[Testing Patterns](docs/08_TESTING_PATTERNS.md)** - Vitest, integration tests, E2E

### Additional Resources

- **[API Documentation](docs/API_DOCUMENTATION.md)** - Complete API endpoint reference
- **[Component Guide](docs/COMPONENT_GUIDE.md)** - React component architecture
- **[Deployment Guide](docs/deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Redis Requirements](REDIS_PRODUCTION_REQUIREMENT.md)** - Redis setup and production requirements

## 🧪 Testing

```bash
# Run all unit/integration tests
npm test

# Run specific test file
npm test path/to/test.test.ts

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run E2E tests (browser automation)
npm run test:e2e
npm run test:e2e:headed  # With visible browser
npm run test:e2e:ui      # Interactive UI mode
```

## 🔍 Code Quality

```bash
# TypeScript type checking
npm run check

# ESLint (zero warnings tolerance)
npm run lint
npm run lint:fix

# Prettier formatting
npm run format
npm run format:check

# Security audit
npm run security:full
```

## 🏗️ Building for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🚨 Important Notes

### Redis in Production
- Redis is **MANDATORY** in production environments
- Application will **EXIT ON STARTUP** if `REDIS_URL` is not configured
- Used for: rate limiting, session storage, distributed locking, caching
- See [REDIS_PRODUCTION_REQUIREMENT.md](REDIS_PRODUCTION_REQUIREMENT.md) for details

### Pre-Commit Hooks
- Automated code review checks run on every commit
- Blocks commits with TypeScript errors, ESLint errors, or security issues
- Enforces: no `any` types, no `console.log`, proper CSRF protection, transaction boundaries
- See [Pre-Commit Hook Patterns](docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md) for details

### Browser Automation
- **ONLY Playwright is used** for all browser automation and E2E testing
- Puppeteer is NOT used in this project
- All scrapers use `@playwright/test` package

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup and workflow
- Code standards and patterns
- Testing requirements
- Pull request process
- Code review checklist

## 📝 License

[Your License Here]

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- UI powered by [React 19](https://react.dev/)
- Database managed by [Drizzle ORM](https://orm.drizzle.team/)
- Browser automation by [Playwright](https://playwright.dev/)
- AI capabilities by [OpenAI](https://openai.com/)
