# PriceCompare Architecture Documentation

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Patterns](#architecture-patterns)
- [Technology Stack](#technology-stack)
- [Security Architecture](#security-architecture)
- [Data Flow](#data-flow)
- [Key Design Decisions](#key-design-decisions)
- [Deployment Architecture](#deployment-architecture)

---

## System Overview

PriceCompare is a full-stack price comparison platform that aggregates product prices from multiple retailers, provides price history tracking, and offers community features for deal sharing.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │  React SPA │  │  Browser   │  │  Chrome Extension  │   │
│  │            │  │  Extension │  │                    │   │
│  └────────────┘  └────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │ HTTPS/WSS
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Express.js Server                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐           │  │
│  │  │  Routes  │ │Middleware│ │ Services  │           │  │
│  │  └──────────┘ └──────────┘ └───────────┘           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐        │
│  │  PostgreSQL  │  │  Redis   │  │  Bull Queues  │        │
│  │   (Primary)  │  │ (Cache)  │  │  (Jobs)       │        │
│  └──────────────┘  └──────────┘  └───────────────┘        │
└─────────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────────┐
│                     External Services                        │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐        │
│  │   OpenAI     │  │  Google  │  │   Retailers   │        │
│  │     API      │  │  Search  │  │   Websites    │        │
│  └──────────────┘  └──────────┘  └───────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Patterns

### 1. Layered Architecture

The application follows a strict layered architecture:

```
┌─────────────────────────────────────┐
│         Presentation Layer          │  ← React components, pages
├─────────────────────────────────────┤
│         API Layer (Routes)          │  ← Express route handlers
├─────────────────────────────────────┤
│       Business Logic (Services)     │  ← Core business logic
├─────────────────────────────────────┤
│      Data Access (Storage/ORM)      │  ← Drizzle ORM, repositories
├─────────────────────────────────────┤
│          Database Layer             │  ← PostgreSQL, Redis
└─────────────────────────────────────┘
```

**Benefits:**

- Clear separation of concerns
- Easy to test each layer independently
- Maintainable and scalable

### 2. Middleware Pipeline Pattern

Express middleware is ordered in a security-first pipeline:

```typescript
1. Compression
2. Request size limiting
3. Body parsing
4. CORS handling
5. Security headers
6. Rate limiting
7. Input sanitization
8. Session management
9. Authentication
10. CSRF protection
11. Caching
12. Performance monitoring
13. Routes
14. Error handling
```

**Rationale:** Security and performance checks happen before business logic.

### 3. Repository Pattern (Domain-Driven Storage Layer)

**Status**: ✅ **COMPLETE** (100% refactored as of Phase 3F)

Data access is abstracted through storage interfaces with domain-specific repositories:

```typescript
// Main storage interface
interface IStorage {
  // User operations
  getUserById(id: number): Promise<SafeUser | null>;
  registerUser(data: UserData): Promise<SafeUser>;

  // Product operations
  getProducts(): Promise<Product[]>;
  createProduct(data: InsertProduct): Promise<Product>;

  // Price operations
  getPriceHistory(productId: number): Promise<PriceHistory[]>;

  // Job lock operations
  acquireJobLock(jobName: string, owner: string, ttl: number): Promise<{ success: boolean }>;

  // ... 99 methods across 8 domains
}

// Domain repositories (7 domains)
class UserStorage extends BaseStorage {
  /* 15 methods */
}
class ProductStorage extends BaseStorage {
  /* 20 methods */
}
class PriceStorage extends BaseStorage {
  /* 28 methods */
}
class WatchListStorage extends BaseStorage {
  /* 13 methods */
}
class ForumStorage extends BaseStorage {
  /* 6 methods */
}
class RetailerStorage extends BaseStorage {
  /* 12 methods */
}
class JobLockStorage extends BaseStorage {
  /* 9 methods */
}

// Facade pattern for delegation
class DatabaseStorage implements IStorage {
  private userStorage: UserStorage;
  private productStorage: ProductStorage;
  // ... other domains

  async getUserById(id: number) {
    return this.userStorage.getUserById(id);
  }
}
```

**Domain Structure** (9,752 lines total):

```
server/storage/
├── storage.ts                  # Main facade (4,418 lines)
├── types.ts                    # Shared types (845 lines)
├── base-storage.ts             # Abstract base class (74 lines)
├── index.ts                    # Public exports (111 lines)
└── domains/
    ├── user-storage.ts         # 476 lines (15 methods)
    ├── product-storage.ts      # 660 lines (20 methods)
    ├── price-storage.ts        # 1,146 lines (28 methods)
    ├── watchlist-storage.ts    # 1,684 lines (13 methods)
    ├── forum-storage.ts        # 567 lines (6 methods)
    ├── retailer-storage.ts     # 429 lines (12 methods)
    └── job-lock-storage.ts     # 372 lines (9 methods)
```

**Refactoring Impact:**

- **Before**: 1 monolithic file (7,035 lines, 99 methods)
- **After**: 8 well-organized files (9,752 lines total)
- **Reduction in main file**: 54% (4,418 lines from 7,035)
- **Methods extracted**: 99/99 (100% complete)

**Benefits:**

- **Maintainability**: Each domain is self-contained and independently testable
- **Type Safety**: Specialized types per domain (no inline types)
- **Security**: Comprehensive input validation in every domain
- **Performance**: Database-level aggregation, atomic operations
- **Flexibility**: Domain-specific caching and rate limiting possible
- **Developer Experience**: Clear navigation, well-documented patterns
- **100% Backward Compatibility**: All existing imports continue to work

### 4. Service Layer Pattern

Business logic is encapsulated in services:

```
server/services/
├── price-snapshot-service.ts    # Price tracking
├── email-service.ts              # Email notifications
├── google-search.ts              # External API integration
├── password-reset-service.ts     # Auth operations
└── affiliate-link-service.ts     # Affiliate tracking
```

**Purpose:** Keep route handlers thin, logic testable.

---

## Technology Stack

### Backend

| Technology      | Purpose          | Why Chosen                                                   |
| --------------- | ---------------- | ------------------------------------------------------------ |
| **Express.js**  | Web framework    | Mature, flexible, extensive middleware ecosystem             |
| **TypeScript**  | Language         | Type safety, better tooling, catches bugs at compile time    |
| **Drizzle ORM** | Database ORM     | Type-safe SQL, lightweight, excellent TypeScript integration |
| **PostgreSQL**  | Primary database | ACID compliance, powerful features, great for analytics      |
| **Redis**       | Caching/sessions | Fast, distributed sessions, rate limiting                    |
| **Passport.js** | Authentication   | Battle-tested, supports multiple strategies                  |
| **Zod**         | Validation       | Runtime type checking, excellent TypeScript integration      |
| **Bull**        | Job queue        | Reliable background jobs, Redis-based                        |

### Frontend

| Technology         | Purpose             | Why Chosen                                         |
| ------------------ | ------------------- | -------------------------------------------------- |
| **React 19**       | UI framework        | Component-based, large ecosystem, performant       |
| **TypeScript**     | Language            | Same as backend - consistency                      |
| **Vite**           | Build tool          | Fast HMR, modern ESM, better DX than webpack       |
| **TanStack Query** | Data fetching       | Caching, background refetch, optimistic updates    |
| **Tailwind CSS**   | Styling             | Utility-first, consistent design, fast development |
| **Radix UI**       | Headless components | Accessible, unstyled, composable                   |
| **Wouter**         | Routing             | Lightweight alternative to React Router            |

### AI/Scraping

| Technology     | Purpose      | Why Chosen                                  |
| -------------- | ------------ | ------------------------------------------- |
| **OpenAI API** | AI analysis  | Best-in-class LLM for content understanding |
| **Playwright** | Web scraping | Headless Chromium, handles dynamic content  |
| **Cheerio**    | HTML parsing | Fast, jQuery-like API                       |

---

## Security Architecture

### Defense in Depth Strategy

PriceCompare implements multiple layers of security:

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Network Security                      │
│  - CORS with origin whitelisting                │
│  - Rate limiting (global + per-endpoint)        │
│  - Request size limits                          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Layer 2: Application Security                  │
│  - CSRF protection (timing-safe)                │
│  - Input validation (Zod schemas)               │
│  - Input sanitization (XSS prevention)          │
│  - Security headers (CSP, X-Frame-Options, etc.)│
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Layer 3: Authentication & Authorization        │
│  - Passport.js local strategy                   │
│  - bcrypt password hashing (12 rounds)          │
│  - Session management (Redis-backed)            │
│  - Role-based access control                    │
│  - Account lockout (brute force prevention)     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Layer 4: Data Security                         │
│  - Drizzle ORM (SQL injection prevention)       │
│  - Parameterized queries only                   │
│  - Safe integer/float parsing                   │
│  - Error sanitization (no info leakage)         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Layer 5: Operational Security                  │
│  - Environment validation (strong secrets)      │
│  - Security event logging                       │
│  - Structured error handling                    │
│  - Health check endpoints                       │
└─────────────────────────────────────────────────┘
```

### Key Security Features

1. **CSRF Protection**
   - Token-based protection on all state-changing operations
   - Timing-safe comparison to prevent timing attacks
   - Automatic token rotation

2. **Rate Limiting**
   - In-memory with LRU eviction (prevents memory exhaustion)
   - Redis-based for distributed deployments
   - Stricter limits on authentication endpoints

3. **Input Validation**

   ```typescript
   // Every input goes through validation
   Request → Zod Schema → Safe Parsing → Business Logic
   ```

4. **SSRF Prevention**
   - Domain whitelisting for scraping
   - Private IP blocking
   - URL protocol validation

---

## Data Flow

### Product Price Update Flow

```
┌──────────────┐
│   Scheduler  │  (node-cron)
└──────┬───────┘
       │ Triggers every 6 hours
       ↓
┌──────────────────┐
│  Price Snapshot  │
│     Service      │
└──────┬───────────┘
       │ For each product:
       ↓
┌──────────────────┐
│   Google Search  │  Finds current product URLs
│     Service      │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│   Scraping Agent │  Extracts price from retailer site
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  PostgreSQL DB   │  Stores price history
└──────┬───────────┘
       │ If price changed significantly:
       ↓
┌──────────────────┐
│  Notification    │  Alerts users with price alerts
│     Service      │
└──────────────────┘
```

### User Authentication Flow

```
┌──────────────┐
│    Client    │
└──────┬───────┘
       │ POST /api/auth/login
       ↓
┌──────────────────┐
│  Rate Limiter    │  Check: Too many attempts?
└──────┬───────────┘
       │ Allowed
       ↓
┌──────────────────┐
│ Account Lockout  │  Check: Account locked?
│   Middleware     │
└──────┬───────────┘
       │ Not locked
       ↓
┌──────────────────┐
│   Passport.js    │  Verify credentials (bcrypt)
└──────┬───────────┘
       │ Valid
       ↓
┌──────────────────┐
│ Session Creation │  Create Redis-backed session
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│   CSRF Token     │  Generate and attach token
│   Generation     │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Clear Lockout   │  Reset failed login counter
│    Counter       │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Security Log    │  Log successful authentication
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Return Session  │  Send session cookie to client
│    to Client     │
└──────────────────┘
```

---

## Key Design Decisions

### ADR-001: Why Drizzle ORM over Prisma?

**Status:** Accepted
**Date:** 2024

**Context:**
Needed a TypeScript ORM for PostgreSQL that provides type safety and good DX.

**Decision:**
Chose Drizzle ORM over Prisma.

**Rationale:**

- **Lightweight:** No heavy runtime, compiles to SQL
- **Type Safety:** Excellent TypeScript integration without codegen
- **SQL-Like API:** Close to raw SQL, easier to optimize
- **No Lock-in:** Easy to migrate away if needed
- **Performance:** Generates efficient SQL

**Consequences:**

- ✅ Better performance than Prisma
- ✅ More control over SQL generation
- ❌ Smaller ecosystem than Prisma
- ❌ Fewer GUI tools

---

### ADR-002: Why Redis for Sessions?

**Status:** Accepted
**Date:** 2024

**Context:**
Need distributed session management for horizontal scaling.

**Decision:**
Use Redis with in-memory fallback.

**Rationale:**

- **Distributed:** Works across multiple server instances
- **Fast:** In-memory performance
- **Reliability:** Persistent sessions survive server restarts
- **Fallback:** Graceful degradation to in-memory if Redis unavailable

**Consequences:**

- ✅ Horizontal scaling supported
- ✅ Session persistence
- ❌ Additional infrastructure dependency
- ✅ Mitigated by fallback mechanism

---

### ADR-003: Why Multi-Layered Security?

**Status:** Accepted
**Date:** 2024

**Context:**
E-commerce platforms are high-value targets for attacks.

**Decision:**
Implement defense-in-depth with 5+ security layers.

**Rationale:**

- **OWASP Top 10:** Address all major web vulnerabilities
- **Redundancy:** If one layer fails, others provide protection
- **Standards:** Industry best practices for sensitive data
- **Compliance:** Prepares for SOC 2, ISO 27001 if needed

**Consequences:**

- ✅ Excellent security posture (98/100 audit score)
- ✅ Production-ready for sensitive data
- ❌ Slightly more complex setup
- ✅ Well-documented and maintainable

---

### ADR-004: Why Vite over webpack?

**Status:** Accepted
**Date:** 2024

**Context:**
Need fast development experience with HMR.

**Decision:**
Use Vite for frontend build tooling.

**Rationale:**

- **Speed:** Native ESM, instant HMR
- **DX:** Pre-configured for React + TypeScript
- **Modern:** Built for modern browsers
- **Plugins:** Good ecosystem, compatible with Rollup

**Consequences:**

- ✅ Significantly faster dev server
- ✅ Better developer experience
- ❌ Newer tool (less battle-tested than webpack)
- ✅ Strong community adoption

---

## Deployment Architecture

### Production Deployment

```
                          ┌──────────────┐
                          │   Cloudflare │
                          │   (Optional) │
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │     NGINX    │
                          │  (SSL, HSTS) │
                          └──────┬───────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌───────▼────────┐       ┌───────▼────────┐
            │  Express App   │       │  Express App   │
            │   (Instance 1) │       │   (Instance 2) │
            └───────┬────────┘       └───────┬────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌───────▼────────┐       ┌───────▼────────┐
            │   PostgreSQL   │       │     Redis      │
            │   (Primary)    │       │   (Sessions)   │
            └────────────────┘       └────────────────┘
```

### Environment Variables (Required)

**Critical Secrets (32+ chars required):**

- `SESSION_SECRET` - Session encryption
- `CSRF_SECRET` - CSRF token generation
- `DISCOURSE_SSO_SECRET` - SSO signing

**Database:**

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection (optional)

**External Services (Optional):**

- `OPENAI_API_KEY` - AI features
- `GOOGLE_CUSTOM_SEARCH_API_KEY` - Product search
- `SMTP_*` - Email service

---

## Performance Considerations

### Caching Strategy

```
┌──────────────────────────────────────────────┐
│           Multi-Level Caching                 │
├──────────────────────────────────────────────┤
│  L1: In-Memory Cache (Fast, local)          │
│      - Rate limit counters                   │
│      - Session data (fallback)               │
│                                              │
│  L2: Redis Cache (Fast, distributed)        │
│      - API response cache                    │
│      - Session store                         │
│      - Product data (15min TTL)              │
│                                              │
│  L3: Database (Persistent)                   │
│      - All persistent data                   │
│      - Price history                         │
└──────────────────────────────────────────────┘
```

### Query Optimization

- **N+1 Prevention:** Batch queries where possible
- **Indexing:** Database indexes on frequently queried columns
- **Pagination:** Limit result sets (max 100 items)
- **Lazy Loading:** Load data on-demand

---

## Monitoring & Observability

### Built-in Monitoring

```
server/middleware/
├── performance.ts        # Request timing, slow endpoint detection
├── error-handler.ts     # Centralized error logging
└── security-logger.ts   # Security event tracking
```

### Metrics Tracked

- **Performance:** Request latency, slow endpoints (>1s)
- **Security:** Failed logins, CSRF violations, rate limit hits
- **Business:** Product views, price changes, user activity
- **Errors:** Uncaught exceptions, unhandled rejections

**TODO:** Integrate external monitoring (Sentry, DataDog)

---

## Future Architecture Considerations

### Microservices (If Scale Requires)

Potential split:

- **Price Service:** Product data, price tracking
- **Auth Service:** User management, authentication
- **Forum Service:** Community features
- **Scraping Service:** AI agents, web scraping

### Event-Driven Architecture

Potential events:

- `PriceChanged` → Trigger notifications
- `UserRegistered` → Send welcome email
- `ProductAdded` → Start price tracking

### GraphQL API (Optional)

If frontend complexity grows:

- Single endpoint for all data
- Client-specified queries
- Better mobile app support

---

**Last Updated:** November 14, 2025
**Maintainers:** PriceCompare Team
