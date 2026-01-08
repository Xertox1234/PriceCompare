# Email Price Alert Notifications

## Overview

Price alert email notifications automatically notify users via email when products reach their target prices. This feature integrates with the existing price alert system and respects user notification preferences.

## Architecture

### Components

1. **Email Service** (`server/services/email-service.ts`)
   - `sendPriceAlertEmail()` - Sends formatted HTML/text email for price alerts

2. **Price Drop Detection** (`server/services/price-drop-detection.ts`)
   - `checkPriceAlertsForDrop()` - Triggers notifications when price alerts are met
   - Integrated email notification logic

3. **Storage Layer** (`server/storage/domains/notification-storage.ts`)
   - `getUserPreferences()` - Retrieves user notification preferences
   - `getUserEmailById()` - Retrieves user email and username

4. **Database Schema** (`shared/schema.ts`)
   - `notificationPreferences.emailEnabled` - Controls email notifications
   - `notificationPreferences.priceAlertEnabled` - Controls price alert notifications

## Email Template

The price alert email includes:
- Product name
- Current price vs target price
- Savings calculation (if applicable)
- Retailer information
- Direct product link (if available)
- Responsive HTML design
- Plain text fallback

### Design Features
- Green theme (success color) for positive notification
- Large, prominent price display
- Clear call-to-action button
- Mobile-responsive layout
- HTML entity escaping for XSS prevention

## User Flow

```
1. Price change detected for product offer
   ↓
2. checkPriceAlertsForDrop() triggered
   ↓
3. Find users with active alerts meeting target price
   ↓
4. For each triggered alert:
   a. Create in-app notification (existing)
   b. Emit WebSocket event (existing)
   c. Check user preferences:
      - Is priceAlertEnabled = true?
      - Is emailEnabled = true?
      - Does user have email on file?
   d. If all conditions met → Send email
   ↓
5. Return count of triggered alerts
```

## User Preferences

Email notifications are controlled by two settings in `notification_preferences`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `priceAlertEnabled` | boolean | true | Master switch for price alerts |
| `emailEnabled` | boolean | true | Master switch for email notifications |

**Email sent when:** Both `priceAlertEnabled` AND `emailEnabled` are `true`

## Error Handling

### Design Principles

1. **Non-blocking** - Email failures NEVER break in-app notifications
2. **Fire-and-forget** - Email sending uses `void` operator
3. **Graceful degradation** - Missing preferences/email = skip email silently
4. **Comprehensive logging** - All failures logged with context

### Error Scenarios

| Scenario | Behavior |
|----------|----------|
| SMTP not configured | Email skipped, logged at info level |
| User has no preferences | Email skipped, no error |
| User disabled email | Email skipped, no error |
| Email send fails | Logged at error level, notification still created |
| Database query fails | Logged at error level, notification still created |

## Environment Variables

Email functionality requires SMTP configuration:

```bash
# Required for email sending
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your_username
SMTP_PASSWORD=your_password

# Optional
SMTP_FROM_ADDRESS=noreply@pricecompare.com  # Default if not set
APP_URL=https://pricecompare.com            # For product links
```

**Note:** If SMTP variables are not set, email service will log a message and gracefully disable email sending.

## Testing

### Manual Testing

1. **Configure SMTP** (use Mailtrap for testing):
   ```bash
   SMTP_HOST=sandbox.smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_USERNAME=your_mailtrap_username
   SMTP_PASSWORD=your_mailtrap_password
   ```

2. **Create price alert** for a product

3. **Update product price** to meet target:
   ```typescript
   await checkPriceAlertsForDrop(productOfferId, targetPrice);
   ```

4. **Verify**:
   - In-app notification created ✓
   - WebSocket event emitted ✓
   - Email received (check Mailtrap) ✓

### Integration Testing

```typescript
// Test email integration
const result = await checkPriceAlertsForDrop(productOfferId, newPrice);
expect(result).toBeGreaterThan(0);

// Verify in-app notification created
const notifications = await storage.getUserNotifications(userId, { type: 'price_alert' });
expect(notifications.length).toBeGreaterThan(0);

// Email verification requires SMTP mock
```

## Performance Considerations

### Batch Processing

Price alert checking processes alerts in parallel using `Promise.all()`:
- In-app notification creation
- WebSocket emission
- Email sending

Each alert's email is sent independently - failures don't affect other alerts.

### Database Queries

For each triggered alert:
- 2 additional queries (user preferences, user email)
- Queries run in parallel during notification creation
- No N+1 queries introduced

### Optimization Opportunities (Future)

1. **Batch email sending** - Collect all emails and send in single batch
2. **Preference caching** - Cache user preferences in Redis
3. **Email queue** - Move to background job queue (Bull) for better reliability

## Security Considerations

1. **HTML Escaping** - All user-generated content escaped via `escapeHtml()`
2. **Email Encryption** - User email field encrypted in database (GDPR compliance)
3. **No Sensitive Data** - Passwords/tokens never included in emails
4. **Rate Limiting** - Daily notification limits apply to email notifications

## Monitoring

### Logs

Email sending logs structured data for monitoring:

```typescript
// Success
logger.info('Email sent successfully to user@example.com: messageId');

// Failure
logger.error('Failed to send price alert email', {
  error: 'SMTP connection timeout',
  userId: 123,
  productId: 456
});
```

### Metrics to Track

- Email send success rate
- Email send failures (by error type)
- Users with email enabled vs disabled
- Email delivery time (if SMTP supports)

## Future Enhancements

1. **Email Templates** - Move to template engine (Handlebars/Pug)
2. **Unsubscribe Links** - One-click email preference management
3. **Email Scheduling** - Respect quiet hours from user preferences
4. **Email Digest** - Group multiple alerts into daily digest
5. **Email Analytics** - Track opens, clicks, conversions
6. **Rich Content** - Include product images in emails
7. **A/B Testing** - Test different email templates

## Related Documentation

- [Pattern: Email Service](../06_ERROR_HANDLING_PATTERNS.md#email-service)
- [Pattern: Notification Preferences](../03_API_PATTERNS.md#notification-preferences)
- [Security: PII Encryption](../04_SECURITY_PATTERNS.md#pii-encryption)
- [Background Jobs: Email Queue](../07_BACKGROUND_JOBS_PATTERNS.md)
