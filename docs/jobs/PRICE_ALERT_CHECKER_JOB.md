# Price Alert Checker Job

## Overview

Scheduled job that periodically checks all active price alerts against current product prices. Complements the event-driven alert system (triggered during scraping) by catching alerts that may have been missed during scraper downtime or for products that haven't been scraped recently.

## Schedule

- **Frequency**: Every 30 minutes
- **Cron Expression**: `*/30 * * * *`
- **Lock TTL**: 45 minutes (prevents overlap)

## Architecture

### Multi-Server Safety

Uses distributed locking via Redis to prevent duplicate execution across multiple servers:

```typescript
const result = await jobLockService.withLock(
  'price-alert-checker:periodic',
  async () => {
    const stats = await checkAllActivePriceAlerts();
    return stats;
  },
  2700 // 45 minute lock
);

if (result === null) {
  // Already running on another server - skip
}
```

### N+1 Query Prevention

Uses a **single JOIN query** to fetch all active alerts with current prices:

```typescript
// ✅ CORRECT - Single query with JOIN and GROUP BY
const alertsWithPrices = await db
  .select({
    alertId: priceAlerts.id,
    productId: priceAlerts.productId,
    userId: priceAlerts.userId,
    targetPrice: priceAlerts.targetPrice,
    productName: products.name,
    currentPrice: sql<string | null>`MIN(${productOffers.price})`,
    offerCount: sql<number>`COUNT(${productOffers.id})`,
  })
  .from(priceAlerts)
  .innerJoin(products, eq(priceAlerts.productId, products.id))
  .leftJoin(
    productOffers,
    and(eq(products.id, productOffers.productId), eq(productOffers.availability, 'in_stock'))
  )
  .where(eq(priceAlerts.isActive, true))
  .groupBy(priceAlerts.id, products.id);
```

**Avoids:**
```typescript
// ❌ WRONG - N+1 query pattern
const alerts = await db.select().from(priceAlerts);
for (const alert of alerts) {
  const price = await db.select().from(productOffers)... // N queries!
}
```

### Integration with Existing Services

Delegates notification creation to existing `checkPriceAlertsForDrop()` service:

```typescript
// Reuses existing notification logic
const alertsTriggered = await checkPriceAlertsForDrop(minOffer.id, currentPrice);
```

## Manual Triggering

### For Testing

```typescript
import { triggerPriceAlertCheck } from './jobs/price-alert-checker';

const stats = await triggerPriceAlertCheck();
// Returns: { checked: 25, triggered: 3, skipped: 5 }
```

### Via Admin API (Future Enhancement)

```http
POST /api/admin/jobs/trigger-price-alert-check
Authorization: Bearer <admin-token>
```

## Monitoring

### Logs

```json
{
  "level": "info",
  "message": "[PriceAlertChecker] Alert check completed",
  "checked": 25,
  "triggered": 3,
  "skipped": 5
}
```

### Metrics Tracked

- `checked`: Total number of active alerts processed
- `triggered`: Number of alerts that met target price and triggered notifications
- `skipped`: Number of alerts skipped (no in-stock offers available)

### Status Check

```typescript
import { getPriceAlertCheckerJobStatus } from './jobs/price-alert-checker';

const status = getPriceAlertCheckerJobStatus();
// Returns: { alertCheckerJob: true }
```

## Error Handling

- **Per-alert errors**: Logged but don't stop processing other alerts
- **Job-level errors**: Logged and re-thrown (cron will retry on next schedule)
- **Lock acquisition failure**: Silently skips (normal in multi-server setup)

## Complementary Systems

### Event-Driven (Primary)

Price alerts are primarily checked when scrapers update product prices:

```typescript
// server/utils/price-change-hooks.ts
await processPriceChange(productOfferId, newPrice, {
  percentageThreshold: 10,
  recentPeakDays: 30,
});
```

### Scheduled (Backup)

This job acts as a safety net for:
- Products not recently scraped
- Scraper downtime/failures
- Manual price updates via admin
- Database inconsistencies

## Performance Considerations

### Database Load

- Single JOIN query per run (not per alert)
- Uses indexes on `priceAlerts.isActive` and `productOffers.availability`
- GROUP BY aggregates prices at database level

### Expected Volume

At 1000 active alerts:
- Query time: ~200ms
- Processing time: ~2-5 seconds (with notification creation)
- Database queries: 1 main query + 1 per triggered alert

### Scaling

For 10,000+ alerts:
- Consider batching (process 1000 at a time)
- Add pagination to main query
- Monitor lock TTL (may need longer for large batches)

## Future Enhancements

1. **Batch Processing**: Process alerts in chunks for very large volumes
2. **Priority Tiers**: Check high-priority alerts more frequently
3. **Smart Scheduling**: Adjust frequency based on alert creation rate
4. **Circuit Breaker**: Limit notifications per user per run (see `docs/07_BACKGROUND_JOBS_PATTERNS.md`)
5. **Metrics Dashboard**: Track triggered alerts over time

## Related Files

- **Job Definition**: `server/jobs/price-alert-checker.ts`
- **Service**: `server/services/price-drop-detection.ts`
- **Event Hook**: `server/utils/price-change-hooks.ts`
- **Lock Service**: `server/services/job-lock-service.ts`
- **Patterns**: `docs/07_BACKGROUND_JOBS_PATTERNS.md`
