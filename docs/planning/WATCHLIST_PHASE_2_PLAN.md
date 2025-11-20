# Watch List Feature - Phase 2 Implementation Plan

**Phase 2: Real-time Notifications & Alerts**
**Status**: Planning Phase
**Prerequisites**: Phase 1.1 Complete ✅
**Estimated Effort**: High (3-4 weeks)
**Priority**: High

---

## 📋 Overview

Phase 2 transforms the watch list feature from a management tool into an active notification system that alerts users about price drops, deals, and product availability in real-time.

### Goals
1. Replace polling with WebSocket real-time updates
2. Implement multi-channel notification delivery (in-app, push, email)
3. Create flexible alert rule system
4. Build notification preference management UI
5. Ensure scalability and reliability

---

## 🏗️ Architecture Overview

### Current State (Phase 1)
```
┌─────────┐     Polling      ┌─────────┐
│ Browser │ ◄─────30-60s────► │ Backend │
└─────────┘     REST API      └─────────┘
```

### Target State (Phase 2)
```
┌─────────┐     WebSocket     ┌─────────┐     Price      ┌──────────┐
│ Browser │ ◄────Real-time───► │ Backend │ ◄──Monitoring─► │ Database │
└─────────┘                    └─────────┘                └──────────┘
     │                              │
     │ Push Notifications           │ Email Queue
     ▼                              ▼
┌─────────┐                    ┌─────────┐
│ Service │                    │  SMTP   │
│ Worker  │                    │ Service │
└─────────┘                    └─────────┘
```

---

## 🎯 Phase 2 Breakdown

### 2.1 WebSocket Implementation (Week 1-2)

#### Backend: WebSocket Server

**Dependencies to Add**:
```json
{
  "dependencies": {
    "ws": "^8.17.0",
    "socket.io": "^4.7.2",  // Alternative to ws
    "@types/ws": "^8.5.10"
  }
}
```

**New Files to Create**:
```
server/
├── websocket/
│   ├── index.ts                    # WebSocket server setup
│   ├── handlers/
│   │   ├── watch-list-handler.ts  # Watch list events
│   │   ├── price-update-handler.ts # Price change events
│   │   └── notification-handler.ts # Notification delivery
│   ├── middleware/
│   │   ├── auth.ts                # WebSocket authentication
│   │   └── rate-limit.ts          # Connection rate limiting
│   └── types.ts                   # WebSocket event types
```

**Implementation Tasks**:
- [ ] Set up WebSocket server (choose: ws or Socket.io)
- [ ] Implement authentication middleware (reuse existing session)
- [ ] Create room-based message routing (per user)
- [ ] Add connection heartbeat/ping-pong
- [ ] Implement automatic reconnection logic
- [ ] Add rate limiting for connections
- [ ] Create event emitters for:
  - `watch:price_drop`
  - `watch:target_price_met`
  - `watch:back_in_stock`
  - `watch:list_updated`
  - `notification:new`

**Sample WebSocket Event Structure**:
```typescript
interface WatchListEvent {
  type: 'price_drop' | 'target_met' | 'back_in_stock' | 'list_updated';
  payload: {
    productId: number;
    watchListId: number;
    oldPrice?: number;
    newPrice?: number;
    targetPrice?: number;
    message: string;
    timestamp: string;
  };
}
```

#### Frontend: WebSocket Client

**New Files to Create**:
```
client/src/
├── lib/
│   └── websocket.ts              # WebSocket client manager
├── hooks/
│   ├── use-websocket.ts          # WebSocket hook
│   └── use-notifications.ts      # Notification hook
└── components/
    └── notifications/
        ├── notification-center.tsx
        ├── notification-badge.tsx
        └── notification-item.tsx
```

**Implementation Tasks**:
- [ ] Create WebSocket client class with auto-reconnect
- [ ] Implement React hook for WebSocket connection
- [ ] Add event listeners for all watch list events
- [ ] Create notification state management (Zustand or React Query)
- [ ] Build notification center UI component
- [ ] Add notification badge to header
- [ ] Implement sound/visual alerts (optional)
- [ ] Handle offline/online transitions gracefully

**Sample WebSocket Hook**:
```typescript
export function useWatchListSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const ws = new WebSocket(`ws://localhost:5000/ws`);

    ws.onmessage = (event) => {
      const data: WatchListEvent = JSON.parse(event.data);

      if (data.type === 'price_drop') {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries(['watchListProducts']);

        // Show notification
        toast({
          title: '🎉 Price Drop!',
          description: data.payload.message
        });
      }
    };

    return () => ws.close();
  }, [user]);
}
```

---

### 2.2 Notification Delivery System (Week 2-3)

#### In-App Notifications

**Database Schema**:
```sql
-- migrations/0009_add_notifications.sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'price_drop', 'target_met', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Related data (product_id, watch_list_id, etc.)
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP -- Optional expiration
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;
```

**Implementation Tasks**:
- [ ] Create notifications table migration
- [ ] Add notification service functions (create, mark read, delete)
- [ ] Add API endpoints:
  - `GET /api/notifications` - Fetch user notifications
  - `PATCH /api/notifications/:id/read` - Mark as read
  - `POST /api/notifications/mark-all-read` - Mark all read
  - `DELETE /api/notifications/:id` - Delete notification
- [ ] Create notification center component
- [ ] Add unread badge to header
- [ ] Implement notification grouping (by product/list)
- [ ] Add notification sounds/vibrations (optional)
- [ ] Create notification cleanup job (delete old notifications)

#### Browser Push Notifications

**Prerequisites**:
- HTTPS enabled (required for Push API)
- Service worker registered
- VAPID keys generated

**New Files to Create**:
```
client/
├── public/
│   └── service-worker.js         # Push notification handler
└── src/
    └── lib/
        └── push-notifications.ts  # Push API wrapper
```

**Implementation Tasks**:
- [ ] Generate VAPID keys: `npx web-push generate-vapid-keys`
- [ ] Store VAPID keys in environment variables
- [ ] Register service worker
- [ ] Request notification permission from user
- [ ] Store push subscription in database
- [ ] Send push notifications from backend
- [ ] Handle notification clicks (open relevant page)
- [ ] Add push notification preferences UI

**Push Subscription Schema**:
```sql
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);
```

#### Email Notifications

**Dependencies**:
```json
{
  "dependencies": {
    "nodemailer": "^6.9.13",
    "@types/nodemailer": "^6.4.15",
    "handlebars": "^4.7.8" // For email templates
  }
}
```

**New Files to Create**:
```
server/
├── services/
│   ├── email-service.ts          # Email sending logic
│   └── notification-queue.ts     # Email queue management
└── templates/
    └── email/
        ├── price-drop.hbs         # Price drop template
        ├── target-met.hbs         # Target price template
        ├── daily-digest.hbs       # Daily summary
        └── weekly-digest.hbs      # Weekly summary
```

**Implementation Tasks**:
- [ ] Set up email service (using existing SMTP config)
- [ ] Create email templates (Handlebars)
- [ ] Implement email queue (using Redis or database)
- [ ] Add digest scheduling (daily/weekly)
- [ ] Create unsubscribe mechanism
- [ ] Add email preferences UI
- [ ] Test email delivery (use Mailtrap for dev)

**Email Preferences Schema**:
```sql
CREATE TABLE notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  email_frequency VARCHAR(20) DEFAULT 'instant', -- instant, daily, weekly, never
  push_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  notify_price_drop BOOLEAN DEFAULT true,
  notify_target_met BOOLEAN DEFAULT true,
  notify_back_in_stock BOOLEAN DEFAULT true,
  notify_deal_spotted BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 2.3 Custom Alert Rules (Week 3-4)

#### Alert Rules System

**Database Schema**:
```sql
-- migrations/0010_add_alert_rules.sql
CREATE TABLE alert_rules (
  id SERIAL PRIMARY KEY,
  product_watch_id INTEGER NOT NULL REFERENCES product_watches(id) ON DELETE CASCADE,
  rule_type VARCHAR(50) NOT NULL, -- 'percentage_drop', 'absolute_drop', 'target_price', 'stock_available'
  threshold DECIMAL(10, 2), -- For percentage/absolute drops
  target_value DECIMAL(10, 2), -- For target price
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_watch ON alert_rules(product_watch_id, is_active);
CREATE INDEX idx_alert_rules_type ON alert_rules(rule_type) WHERE is_active = true;
```

**Implementation Tasks**:
- [ ] Create alert rules migration
- [ ] Add alert rule service functions (CRUD)
- [ ] Implement rule evaluation engine
- [ ] Create price monitoring service
- [ ] Add API endpoints for alert management
- [ ] Build alert rules UI component
- [ ] Add rule testing/preview feature
- [ ] Implement cooldown period (avoid spam)

**Alert Rule Types**:

1. **Percentage Drop**: Alert when price drops by X%
   ```typescript
   {
     rule_type: 'percentage_drop',
     threshold: 15.0  // 15% drop
   }
   ```

2. **Absolute Drop**: Alert when price drops by $X
   ```typescript
   {
     rule_type: 'absolute_drop',
     threshold: 50.00  // $50 drop
   }
   ```

3. **Target Price**: Alert when price reaches target
   ```typescript
   {
     rule_type: 'target_price',
     target_value: 99.99
   }
   ```

4. **Stock Available**: Alert when back in stock
   ```typescript
   {
     rule_type: 'stock_available',
     // No threshold needed
   }
   ```

#### UI Components

**New Components to Create**:
```
client/src/components/alerts/
├── alert-rules-manager.tsx       # Main management UI
├── create-alert-dialog.tsx       # Create new alert
├── alert-rule-card.tsx           # Display rule
└── alert-history.tsx             # Past alerts log
```

**Implementation Tasks**:
- [ ] Build alert rules manager page
- [ ] Add create alert dialog with rule builder
- [ ] Create alert rule cards (show status, last triggered)
- [ ] Build alert history/log viewer
- [ ] Add inline alert creation from product cards
- [ ] Implement alert testing ("Test this rule now")
- [ ] Add alert statistics/analytics

---

## 🛠️ Technical Considerations

### Performance

**Challenges**:
- Many concurrent WebSocket connections (1000+ users)
- High-frequency price updates (1000s of products)
- Email queue processing (bulk sends)

**Solutions**:
- [ ] Use Redis for WebSocket pub/sub
- [ ] Implement connection pooling
- [ ] Add message batching (group updates)
- [ ] Use worker processes for email sending
- [ ] Implement rate limiting per user
- [ ] Add caching for frequently accessed data

### Scalability

**Horizontal Scaling**:
- [ ] Use Redis adapter for Socket.io (multi-server)
- [ ] Implement sticky sessions (or use Redis store)
- [ ] Load balance WebSocket connections
- [ ] Use message queue for notifications (Bull, BullMQ)

**Database Optimization**:
- [ ] Add indexes on notification queries
- [ ] Implement notification archival (move old to separate table)
- [ ] Use materialized views for alert statistics
- [ ] Add read replicas for heavy queries

### Security

**Threats to Mitigate**:
- WebSocket DoS attacks
- Notification spam
- Unauthorized access to notifications
- Email spoofing

**Solutions**:
- [ ] Rate limit WebSocket messages
- [ ] Implement connection authentication
- [ ] Add CSRF protection for push subscriptions
- [ ] Validate email addresses (SPF, DKIM)
- [ ] Add honeypot detection for automated subscriptions
- [ ] Implement notification cooldown per product

---

## 📊 Success Metrics

Track these KPIs after Phase 2 deployment:

### Engagement Metrics
- WebSocket connection success rate (target: >95%)
- Average notification delivery time (target: <5s)
- Notification open rate (target: >30%)
- Alert rule creation rate (target: >20% of users)
- Email open rate (target: >25%)
- Push notification CTR (target: >10%)

### Technical Metrics
- WebSocket connection uptime (target: >99%)
- Average reconnection time (target: <2s)
- Email delivery success rate (target: >98%)
- Server CPU usage under load (target: <70%)
- Memory usage per connection (target: <5MB)

### User Satisfaction
- Notification relevance score (user survey)
- Alert false positive rate (target: <5%)
- Feature adoption rate (target: >40% in 30 days)

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] WebSocket connection/disconnection
- [ ] Event emission and handling
- [ ] Alert rule evaluation logic
- [ ] Email template rendering
- [ ] Notification preferences application

### Integration Tests
- [ ] End-to-end notification flow
- [ ] Multi-server WebSocket synchronization
- [ ] Email queue processing
- [ ] Push notification delivery
- [ ] Database triggers for alerts

### Load Tests
- [ ] 1000 concurrent WebSocket connections
- [ ] 10,000 notifications/minute
- [ ] Email queue with 50,000 pending emails
- [ ] Alert rule evaluation for 100,000 products

### User Acceptance Tests
- [ ] Notification arrives within 5 seconds
- [ ] Email digest groups related notifications
- [ ] Push notification opens correct page
- [ ] Alert rules trigger accurately
- [ ] Preferences apply correctly

---

## 🚀 Deployment Plan

### Phase 2.1 (WebSocket) - Week 2
1. Deploy WebSocket server (blue-green deployment)
2. Test with 10% of users (feature flag)
3. Monitor connection stability
4. Gradually roll out to 100%

### Phase 2.2 (Notifications) - Week 3
1. Deploy notification database schema
2. Enable in-app notifications for all users
3. Launch push notification opt-in
4. Test email digest generation
5. Enable email notifications (with easy unsubscribe)

### Phase 2.3 (Alert Rules) - Week 4
1. Deploy alert rules schema
2. Launch alert rule UI for beta users
3. Monitor alert accuracy
4. Roll out to all users
5. Gather feedback and iterate

---

## 📝 Migration Path from Phase 1

### Backwards Compatibility

Ensure Phase 1 continues to work during Phase 2 rollout:
- [ ] Keep polling fallback for WebSocket failures
- [ ] Maintain REST API endpoints (don't remove)
- [ ] Gradual feature flag rollout
- [ ] Monitor both systems in parallel

### Data Migration

No breaking changes needed:
- [ ] Phase 1 watch lists work as-is
- [ ] New tables are additive only
- [ ] Existing product watches unchanged
- [ ] Default notification preferences for existing users

---

## 🔮 Phase 3 Preview

After Phase 2 is stable, Phase 3 will focus on:

- **Performance Optimization**
  - Materialized views for statistics
  - Virtual scrolling for large lists
  - Service worker caching

- **Advanced Features**
  - Price prediction ML model
  - Smart notification timing
  - Collaborative watch lists (shared lists)

- **Analytics & Insights**
  - Savings tracker dashboard
  - Deal success rate
  - Personalized recommendations

---

## 📚 Resources & References

### WebSocket Libraries
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [ws (WebSocket) Library](https://github.com/websockets/ws)
- [WebSocket Best Practices](https://ably.com/topic/websocket-best-practices)

### Push Notifications
- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)
- [VAPID Key Generation](https://www.npmjs.com/package/web-push)
- [Service Workers Guide](https://developers.google.com/web/fundamentals/primers/service-workers)

### Email Services
- [Nodemailer Documentation](https://nodemailer.com/)
- [Handlebars Templates](https://handlebarsjs.com/)
- [Email Best Practices](https://sendgrid.com/blog/email-best-practices/)

### Scaling
- [Redis Pub/Sub](https://redis.io/topics/pubsub)
- [Bull Queue](https://github.com/OptimalBits/bull)
- [Load Balancing WebSockets](https://socket.io/docs/v4/using-multiple-nodes/)

---

## ✅ Phase 2 Checklist

### Before Starting
- [ ] Phase 1 fully tested and stable
- [ ] User feedback collected on Phase 1
- [ ] Infrastructure ready (Redis, email server)
- [ ] Team trained on WebSocket technology
- [ ] Monitoring/alerting configured

### Week 1-2: WebSocket
- [ ] WebSocket server implemented
- [ ] Client connection manager built
- [ ] Real-time events working
- [ ] Auto-reconnection tested
- [ ] Load tested with 1000+ connections

### Week 2-3: Notifications
- [ ] In-app notification center live
- [ ] Push notifications working
- [ ] Email service configured
- [ ] Digest emails generated
- [ ] Preferences UI functional

### Week 3-4: Alert Rules
- [ ] Alert rules database ready
- [ ] Rule evaluation engine working
- [ ] UI for creating/managing rules
- [ ] Alert history tracking
- [ ] Testing and optimization

### After Phase 2
- [ ] All success metrics tracked
- [ ] User feedback collected
- [ ] Performance optimized
- [ ] Documentation updated
- [ ] Ready for Phase 3

---

**Phase 2 Goal**: Transform watch lists from passive organization to active, intelligent monitoring that saves users time and money through timely, relevant notifications.

**Estimated Timeline**: 3-4 weeks
**Team Size**: 2-3 developers
**Dependencies**: Redis, SMTP server, HTTPS certificate

Ready to build the future of price monitoring! 🚀
