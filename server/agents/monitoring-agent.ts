import { BaseAgent } from './base-agent';
import { dataExtractionAgent } from './extraction-agent';
import { db } from '../db';
import { productOffers, priceAlerts, products, retailers } from '@shared/schema';
import { eq, lt, and, desc, gte, isNotNull } from 'drizzle-orm';
import { ScraperUtils } from '../utils/scraper-utils';
import type { MonitoringTask, PriceChange, MonitoringStats } from './types.js';
import { logger } from '../utils/logger.js';

interface AlertNotification {
  alertId: number;
  userId: number;
  productName: string;
  targetPrice: number;
  currentPrice: number;
  retailerName: string;
  url: string;
}

/**
 * Price Monitoring Agent - Tracks price changes and triggers alerts
 */
export class PriceMonitoringAgent extends BaseAgent {
  private alertThresholds: { significant: number; major: number };
  private monitoringIntervals: Map<string, number>;

  constructor() {
    super({
      name: 'Price Monitoring Agent',
      type: 'monitoring',
      maxConcurrentTasks: 5,
      retryAttempts: 3,
      retryDelay: 2000
    });

    this.alertThresholds = {
      significant: 0.1, // 10% price change
      major: 0.2 // 20% price change
    };

    // Monitoring intervals by retailer (in hours)
    this.monitoringIntervals = new Map([
      ['amazon.com', 6],    // Check every 6 hours
      ['walmart.com', 8],   // Check every 8 hours
      ['target.com', 12],   // Check every 12 hours
      ['default', 24]       // Default 24 hours
    ]);
  }

  // Logging helpers
  protected logInfo(message: string): void {
    logger.info(`[${this.config.name}] ${message}`);
  }

  protected logError(message: string): void {
    logger.error(`[${this.config.name}] ERROR: ${message}`);
  }

  async processTask(task: MonitoringTask): Promise<any> {
    switch (task.action) {
      case 'monitor_price_changes':
        return await this.monitorPriceChanges(task.maxAge);
      case 'check_alerts':
        return await this.checkPriceAlerts();
      case 'refresh_offers':
        return await this.refreshStaleOffers(task.maxAge);
      default:
        throw new Error(`Unknown monitoring task: ${task.action}`);
    }
  }

  /**
   * Monitor all product offers for price changes
   */
  private async monitorPriceChanges(maxAgeHours = 24): Promise<{ changes: PriceChange[]; checked: number }> {
    this.logInfo('Starting price change monitoring');
    
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    // Get offers that need checking
    const staleOffers = await db.query.productOffers.findMany({
      where: lt(productOffers.lastLinkCheck, cutoffTime),
      with: {
        product: true,
        retailer: true
      },
      limit: 50 // Process in batches
    }) /* TODO: Add proper return type */;

    this.logInfo(`Found ${staleOffers.length} offers to check`);

    const priceChanges: PriceChange[] = [];
    let checkedCount = 0;

    for (const offer of staleOffers) {
      try {
        await ScraperUtils.delay(3500, true); // Rate limiting

        const oldPrice = parseFloat(offer.price);
        const extractionResult = await dataExtractionAgent.processTask({
          action: 'extract_product_data',
          url: offer.productUrl || '',
          retailer: offer.retailer?.website || '',
          productId: offer.productId
        });

        if (extractionResult.success && extractionResult.data.price) {
          const newPrice = parseFloat(extractionResult.data.price);

          // Update the offer with new data
          await db.update(productOffers)
            .set({
              price: extractionResult.data.price.toString(),
              availability: extractionResult.data.availability,
              lastLinkCheck: new Date()
            })
            .where(eq(productOffers.id, offer.id));

          checkedCount++;

          // Check for significant price changes
          if (oldPrice !== newPrice) {
            const priceChange = newPrice - oldPrice;
            const percentChange = (priceChange / oldPrice) * 100;

            if (Math.abs(percentChange) >= this.alertThresholds.significant * 100) {
              const change: PriceChange = {
                offerId: offer.id,
                productName: offer.product?.name || 'Unknown Product',
                retailerName: offer.retailer?.name || 'Unknown Retailer',
                oldPrice,
                newPrice,
                priceChange,
                percentChange,
                url: offer.productUrl || ''
              };

              priceChanges.push(change);
              this.logInfo(`Significant price change detected: ${offer.product?.name} - ${percentChange.toFixed(1)}%`);
            }
          }
        }

      } catch (error) {
        this.logError(`Failed to check offer ${offer.id}: ${error}`);

        // Update last checked even if failed to avoid repeated failures
        await db.update(productOffers)
          .set({ lastLinkCheck: new Date() })
          .where(eq(productOffers.id, offer.id));
      }
    }

    this.logInfo(`Price monitoring complete: ${checkedCount} offers checked, ${priceChanges.length} changes found`);
    
    return { changes: priceChanges, checked: checkedCount };
  }

  /**
   * Check for triggered price alerts
   */
  private async checkPriceAlerts(): Promise<{ triggered: AlertNotification[]; checked: number }> {
    this.logInfo('Checking price alerts');

    // Get active price alerts with current offers
    const alerts = await db.query.priceAlerts.findMany({
      where: eq(priceAlerts.isActive, true),
      with: {
        product: {
          with: {
            offers: {
              with: {
                retailer: true
              },
              orderBy: [desc(productOffers.lastLinkCheck)]
            }
          }
        }
      }
    }) /* TODO: Add proper return type */;

    const triggeredAlerts: AlertNotification[] = [];

    for (const alert of alerts) {
      const product = alert.product;

      // Find the best current price across all retailers
      const offers = (product?.offers || []) /* TODO: Add proper return type */;
      const bestOffer = offers
        .filter((offer: unknown) => offer.availability === 'in_stock')
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => parseFloat(a.price) - parseFloat(b.price))[0];

      const targetPrice = parseFloat(alert.targetPrice);
      const currentPrice = bestOffer ? parseFloat(bestOffer.price) : Infinity;

      if (bestOffer && currentPrice <= targetPrice) {
        const notification: AlertNotification = {
          alertId: alert.id,
          userId: alert.userId,
          productName: product?.name || 'Unknown Product',
          targetPrice,
          currentPrice,
          retailerName: bestOffer.retailer?.name || 'Unknown Retailer',
          url: bestOffer.productUrl || ''
        };

        triggeredAlerts.push(notification);
        this.logInfo(`Price alert triggered: ${product?.name} at $${currentPrice}`);

        // Deactivate the alert
        await db.update(priceAlerts)
          .set({
            isActive: false
          })
          .where(eq(priceAlerts.id, alert.id));
      }
    }

    this.logInfo(`Alert check complete: ${alerts.length} alerts checked, ${triggeredAlerts.length} triggered`);

    return { triggered: triggeredAlerts, checked: alerts.length };
  }

  /**
   * Refresh offers that haven't been checked recently
   */
  private async refreshStaleOffers(maxAgeHours = 48): Promise<{ refreshed: number; failed: number }> {
    this.logInfo(`Refreshing offers older than ${maxAgeHours} hours`);

    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const staleOffers = await db.query.productOffers.findMany({
      where: lt(productOffers.lastLinkCheck, cutoffTime),
      with: {
        retailer: true,
        product: true
      },
      limit: 20 // Smaller batch for full refresh
    }) /* TODO: Add proper return type */;

    let refreshed = 0;
    let failed = 0;

    for (const offer of staleOffers) {
      try {
        await ScraperUtils.delay(5000, true); // Longer delays for full refresh

        const result = await dataExtractionAgent.processTask({
          action: 'extract_product_data',
          url: offer.productUrl || '',
          retailer: offer.retailer?.website || '',
          productId: offer.productId
        });

        if (result.success) {
          refreshed++;
          this.logInfo(`Refreshed offer: ${offer.product?.name} from ${offer.retailer?.name}`);
        } else {
          failed++;
        }

      } catch (error) {
        failed++;
        this.logError(`Failed to refresh offer ${offer.id}: ${error}`);

        // Mark as checked to avoid infinite retries
        await db.update(productOffers)
          .set({ lastLinkCheck: new Date() })
          .where(eq(productOffers.id, offer.id));
      }
    }

    this.logInfo(`Refresh complete: ${refreshed} successful, ${failed} failed`);

    return { refreshed, failed };
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(): Promise<MonitoringStats> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count recent price checks
    const recentChecks = await db.query.productOffers.findMany({
      where: gte(productOffers.lastLinkCheck, last24h),
      columns: { id: true }
    });

    // Count active alerts
    const activeAlerts = await db.query.priceAlerts.findMany({
      where: eq(priceAlerts.isActive, true),
      columns: { id: true }
    });

    // Count inactive alerts (triggered alerts - field doesn't exist in schema)
    const inactiveAlerts = await db.query.priceAlerts.findMany({
      where: eq(priceAlerts.isActive, false),
      columns: { id: true }
    });

    // Get total offers
    const totalOffers = await db.query.productOffers.findMany({
      columns: { id: true }
    });

    // Get stale offers (>24h old)
    const staleOffers = await db.query.productOffers.findMany({
      where: lt(productOffers.lastLinkCheck, last24h),
      columns: { id: true }
    });

    return {
      totalOffers: totalOffers.length,
      recentChecks: recentChecks.length,
      staleOffers: staleOffers.length,
      activeAlerts: activeAlerts.length,
      inactiveAlerts: inactiveAlerts.length,
      monitoringHealth: {
        upToDate: ((totalOffers.length - staleOffers.length) / totalOffers.length * 100).toFixed(1) + '%',
        alertsTriggered: inactiveAlerts.length,
        averageCheckAge: '12 hours' // Could be calculated from actual data
      }
    };
  }

  /**
   * Schedule monitoring tasks based on retailer-specific intervals
   */
  async scheduleMonitoringTasks(): Promise<void> {
    this.logInfo('Scheduling monitoring tasks');
    
    // Schedule price change monitoring
    setTimeout(() => {
      this.processTask({ action: 'monitor_price_changes', maxAge: 12 });
    }, 1000);

    // Schedule alert checking
    setTimeout(() => {
      this.processTask({ action: 'check_alerts' });
    }, 5000);

    // Schedule periodic refresh
    setTimeout(() => {
      this.processTask({ action: 'refresh_offers', maxAge: 48 });
    }, 10000);
  }
}

export const priceMonitoringAgent = new PriceMonitoringAgent();