# Installation Guide

## Prerequisites
- Node.js 20 or higher
- PostgreSQL 16 or higher
- npm or yarn package manager

## Quick Setup

### 1. Install Dependencies
```bash
cd price-comparison-platform
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/price_comparison"

# Optional API Keys for Enhanced Features
GOOGLE_CUSTOM_SEARCH_API_KEY="your_google_api_key"
GOOGLE_CUSTOM_SEARCH_ENGINE_ID="your_search_engine_id"
OPENAI_API_KEY="your_openai_api_key"

# Session Configuration
SESSION_SECRET="your_secure_session_secret"

# Application Settings
NODE_ENV="development"
PORT=5000
```

### 3. Database Setup
```bash
# Push schema to database
npm run db:push

# Verify database connection
npm run check
```

### 4. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Production Deployment

### 1. Build Application
```bash
npm run build
```

### 2. Start Production Server
```bash
npm run start
```

## Database Schema
The application uses Drizzle ORM with the following main tables:
- `retailers` - Store information and affiliate configurations
- `products` - Product catalog with metadata
- `product_offers` - Price data and availability
- `users` - User authentication and profiles
- `forum_categories` - Discussion categories
- `forum_topics` - Discussion threads
- `forum_posts` - User posts and replies

## API Endpoints
Core endpoints include:
- `GET /api/products/search` - Product search with filters
- `GET /api/retailers` - Active retailer list
- `POST /api/auth/login` - User authentication
- `GET /api/forum/categories` - Forum categories
- `POST /api/forum/topics` - Create discussions

## Troubleshooting

### Common Issues
1. **Database Connection Errors**: Verify DATABASE_URL is correct
2. **Port Already in Use**: Change PORT in .env file
3. **Missing Dependencies**: Run `npm install` again
4. **Build Failures**: Check TypeScript errors with `npm run check`

### Performance Optimization
- Enable Redis for session storage in production
- Configure CDN for static assets
- Set up database connection pooling
- Enable compression middleware

For detailed documentation, see the `docs/` folder.