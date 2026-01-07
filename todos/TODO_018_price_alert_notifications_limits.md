# TODO 018: Price Alert Notifications & Limits

**Priority**: ~~P3 (Low)~~ → **P5 (Deferred - YAGNI)**
**File(s)**: `server/jobs/check-price-alerts.ts`, `server/services/notification-service.ts`, `server/routes/price-alert-routes.ts`
**Estimated Time**: ~~4-6 hours~~ → **DEFERRED** (await user demand)
**Status**: **DEFERRED - YAGNI Violation**

## DEFERRED - Awaiting User Demand ⏸️

**Parallel agent review conclusion**: This TODO violates YAGNI principle. Defer until users report issues.

## Problem Statement

Price alerts exist but users may not receive notifications when target prices are met. Additionally, there may be no limits on the number of alerts a user can create, potentially leading to spam or system abuse.

**CRITICAL DISCOVERY**:
- ✅ **Smart notification system already exists** (`server/services/smart-notification-service.ts`)
- ✅ **Alert limits already enforced** (50/user via `smart-alerts-service.ts`, not 20 as TODO claims)
- ❌ **No user demand for email notifications** (in-app notifications sufficient)
- ❌ **Over-engineered solution** proposed without validating user needs

**Impact** (REVISED):
- ~~Users don't get notified~~ → Users get in-app notifications via existing system
- ~~Unlimited alerts~~ → Already limited to 50/user in production
- ~~No rate limiting~~ → Rate limiting exists via express-rate-limit middleware

**Evidence** (CORRECTED):
- Phase 1.2 E2E tests cover alert CRUD ✅
- Smart notification service exists (`smart-notification-service.ts`) ✅
- Alert limits enforced (`smart-alerts-service.ts:177-188`) ✅
- Email notifications: **NOT REQUESTED BY USERS** ❌

## Root Cause (INVALIDATED)

**Original assumption**: No notification system exists.

**Reality after code review**:
- ✅ Smart notification service exists and is production-ready
- ✅ In-app notifications working via WebSocket
- ✅ Alert limits enforced (50/user)
- ✅ Rate limiting middleware active

**Actual gap**: Email notifications (which nobody asked for - YAGNI violation)

## Why This TODO is DEFERRED (P5)

### Agent Review Findings

**@agent-performance-oracle** and **@agent-code-simplicity-reviewer** identified:

1. **YAGNI Violation**: No user demand for email notifications
   - Users haven't requested email alerts
   - In-app notifications already exist and work
   - Email adds complexity without validated need

2. **Feature Already Exists**: Smart notification system is production-ready
   - `smart-notification-service.ts`: Contextual notifications
   - `smart-alerts-service.ts`: Alert management with limits
   - WebSocket integration: Real-time notifications
   - 50/user limit: Already enforced

3. **Performance Risk**: Proposed implementation has N+1 query pattern
   - Checking 10,000 alerts would cause 100,001 database queries
   - Scales poorly beyond 100 users
   - Needs batch query optimization if ever implemented

4. **Premature Optimization**: Alert limits already exist
   - Current limit: 50/user (not 20 as TODO claims)
   - Enforced in `smart-alerts-service.ts:177-188`
   - No evidence of users hitting limits
   - No evidence of abuse

### Recommendation

**DEFER until users report issues**:
- Wait for user feedback: "I didn't get notified about price drop"
- Wait for evidence of abuse: "Unlimited alerts causing problems"
- Wait for email requests: "I want email notifications"

**If users DO request email notifications**, implement minimal version:
- Use existing `smart-notification-service.ts` infrastructure
- Add email channel alongside in-app notifications
- Use batch queries to avoid N+1 performance issues
- Estimated effort: 30-60 minutes (not 4-6 hours)

### Existing Infrastructure (DO NOT RECREATE)

**Smart Notification Service** (`server/services/smart-notification-service.ts`):
```typescript
export async function createSmartNotification({
  userId,
  type,
  urgency,
  productId,
  metadata,
}: SmartNotificationInput) {
  // Creates in-app notification
  // Handles WebSocket push
  // Groups related notifications
  // Manages notification history
}
```

**Alert Limits** (`server/services/smart-alerts-service.ts:177-188`):
```typescript
const MAX_ALERTS_PER_USER = 50;

// Enforced before alert creation
if (userAlertCount >= MAX_ALERTS_PER_USER) {
  throw new AppError(
    `You've reached the maximum of ${MAX_ALERTS_PER_USER} price alerts`,
    400
  );
}
```

### If Ever Implemented: Minimal Email Version

**Only implement if users request it**:

```typescript
// Add to existing smart-notification-service.ts (30 lines)
async function sendEmailNotification(notification: Notification) {
  if (!notification.email) return; // User opt-in required

  const user = await storage.getUserById(notification.userId);
  const product = await storage.getProductById(notification.productId);

  await emailService.send({
    to: user.email,
    subject: `Price Alert: ${product.name} is now ${notification.newPrice}!`,
    template: 'price-alert',
    data: {
      userName: user.username,
      productName: product.name,
      oldPrice: notification.oldPrice,
      newPrice: notification.newPrice,
      productUrl: `${process.env.APP_URL}/product/${product.id}`,
    },
  });
}
```

**Batch query pattern** (avoid N+1):
```typescript
// ✅ CORRECT - Single query for all alerts
const alerts = await db
  .select({
    alert: priceAlerts,
    user: users,
    product: products,
    currentPrice: sql<string>`MIN(${productOffers.price})`,
  })
  .from(priceAlerts)
  .innerJoin(users, eq(priceAlerts.userId, users.id))
  .innerJoin(products, eq(priceAlerts.productId, products.id))
  .leftJoin(productOffers, eq(products.id, productOffers.productId))
  .where(eq(priceAlerts.isActive, true))
  .groupBy(priceAlerts.id, users.id, products.id);

for (const row of alerts) {
  if (parseFloat(row.currentPrice) <= parseFloat(row.alert.targetPrice)) {
    await createSmartNotification({
      userId: row.user.id,
      type: 'price_alert',
      urgency: 'high',
      productId: row.product.id,
    });
  }
}
```

## Original Solution Approach (REFERENCE ONLY - DO NOT IMPLEMENT)

~~The original TODO proposed 4-6 hours of work for features that either already exist or aren't needed:~~

1. ~~Verify price alert check job exists and runs~~ → Job exists
2. ~~Implement email notifications for triggered alerts~~ → YAGNI (no demand)
3. ~~Add in-app notification integration~~ → Already exists
4. ~~Implement alert limits (e.g., 20 per user)~~ → Already exists (50/user)
5. ~~Add rate limiting on alert creation API~~ → Already exists
6. ~~Add alert history/log (when triggered, when notified)~~ → Already exists in notifications table

## Implementation Steps

### Step 1: Audit Existing Price Alert Job

- [ ] Check if `server/jobs/check-price-alerts.ts` exists
- [ ] Review job logic: Does it query offers and compare to alert targets?
- [ ] Check if job is scheduled in Bull queue
- [ ] Verify job runs on schedule (every 1 hour? every 15 min?)
- [ ] Look for notification sending logic

### Step 2: Implement Email Notifications

- [ ] Install email service (Resend, SendGrid, or NodeMailer)
- [ ] Create email template for price alert
- [ ] Template includes: Product name, old price, new price, retailer, link
- [ ] Send email when alert triggered
- [ ] Mark alert as "notified" to prevent duplicates
- [ ] Handle email failures gracefully (retry logic)

### Step 3: Implement In-App Notifications

- [ ] Add notification to notifications table (if exists)
- [ ] Use WebSocket to push real-time notification
- [ ] Show toast/banner when user online
- [ ] Store notification history in database
- [ ] Mark as read/unread

### Step 4: Add Alert Limits

- [ ] Enforce max 20 alerts per user (configurable)
- [ ] Check count before allowing new alert creation
- [ ] Return 400 error with helpful message: "You've reached your alert limit (20). Delete an alert to create a new one."
- [ ] Admin users exempt from limit (or higher limit)

### Step 5: Add Rate Limiting

- [ ] Use existing rate limiter middleware
- [ ] Limit: 10 alert creations per user per hour
- [ ] Return 429 error with retry-after header
- [ ] Prevent API abuse

### Step 6: Add Alert History

- [ ] Create `price_alert_history` table (if doesn't exist)
- [ ] Columns: alert_id, triggered_at, notified_at, old_price, new_price
- [ ] Record each time alert triggers
- [ ] Show history in user's alert management page
- [ ] Allow disabling alerts after X triggers

## Technical Details

```typescript
// Price Alert Check Job
export async function checkPriceAlerts() {
  // Get all active alerts
  const alerts = await db
    .select()
    .from(priceAlerts)
    .where(eq(priceAlerts.isActive, true));

  for (const alert of alerts) {
    // Get current best price for product
    const [bestOffer] = await db
      .select()
      .from(productOffers)
      .where(eq(productOffers.productId, alert.productId))
      .orderBy(asc(productOffers.price))
      .limit(1);

    if (!bestOffer) continue;

    const currentPrice = parseFloat(bestOffer.price);
    const targetPrice = parseFloat(alert.targetPrice);

    if (currentPrice <= targetPrice) {
      // Alert triggered!
      await sendPriceAlertNotification(alert, bestOffer);

      // Record in history
      await db.insert(priceAlertHistory).values({
        alertId: alert.id,
        triggeredAt: new Date(),
        notifiedAt: new Date(),
        oldPrice: alert.lastCheckedPrice,
        newPrice: currentPrice.toString(),
      });

      // Update last checked price
      await db
        .update(priceAlerts)
        .set({ lastCheckedPrice: currentPrice.toString() })
        .where(eq(priceAlerts.id, alert.id));
    }
  }
}

// Notification Service
async function sendPriceAlertNotification(alert, offer) {
  const user = await storage.getUserById(alert.userId);
  const product = await storage.getProductById(alert.productId);

  // Email notification
  await emailService.send({
    to: user.email,
    subject: `Price Alert: ${product.name} is now $${offer.price}!`,
    template: 'price-alert',
    data: {
      userName: user.username,
      productName: product.name,
      targetPrice: alert.targetPrice,
      currentPrice: offer.price,
      productUrl: `${process.env.APP_URL}/product/${product.id}`,
      retailerName: offer.retailerName,
    },
  });

  // In-app notification (WebSocket)
  await notificationService.create({
    userId: user.id,
    type: 'price_alert',
    title: 'Price Alert Triggered',
    message: `${product.name} is now $${offer.price}!`,
    link: `/product/${product.id}`,
  });
}

// Alert Limit Check
app.post('/api/price-alerts', withAuth(async (req, res) => {
  const userId = req.user!.id;

  // Check alert count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceAlerts)
    .where(eq(priceAlerts.userId, userId));

  if (count >= 20) {
    return sendError(
      res,
      "You've reached your alert limit (20). Delete an alert to create a new one.",
      400,
      { limit: 20, current: count }
    );
  }

  // Create alert...
}));
```

## Checklist

- [ ] Price alert check job exists and is scheduled
- [ ] Job queries offers and compares to alert targets
- [ ] Email notification service integrated
- [ ] Email template created for price alerts
- [ ] In-app notifications created via WebSocket
- [ ] Alert history table created
- [ ] Alert triggers recorded in history
- [ ] Alert limit enforced (20 per user)
- [ ] Rate limiting on alert creation (10/hour)
- [ ] 429 error returned when rate limited
- [ ] Admin users have higher limits
- [ ] Tests written for notification sending
- [ ] Tests written for limit enforcement

## Success Criteria

- [ ] Price alert job runs on schedule (every 15-60 minutes)
- [ ] When product price drops below target, email sent
- [ ] Email includes product details, price change, link
- [ ] In-app notification appears for online users
- [ ] Alert history records each trigger
- [ ] User cannot create more than 20 alerts
- [ ] Helpful error message when limit reached
- [ ] API returns 429 when rate limited
- [ ] Integration test: Create alert, simulate price drop, verify notification
- [ ] Manual test: Create alert, wait for price change, verify email/notification

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm notification service exists
  ```bash
  grep -r "sendPriceAlertNotification\|checkPriceAlerts" server/
  # Should return: Job and notification implementations
  ```

- [ ] **Limit verification**: Confirm alert limit enforced
  ```bash
  grep -r "alert limit\|reached your alert limit" server/routes/price-alert-routes.ts
  # Should return: Limit check logic
  ```

### Testing
- [ ] **Run integration tests**: Execute price alert tests
  ```bash
  npm test -- price-alert
  ```

- [ ] **Verify notification test**: At least 1 test verifies notification sent

### Job Verification
- [ ] **Check job schedule**: Verify Bull queue scheduled
  ```bash
  grep -r "checkPriceAlerts\|price.*alert.*job" server/jobs/
  # Should return: Job registration
  ```

### Manual Testing
- [ ] **Create alert**: Set alert below current price
- [ ] **Wait for job**: Wait for scheduled job to run
- [ ] **Verify email**: Check inbox for price alert email
- [ ] **Verify in-app**: Check notifications page for alert
- [ ] **Test limit**: Try creating 21 alerts, verify rejection

---

**Created by**: Claude Code
**Creation Date**: 2026-01-06
**Source**: Phase 2.4 E2E Test Implementation - Feature Gap Analysis
