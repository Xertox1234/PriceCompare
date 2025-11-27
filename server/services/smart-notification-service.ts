import { storage } from "../storage";
import { notifications, products, productOffers, priceHistory } from "../../shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { getRedisClient } from "../config/redis";
import { createNotification, getUserPreferences } from "./notification-service";
import { websocketService } from "./websocket-service";
import { emailService } from "./email-service";
import { createLogger } from "../utils/logger";

const log = createLogger("SmartNotification");

/**
 * Smart Notification Service
 *
 * Analyzes watched products for price drops, stock changes, and predictions,
 * then sends timely, prioritized alerts via WebSocket and email.
 */

export interface ProductData {
  currentPrice: number;
  lowestPrice: number;
  averagePrice: number;
  priceDropPercent: number;
  stockStatus?: 'in_stock' | 'limited_stock' | 'out_of_stock';
  alertStatus?: 'active' | 'triggered' | 'none';
}

export interface NotificationTrigger {
  shouldNotify: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  type: 'price_drop' | 'stock_low' | 'prediction' | 'seasonal';
  condition: string;
  threshold: number;
  currentValue: number;
  reasoning: string[];
  metadata: {
    productId: number;
    savings: number;
    confidence: number;
  };
  expiresAt: Date;
}

/**
 * Analyze if a product meets criteria for smart notification
 */
export async function analyzeNotificationTriggers(
  productId: number,
  userId: number,
  currentData: ProductData
): Promise<NotificationTrigger> {
  const { currentPrice, lowestPrice, averagePrice, priceDropPercent, stockStatus } = currentData;

  const reasoning: string[] = [];
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let type: 'price_drop' | 'stock_low' | 'prediction' | 'seasonal' = 'price_drop';
  let shouldNotify = false;
  let threshold = 0;
  let expiresAt = new Date();

  // Critical: Price at historical low AND stock is low
  if (currentPrice <= lowestPrice && stockStatus === 'limited_stock') {
    urgency = 'critical';
    type = 'price_drop';
    shouldNotify = true;
    threshold = lowestPrice;
    reasoning.push('Lowest price in history');
    reasoning.push('Stock running low');
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
  // High: Price dropped 15%+ from average
  else if (currentPrice < averagePrice * 0.85) {
    urgency = 'high';
    type = 'price_drop';
    shouldNotify = true;
    threshold = averagePrice * 0.85;
    reasoning.push(`Price dropped ${priceDropPercent.toFixed(1)}% from average`);
    reasoning.push(`Save $${(averagePrice - currentPrice).toFixed(2)}`);
    expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
  }
  // Medium: Price dropped 10%+ from average
  else if (currentPrice < averagePrice * 0.90) {
    urgency = 'medium';
    type = 'price_drop';
    shouldNotify = true;
    threshold = averagePrice * 0.90;
    reasoning.push(`Price dropped ${priceDropPercent.toFixed(1)}% from average`);
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  }
  // Low: Price dropped 5%+ from average
  else if (currentPrice < averagePrice * 0.95) {
    urgency = 'low';
    type = 'price_drop';
    shouldNotify = true;
    threshold = averagePrice * 0.95;
    reasoning.push(`Price dropped ${priceDropPercent.toFixed(1)}% from average`);
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  }

  // Check if price is at historical low
  if (currentPrice <= lowestPrice && shouldNotify) {
    reasoning.push('At lowest price in 90 days');
  }

  const savings = averagePrice - currentPrice;
  const confidence = urgency === 'critical' ? 0.95 : urgency === 'high' ? 0.85 : urgency === 'medium' ? 0.75 : 0.65;

  return {
    shouldNotify,
    urgency,
    type,
    condition: `Price dropped ${priceDropPercent.toFixed(1)}%`,
    threshold,
    currentValue: currentPrice,
    reasoning,
    metadata: {
      productId,
      savings,
      confidence
    },
    expiresAt
  };
}

/**
 * Prioritize notifications by priority score
 */
export function prioritizeNotifications(notifications: NotificationTrigger[]): NotificationTrigger[] {
  const urgencyWeight: Record<string, number> = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25
  };

  const calculateScore = (notification: NotificationTrigger): number => {
    const urgencyScore = urgencyWeight[notification.urgency] || 0;
    const savingsScore = (notification.metadata.savings / 100) * 50; // $100 savings = 50 points
    const timeSensitivity =
      notification.expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000 ? 25 : 0;

    return urgencyScore + savingsScore + timeSensitivity;
  };

  return notifications
    .map(n => ({ notification: n, score: calculateScore(n) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.notification);
}

/**
 * Check if user should receive notification based on preferences and rate limits
 */
export async function shouldNotifyUser(
  userId: number,
  trigger: NotificationTrigger
): Promise<{ allowed: boolean; reason?: string }> {
  const redisClient = getRedisClient();

  // Check deduplication (same product, same trigger type within 6 hours)
  const dedupKey = `notif:dedup:${userId}:${trigger.metadata.productId}:${trigger.type}`;

  if (redisClient) {
    const exists = await redisClient.get(dedupKey);
    if (exists) {
      return { allowed: false, reason: 'Duplicate notification within 6 hours' };
    }
  }

  // Check daily limit (max 3 smart notifications per day)
  const todayCount = await getSmartNotificationCount(userId, 'today');
  if (todayCount >= 3) {
    return { allowed: false, reason: 'Daily limit reached (3/day)' };
  }

  // Get user preferences
  const prefs = await getUserPreferences(userId);

  // Check if in-app notifications are enabled
  if (!prefs.inAppEnabled) {
    return { allowed: false, reason: 'In-app notifications disabled' };
  }

  // Check quiet hours
  if (prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null) {
    const now = new Date();
    const currentHour = now.getHours();

    if (isInQuietHours(currentHour, prefs.quietHoursStart, prefs.quietHoursEnd)) {
      return { allowed: false, reason: 'User in quiet hours' };
    }
  }

  return { allowed: true };
}

/**
 * Helper to check if current hour is in quiet hours
 */
function isInQuietHours(currentHour: number, start: number, end: number): boolean {
  if (start < end) {
    return currentHour >= start && currentHour < end;
  } else {
    // Quiet hours span midnight
    return currentHour >= start || currentHour < end;
  }
}

/**
 * Get count of smart notifications sent today
 */
async function getSmartNotificationCount(userId: number, period: 'today'): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await storage.getNotificationCountByType(userId, 'smart_alert', today);
}

/**
 * Create smart notification in database and queue delivery
 */
export async function createSmartNotification(
  userId: number,
  trigger: NotificationTrigger
): Promise<void> {
  const redisClient = getRedisClient();

  // Get product details
  const product = await storage.getProductByIdRaw(trigger.metadata.productId);

  if (!product) {
    log.error('Product not found for notification', { productId: trigger.metadata.productId });
    return;
  }

  // Prepare notification content
  const title = `${trigger.urgency.toUpperCase()}: ${trigger.condition} - ${product.name}`;
  const content = trigger.reasoning.join('. ');

  try {
    // Create notification record via notification-service
    // Note: createNotification already uses transaction for atomicity
    const notification = await createNotification({
      userId,
      type: 'smart_alert' as const,
      title,
      content,
      relatedProductId: trigger.metadata.productId,
      isRead: false
    });

    // Set deduplication key in Redis (6-hour TTL)
    if (redisClient) {
      const dedupKey = `notif:dedup:${userId}:${trigger.metadata.productId}:${trigger.type}`;
      await redisClient.setex(dedupKey, 6 * 60 * 60, '1'); // 6 hours
    }

    // Queue WebSocket delivery (immediate)
    websocketService.broadcast('notification:new', {
      userId,
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        urgency: trigger.urgency,
        productId: trigger.metadata.productId,
        savings: trigger.metadata.savings,
        createdAt: notification.createdAt
      }
    });

    // Queue email delivery (if user enabled email notifications)
    const prefs = await getUserPreferences(userId);
    if (prefs.emailEnabled && emailService.isReady()) {
      // Get user email
      const user = await storage.getUserEmailById(userId);

      if (user?.email) {
        // Send email notification (async, don't block)
        emailService.sendEmail({
          to: user.email,
          subject: title,
          html: `
            <h2>${title}</h2>
            <p>${content}</p>
            <p><strong>Product:</strong> ${product.name}</p>
            <p><strong>Savings:</strong> $${trigger.metadata.savings.toFixed(2)}</p>
            <p><a href="${process.env.APP_URL || 'http://localhost:5000'}/products/${product.id}">View Product</a></p>
          `,
          text: `${title}\n\n${content}\n\nProduct: ${product.name}\nSavings: $${trigger.metadata.savings.toFixed(2)}`
        }).catch(error => {
          log.error('Failed to send email notification', { error: error.message, userId });
        });
      }
    }

    log.info('Smart notification created and delivered', {
      userId,
      productId: trigger.metadata.productId,
      urgency: trigger.urgency,
      notificationId: notification.id
    });
  } catch (error) {
    // If notification creation fails due to user preferences, log it
    if (error instanceof Error) {
      if (error.message.includes('disabled') || error.message.includes('quiet hours') || error.message.includes('Daily notification limit')) {
        log.debug('Notification not created due to user preferences', {
          userId,
          reason: error.message
        });
      } else {
        log.error('Failed to create smart notification', {
          error: error.message,
          userId,
          productId: trigger.metadata.productId
        });
        throw error;
      }
    }
  }
}
