# Discourse Integration Plan
## Product Price Comparison Platform + Community Forum

### Executive Summary
This document outlines a comprehensive plan to integrate Discourse forum software with the existing product price comparison platform. The integration will create a unified community-driven platform where users can discuss products, share reviews, and engage in price comparison discussions while maintaining shared authentication and consistent design.

## Architecture Overview

### Current Application Stack
- **Frontend**: React 18 + TypeScript + shadcn/ui components
- **Backend**: Express.js + PostgreSQL + Drizzle ORM
- **Authentication**: Passport.js (configured but not actively used)
- **Deployment**: Replit with single port (5000) configuration

### Target Integration Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Reverse Proxy (Nginx)                   │
│                        Port 80/443                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼────────┐         ┌──────▼──────┐
│ Price Compare  │         │  Discourse  │
│   App (5000)   │         │   (3000)    │
│                │         │             │
│ React Frontend │◄────────┤ Ruby/Rails  │
│ Express API    │  Auth   │ Community   │
└────────────────┘  Sync   └─────────────┘
        │                           │
        └─────────────┬─────────────┘
                      │
              ┌───────▼────────┐
              │   PostgreSQL   │
              │  Shared Users  │
              │   & Sessions   │
              └────────────────┘
```

## Phase 1: Environment Setup & Containerization

### 1.1 Docker Configuration
Create containerized setup for both applications:

**docker-compose.yml**
```yaml
version: '3.8'
services:
  # Main price comparison app
  price-app:
    build: 
      context: .
      dockerfile: Dockerfile.app
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/price_db
      - DISCOURSE_URL=http://discourse:3000
      - DISCOURSE_API_KEY=${DISCOURSE_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  # Discourse forum
  discourse:
    image: discourse/discourse:latest
    ports:
      - "3000:80"
    environment:
      - DISCOURSE_HOSTNAME=localhost:3000
      - DISCOURSE_DB_HOST=postgres
      - DISCOURSE_DB_NAME=discourse_db
      - DISCOURSE_DB_USERNAME=discourse_user
      - DISCOURSE_DB_PASSWORD=${DISCOURSE_DB_PASSWORD}
      - DISCOURSE_REDIS_HOST=redis
      - DISCOURSE_SMTP_ADDRESS=${SMTP_ADDRESS}
      - DISCOURSE_SMTP_PORT=${SMTP_PORT}
      - DISCOURSE_SMTP_USER_NAME=${SMTP_USERNAME}
      - DISCOURSE_SMTP_PASSWORD=${SMTP_PASSWORD}
    depends_on:
      - postgres
      - redis
    volumes:
      - discourse-uploads:/var/www/discourse/public/uploads
      - discourse-backups:/var/www/discourse/public/backups
    networks:
      - app-network

  # Shared PostgreSQL
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=price_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    networks:
      - app-network

  # Redis for sessions and Discourse
  redis:
    image: redis:7-alpine
    networks:
      - app-network

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - price-app
      - discourse
    networks:
      - app-network

volumes:
  postgres-data:
  discourse-uploads:
  discourse-backups:

networks:
  app-network:
    driver: bridge
```

### 1.2 Application Dockerfile
**Dockerfile.app**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
```

### 1.3 Database Initialization
**init-db.sql**
```sql
-- Create discourse database and user
CREATE DATABASE discourse_db;
CREATE USER discourse_user WITH ENCRYPTED PASSWORD 'discourse_password';
GRANT ALL PRIVILEGES ON DATABASE discourse_db TO discourse_user;

-- Create shared authentication tables
CREATE TABLE IF NOT EXISTS shared_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    discourse_user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_sessions (
    sid VARCHAR(255) PRIMARY KEY,
    session_data TEXT,
    expires TIMESTAMP,
    user_id INTEGER REFERENCES shared_users(id)
);
```

## Phase 2: Authentication Integration

### 2.1 Shared Authentication System
Implement Single Sign-On (SSO) between both applications:

**server/auth.ts**
```typescript
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { db } from './db';
import { sharedUsers } from '../shared/auth-schema';
import { eq } from 'drizzle-orm';

// Configure Passport Local Strategy
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const user = await db.select().from(sharedUsers).where(eq(sharedUsers.email, email)).limit(1);
      
      if (!user.length) {
        return done(null, false, { message: 'User not found' });
      }
      
      const isValid = await bcrypt.compare(password, user[0].passwordHash);
      if (!isValid) {
        return done(null, false, { message: 'Invalid password' });
      }
      
      return done(null, user[0]);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await db.select().from(sharedUsers).where(eq(sharedUsers.id, id)).limit(1);
    done(null, user[0] || null);
  } catch (error) {
    done(error);
  }
});

export { passport };
```

### 2.2 Discourse SSO Configuration
Configure Discourse to use the main app as SSO provider:

**discourse-sso.ts**
```typescript
import crypto from 'crypto';
import { Request, Response } from 'express';

const DISCOURSE_SSO_SECRET = process.env.DISCOURSE_SSO_SECRET!;

export function generateDiscourseSSO(user: any, nonce: string, returnUrl: string) {
  const payload = Buffer.from(`
    nonce=${nonce}&
    email=${user.email}&
    external_id=${user.id}&
    username=${user.username}&
    name=${user.username}&
    return_sso_url=${returnUrl}
  `.replace(/\s+/g, '')).toString('base64');
  
  const signature = crypto
    .createHmac('sha256', DISCOURSE_SSO_SECRET)
    .update(payload)
    .digest('hex');
    
  return { payload, signature };
}

export function handleDiscourseSSO(req: Request, res: Response) {
  if (!req.user) {
    return res.redirect('/login?return_to=' + encodeURIComponent(req.originalUrl));
  }
  
  const { sso, sig } = req.query;
  
  // Verify the request signature
  const computedSig = crypto
    .createHmac('sha256', DISCOURSE_SSO_SECRET)
    .update(sso as string)
    .digest('hex');
    
  if (computedSig !== sig) {
    return res.status(403).send('Invalid signature');
  }
  
  // Decode the payload
  const decodedPayload = Buffer.from(sso as string, 'base64').toString();
  const params = new URLSearchParams(decodedPayload);
  const nonce = params.get('nonce');
  const returnUrl = params.get('return_sso_url');
  
  if (!nonce || !returnUrl) {
    return res.status(400).send('Missing required parameters');
  }
  
  const { payload, signature } = generateDiscourseSSO(req.user, nonce, returnUrl);
  
  const redirectUrl = `${returnUrl}?sso=${encodeURIComponent(payload)}&sig=${signature}`;
  res.redirect(redirectUrl);
}
```

### 2.3 User Management Integration
**shared/auth-schema.ts**
```typescript
import { pgTable, serial, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const sharedUsers = pgTable('shared_users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  discourseUserId: integer('discourse_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const insertUserSchema = createInsertSchema(sharedUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SharedUser = typeof sharedUsers.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
```

## Phase 3: Design Integration

### 3.1 Shared Design System
Create shared CSS variables and components that both applications use:

**shared-styles.css**
```css
:root {
  /* Shared color palette */
  --primary-color: #3b82f6;
  --primary-foreground: #ffffff;
  --secondary-color: #6b7280;
  --accent-color: #10b981;
  --background: #ffffff;
  --foreground: #111827;
  --muted: #f9fafb;
  --border: #e5e7eb;
  
  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-base: 16px;
  --line-height-base: 1.5;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}

.dark {
  --background: #111827;
  --foreground: #f9fafb;
  --muted: #1f2937;
  --border: #374151;
}
```

### 3.2 Discourse Theme Customization
**discourse-theme/common/common.scss**
```scss
// Import shared design tokens
@import url('/shared-styles.css');

// Override Discourse default styles
.d-header {
  background-color: var(--background);
  border-bottom: 1px solid var(--border);
  
  .title {
    color: var(--foreground);
    font-family: var(--font-family);
  }
}

.btn-primary {
  background-color: var(--primary-color);
  color: var(--primary-foreground);
  border-radius: var(--radius-md);
  
  &:hover {
    background-color: color-mix(in srgb, var(--primary-color) 90%, black);
  }
}

// Custom navigation integration
.custom-nav-integration {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  
  .nav-link {
    color: var(--foreground);
    text-decoration: none;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-sm);
    
    &:hover {
      background-color: var(--muted);
    }
  }
}
```

### 3.3 Cross-Application Navigation
**components/shared-navigation.tsx**
```typescript
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { MessageSquare, Search, Home } from 'lucide-react';

interface SharedNavigationProps {
  currentApp: 'price-compare' | 'forum';
  user?: any;
}

export function SharedNavigation({ currentApp, user }: SharedNavigationProps) {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? window.location.origin 
    : 'http://localhost';
    
  return (
    <nav className="flex items-center gap-4 p-4 border-b">
      <div className="flex items-center gap-2">
        <Search className="h-6 w-6" />
        <span className="font-bold text-lg">PriceCompare Community</span>
      </div>
      
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant={currentApp === 'price-compare' ? 'default' : 'ghost'}
          asChild
        >
          <Link href="/">
            <Home className="h-4 w-4 mr-2" />
            Price Compare
          </Link>
        </Button>
        
        <Button
          variant={currentApp === 'forum' ? 'default' : 'ghost'}
          asChild
        >
          <a href={`${baseUrl}:3000`} target="_self">
            <MessageSquare className="h-4 w-4 mr-2" />
            Community Forum
          </a>
        </Button>
        
        {user ? (
          <div className="flex items-center gap-2">
            <span>Welcome, {user.username}</span>
            <Button variant="outline" size="sm">
              <a href="/logout">Logout</a>
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm">
            <Link href="/login">Login</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
```

## Phase 4: Feature Integration

### 4.1 Product Discussion Links
Integrate forum discussions directly into product pages:

**hooks/use-product-discussions.ts**
```typescript
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DiscussionTopic {
  id: number;
  title: string;
  slug: string;
  posts_count: number;
  created_at: string;
  last_posted_at: string;
}

export function useProductDiscussions(productId: number) {
  return useQuery({
    queryKey: ['product-discussions', productId],
    queryFn: async (): Promise<DiscussionTopic[]> => {
      const response = await apiRequest(`/api/products/${productId}/discussions`);
      return response.topics || [];
    },
  });
}

export function useCreateDiscussion() {
  return useMutation({
    mutationFn: async ({ productId, title, content }: {
      productId: number;
      title: string;
      content: string;
    }) => {
      return apiRequest('/api/discussions', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId,
          title,
          raw: content,
          category: 'product-discussions',
        }),
      });
    },
  });
}
```

### 4.2 Enhanced Product Cards with Community Features
**components/enhanced-product-card.tsx**
```typescript
import { ProductCard } from './product-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, Star } from 'lucide-react';
import { useProductDiscussions } from '@/hooks/use-product-discussions';
import type { ProductWithOffers } from '@/shared/schema';

interface EnhancedProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: () => void;
}

export function EnhancedProductCard({ product, onAddToComparison }: EnhancedProductCardProps) {
  const { data: discussions, isLoading } = useProductDiscussions(product.id);
  
  const discussionCount = discussions?.length || 0;
  const totalPosts = discussions?.reduce((sum, d) => sum + d.posts_count, 0) || 0;
  
  return (
    <div className="relative">
      <ProductCard product={product} onAddToComparison={onAddToComparison} />
      
      {/* Community overlay */}
      <div className="absolute top-2 right-2 flex gap-1">
        {discussionCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            <MessageSquare className="h-3 w-3 mr-1" />
            {discussionCount}
          </Badge>
        )}
        {totalPosts > 0 && (
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {totalPosts}
          </Badge>
        )}
      </div>
      
      {/* Discussion link */}
      <div className="mt-2 pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            const discussionUrl = `/forum/c/products/${product.id}`;
            window.open(discussionUrl, '_blank');
          }}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          {discussionCount > 0 
            ? `View ${discussionCount} discussion${discussionCount !== 1 ? 's' : ''}` 
            : 'Start discussion'
          }
        </Button>
      </div>
    </div>
  );
}
```

### 4.3 Price Alert Community Features
**server/community-integrations.ts**
```typescript
import { Request, Response } from 'express';
import { db } from './db';
import axios from 'axios';

const DISCOURSE_API_URL = process.env.DISCOURSE_URL + '/api';
const DISCOURSE_API_KEY = process.env.DISCOURSE_API_KEY!;
const DISCOURSE_API_USERNAME = process.env.DISCOURSE_API_USERNAME!;

export async function notifyPriceDropCommunity(productId: number, oldPrice: number, newPrice: number) {
  try {
    // Get product details
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });
    
    if (!product) return;
    
    const savingsAmount = oldPrice - newPrice;
    const savingsPercent = Math.round((savingsAmount / oldPrice) * 100);
    
    // Create forum post about price drop
    const postContent = `
🚨 **Price Drop Alert!** 🚨

**${product.name}** just dropped in price!

- **Previous Price**: $${oldPrice.toFixed(2)}
- **New Price**: $${newPrice.toFixed(2)}
- **You Save**: $${savingsAmount.toFixed(2)} (${savingsPercent}%)

[View Product Details](${process.env.APP_URL}/products/${productId})

Great time to buy if you've been waiting for a deal! 

*What do you think about this price? Share your thoughts below!*
    `;
    
    await axios.post(`${DISCOURSE_API_URL}/posts`, {
      title: `Price Drop: ${product.name} - Save ${savingsPercent}%!`,
      raw: postContent,
      category: 'price-alerts',
    }, {
      headers: {
        'Api-Key': DISCOURSE_API_KEY,
        'Api-Username': DISCOURSE_API_USERNAME,
      },
    });
    
  } catch (error) {
    console.error('Failed to notify community of price drop:', error);
  }
}

export async function createProductDiscussion(req: Request, res: Response) {
  try {
    const { productId, title, content } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Create topic in Discourse
    const response = await axios.post(`${DISCOURSE_API_URL}/posts`, {
      title: title || `Discussion: ${product.name}`,
      raw: content,
      category: 'product-discussions',
      tags: [`product-${productId}`, product.category],
    }, {
      headers: {
        'Api-Key': DISCOURSE_API_KEY,
        'Api-Username': req.user.username,
      },
    });
    
    res.json({ 
      success: true, 
      topic_id: response.data.topic_id,
      topic_slug: response.data.topic_slug,
    });
    
  } catch (error) {
    console.error('Failed to create product discussion:', error);
    res.status(500).json({ error: 'Failed to create discussion' });
  }
}
```

## Phase 5: Deployment Strategy

### 5.1 Replit Deployment Adaptation
Since Replit has specific constraints, we'll adapt the containerization approach:

**replit-deployment.md**
```markdown
# Replit Deployment Strategy

## Constraints
- Single port exposure (5000)
- No Docker support
- Limited background processes

## Solution: Process Management
Use PM2 to manage multiple Node.js processes:

1. Main price comparison app (port 5000)
2. Discourse proxy service (internal)
3. Background job processor

## Implementation
```bash
# Install PM2
npm install -g pm2

# PM2 ecosystem file
```

**ecosystem.config.js**
```javascript
module.exports = {
  apps: [
    {
      name: 'price-app',
      script: 'dist/index.js',
      port: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
    {
      name: 'discourse-proxy',
      script: 'discourse-proxy.js',
      env: {
        DISCOURSE_INTERNAL_PORT: 3001,
      },
    },
  ],
};
```

### 5.2 Alternative: Embedded Discourse
For Replit deployment, consider embedding Discourse functionality:

**embedded-discourse.ts**
```typescript
// Simplified forum functionality using existing React components
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface ForumPost {
  id: number;
  author: string;
  content: string;
  createdAt: Date;
  replies: ForumPost[];
}

export function EmbeddedForum({ productId }: { productId: number }) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [newPost, setNewPost] = useState('');
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Community Discussion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Share your thoughts about this product..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
            />
            <Button onClick={() => {/* Handle post submission */}}>
              Post Comment
            </Button>
          </div>
          
          <div className="mt-6 space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="ml-4">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{post.author}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {post.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <p>{post.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Implementation Timeline

### Week 1: Foundation Setup
- [ ] Set up containerization (Docker/PM2)
- [ ] Configure shared PostgreSQL database
- [ ] Implement basic authentication system
- [ ] Set up development environment

### Week 2: Authentication Integration
- [ ] Implement SSO between applications
- [ ] Create shared user management system
- [ ] Test authentication flows
- [ ] Set up session synchronization

### Week 3: Design Integration
- [ ] Create shared design system
- [ ] Customize Discourse theme
- [ ] Implement cross-application navigation
- [ ] Ensure responsive design consistency

### Week 4: Feature Integration
- [ ] Link products to forum discussions
- [ ] Implement community price alerts
- [ ] Add user-generated content features
- [ ] Create moderation tools

### Week 5: Testing & Deployment
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Production deployment

## Success Metrics

### Technical Metrics
- Single sign-on success rate > 99%
- Page load times < 2 seconds
- Zero authentication-related errors
- 100% design consistency across platforms

### Community Metrics
- User engagement increase by 40%
- Discussion threads per product > 0.5
- User retention improvement by 25%
- Community-generated content growth

## Risk Mitigation

### Technical Risks
1. **Authentication Complexity**: Use proven SSO patterns and extensive testing
2. **Performance Impact**: Implement caching and optimize database queries
3. **Deployment Challenges**: Have rollback plan and staging environment

### Community Risks
1. **Moderation Needs**: Implement automated content filtering
2. **Spam Prevention**: Use rate limiting and user verification
3. **Community Guidelines**: Establish clear rules and enforcement

## Next Steps

1. **Get User Approval**: Review this plan and confirm requirements
2. **Set Up Development Environment**: Configure local development setup
3. **Begin Phase 1 Implementation**: Start with containerization and basic setup
4. **Iterative Development**: Implement features incrementally with user feedback

This integration will create a powerful community-driven price comparison platform that combines the best of both worlds: comprehensive price data and engaged user discussions.