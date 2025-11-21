# WebSocket Event Handler Integration Guide

This guide shows how to integrate WebSocket events into existing backend services.

## Overview

The WebSocket event handler system provides real-time notifications for:
- **Watch List Updates**: Created, updated, deleted, products added/removed
- **Notifications**: New notifications, mark as read, unread count updates
- **Price Updates**: Price changes, price alerts

## Integration Points

### 1. Storage Layer (server/storage.ts)

After watch list operations, emit WebSocket events to notify connected clients.

#### Example: Create Watch List

```typescript
import { getSocketIO, emitWatchListUpdate } from './websocket';

async createWatchList(userId: number, data: { name: string; description?: string }): Promise<WatchList> {
  // ... existing validation and creation logic ...

  const [result] = await db
    .insert(watchLists)
    .values({
      userId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
    })
    .returning();

  // Emit WebSocket event to user's connected clients
  const io = getSocketIO();
  if (io) {
    emitWatchListUpdate(io, userId, 'created', {
      id: result.id,
      name: result.name,
      description: result.description,
      productCount: 0,
    });
  }

  return result;
}
```

#### Example: Update Watch List

```typescript
async updateWatchList(
  watchListId: number,
  userId: number,
  updates: { name?: string; description?: string }
): Promise<WatchList> {
  // ... existing validation and update logic ...

  const [result] = await db
    .update(watchLists)
    .set(updateData)
    .where(and(
      eq(watchLists.id, watchListId),
      eq(watchLists.userId, userId)
    ))
    .returning();

  if (!result) {
    throw new Error('Watch list not found or unauthorized');
  }

  // Emit WebSocket event
  const io = getSocketIO();
  if (io) {
    emitWatchListUpdate(io, userId, 'updated', {
      id: result.id,
      name: result.name,
      description: result.description,
    });
  }

  return result;
}
```

#### Example: Delete Watch List

```typescript
async deleteWatchList(watchListId: number, userId: number): Promise<WatchList> {
  const [result] = await db
    .delete(watchLists)
    .where(and(
      eq(watchLists.id, watchListId),
      eq(watchLists.userId, userId)
    ))
    .returning();

  if (!result) {
    throw new Error('Watch list not found or unauthorized');
  }

  // Emit WebSocket event
  const io = getSocketIO();
  if (io) {
    emitWatchListUpdate(io, userId, 'deleted', {
      id: result.id,
      name: result.name,
    });
  }

  return result;
}
```

#### Example: Add Product to Watch List

```typescript
import { emitProductAdded } from './websocket';

async addProductToWatchList(
  watchListId: number,
  productId: number,
  userId: number
): Promise<ProductWatch> {
  return await db.transaction(async (tx) => {
    // ... existing validation and insertion logic ...

    const [result] = await tx
      .insert(productWatches)
      .values({
        userId,
        productId,
        watchListId,
      })
      .returning();

    // Fetch product details for the event
    const [product] = await tx
      .select({
        id: products.id,
        name: products.name,
        image: products.image,
        currentPrice: sql<number | null>`
          (SELECT MIN(CAST(price AS DECIMAL))
           FROM ${productOffers}
           WHERE ${productOffers.productId} = ${products.id})
        `.as('current_price'),
      })
      .from(products)
      .where(eq(products.id, productId));

    // Emit WebSocket event (after transaction commits)
    const io = getSocketIO();
    if (io && product) {
      emitProductAdded(io, userId, watchListId, {
        id: product.id,
        name: product.name,
        image: product.image,
        currentPrice: product.currentPrice,
      });
    }

    return result;
  }, {
    isolationLevel: 'serializable'
  });
}
```

#### Example: Remove Product from Watch List

```typescript
import { emitProductRemoved } from './websocket';

async removeProductFromWatchList(
  watchListId: number,
  productId: number,
  userId: number
): Promise<ProductWatch> {
  const [result] = await db
    .delete(productWatches)
    .where(and(
      eq(productWatches.watchListId, watchListId),
      eq(productWatches.productId, productId),
      eq(productWatches.userId, userId)
    ))
    .returning();

  if (!result) {
    throw new Error('Product watch not found or unauthorized');
  }

  // Emit WebSocket event
  const io = getSocketIO();
  if (io) {
    emitProductRemoved(io, userId, watchListId, productId);
  }

  return result;
}
```

### 2. Notification Service (server/services/notification-service.ts)

After creating notifications, emit WebSocket events to notify connected clients in real-time.

#### Example: Create Notification

```typescript
import { getSocketIO, emitNewNotification } from '../websocket';

export async function createNotification(
  notification: InsertNotification
): Promise<Notification> {
  // ... existing validation and creation logic ...

  const created = await db.transaction(async (tx) => {
    // ... check daily limit and create notification ...

    const result = await tx.insert(notifications).values(notification).returning();
    const created = getFirstResult(result);
    if (!created) {
      throw new Error('Failed to create notification');
    }
    return created;
  }, {
    isolationLevel: 'serializable',
  });

  // After successful creation, emit WebSocket event
  const io = getSocketIO();
  if (io) {
    // Get updated unread count
    const stats = await getNotificationStats(notification.userId);

    emitNewNotification(io, notification.userId, {
      id: created.id,
      type: created.type,
      title: created.title,
      content: created.content,
      priority: created.priority || 'medium',
      metadata: created.metadata,
    }, stats.unread);
  }

  return created;
}
```

### 3. Price Monitoring Service

When price changes are detected, emit events to subscribed clients.

#### Example: Price Change Detection

```typescript
import { getSocketIO, emitPriceUpdate, getWatchedProductIds } from '../websocket';

export async function checkPriceChanges(): Promise<void> {
  const io = getSocketIO();
  if (!io) return;

  // Get list of products that clients are actively watching
  const watchedProductIds = getWatchedProductIds();

  // Only monitor actively watched products for real-time updates
  for (const productId of watchedProductIds) {
    const priceChange = await detectPriceChange(productId);

    if (priceChange) {
      emitPriceUpdate(io, productId, {
        productName: priceChange.productName,
        retailerName: priceChange.retailerName,
        oldPrice: priceChange.oldPrice,
        newPrice: priceChange.newPrice,
        percentageChange: priceChange.percentageChange,
      });
    }
  }
}
```

#### Example: Price Alert Trigger

```typescript
import { emitPriceAlert } from '../websocket';

export async function checkPriceAlerts(): Promise<void> {
  const io = getSocketIO();
  if (!io) return;

  // Check all active alerts
  const triggeredAlerts = await findTriggeredAlerts();

  for (const alert of triggeredAlerts) {
    // Send in-app notification
    await createNotification({
      userId: alert.userId,
      type: 'price_alert',
      title: `Price Alert: ${alert.productName}`,
      content: `Price dropped to $${alert.currentPrice}!`,
      priority: 'high',
      relatedEntityId: alert.productId,
    });

    // Also send real-time WebSocket event
    emitPriceAlert(io, alert.userId, {
      alertId: alert.id,
      productId: alert.productId,
      productName: alert.productName,
      currentPrice: alert.currentPrice,
      previousPrice: alert.previousPrice,
      targetPrice: alert.targetPrice,
      percentageChange: alert.percentageChange,
      retailerName: alert.retailerName,
      retailerUrl: alert.retailerUrl,
    });
  }
}
```

## Rate Limiting

All client-initiated events have rate limiting:

- **Watch List Subscriptions**: 10 requests/second per user
- **Notification Subscriptions**: 10 requests/second per user
- **Mark Notification as Read**: 20 requests/second per user
- **Price Update Subscriptions**: 5 requests/second per user
- **Price Subscriptions Limit**: Max 100 products per user

## Error Handling

All event handlers use centralized error handling:

```typescript
import { handleSocketError } from '../websocket/middleware/error-handler';

socket.on('some:event', async (data) => {
  try {
    // Event logic
  } catch (error) {
    handleSocketError(socket, error, {
      event: 'some:event',
      userId: socket.userId,
    });
  }
});
```

Errors are:
1. Logged with full context
2. Sanitized to user-friendly messages
3. Emitted back to client with error code
4. Tracked for monitoring

## Testing

Test WebSocket events using Socket.io client:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000/ws', {
  withCredentials: true, // Include session cookie
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);

  // Subscribe to watch list updates
  socket.emit('subscribe:watchlists');
});

socket.on('watchlist:update', (data) => {
  console.log('Watch list updated:', data);
});

socket.on('error', (error) => {
  console.error('Error:', error);
});
```

## Monitoring

Monitor WebSocket activity:

```typescript
import { getConnectedClientsCount, getPriceSubscriptionCount } from './websocket';

// Get active connections
const clientCount = getConnectedClientsCount();

// Get active price subscriptions
const subscriptionCount = getPriceSubscriptionCount();
```

## Best Practices

1. **Always check if Socket.io is initialized** before emitting events
2. **Emit events AFTER database transactions commit** to avoid inconsistencies
3. **Keep event payloads small** - avoid sending large objects
4. **Use rooms for targeted messaging** - don't broadcast unnecessarily
5. **Handle errors gracefully** - don't crash the server on client errors
6. **Log all events** for debugging and monitoring
7. **Rate limit client-initiated events** to prevent abuse
8. **Validate all incoming data** from clients

## Security Considerations

1. **Authentication**: All connections require valid session
2. **Authorization**: Verify user owns resources before emitting events
3. **Input Validation**: Validate all client event data
4. **Rate Limiting**: Applied to all client-initiated events
5. **Error Sanitization**: Don't expose internal details in production

## Next Steps

See the handler implementation files for complete details:
- `server/websocket/handlers/watch-list-handler.ts`
- `server/websocket/handlers/notification-handler.ts`
- `server/websocket/handlers/price-update-handler.ts`
