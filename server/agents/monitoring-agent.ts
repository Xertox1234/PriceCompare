import { BaseAgent } from './base-agent';
import { dataExtractionAgent } from './extraction-agent';
import { storage } from '../storage';
import { ScraperUtils } from '../utils/scraper-utils';
import type { MonitoringTask, MonitoringStats } from './types';
import { logger } from '../utils/logger';

interface PriceChange {
  offerId: number;
  productName: string;
  retailerName: string;
  oldPrice: number;
  newPrice: number;
  priceChange: number;
  percentChange: number;
  url: string;
}

interface MonitorPriceChangesResult {
  changes: PriceChange[];
  checked: number;
}

interface CheckAlertsResult {
  triggered: AlertNotification[];
  checked: number;
}

interface RefreshOffersResult {
  refreshed: number;
  failed: number;
}

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
      retryDelay: 2000,
    });

    this.alertThresholds = {
      significant: 0.1, // 10% price change
      major: 0.2, // 20% price change
    };

    // Monitoring intervals by retailer (in hours)
    this.monitoringIntervals = new Map([
      ['amazon.com', 6], // Check every 6 hours
      ['walmart.com', 8], // Check every 8 hours
      ['target.com', 12], // Check every 12 hours
      ['default', 24], // Default 24 hours
    ]);
  }

  // Logging helpers
  protected logInfo(message: string): void {
    logger.info(`[${this.config.name}] ${message}`);
  }

  protected logError(message: string): void {
    logger.error(`[${this.config.name}] ERROR: ${message}`);
  }

  async processTask(
    task: MonitoringTask
  ): Promise<MonitorPriceChangesResult | CheckAlertsResult | RefreshOffersResult> {
    switch (task.action) {
      case 'monitor_price_changes':
        return this.monitorPriceChanges(task.maxAge);
      case 'check_alerts':
        return this.checkPriceAlerts();
      case 'refresh_offers':
        return this.refreshStaleOffers(task.maxAge);
      default:
        throw new Error(`Unknown monitoring task: ${task.action}`);
    }
  }

  /**
   * Monitor all product offers for price changes
   */
  private async monitorPriceChanges(
    maxAgeHours = 24
  ): Promise<{ changes: PriceChange[]; checked: number }> {
    this.logInfo('Starting price change monitoring');

    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    // Get offers that need checking using storage layer
    const staleOffers = await storage.getPriceMonitoringOffers(cutoffTime, 50);

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
          productId: offer.productId,
        });

        if (extractionResult.success && extractionResult.data.price) {
          const newPrice = extractionResult.data.price;

          // Update the offer with new data using storage layer
          await storage.updateProductOffer(offer.id, {
            price: extractionResult.data.price.toString(),
            availability: extractionResult.data.availability,
            lastLinkCheck: new Date(),
          });

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
                url: offer.productUrl || '',
              };

              priceChanges.push(change);
              this.logInfo(
                `Significant price change detected: ${offer.product?.name} - ${percentChange.toFixed(1)}%`
              );
            }
          }
        }
      } catch (error) {
        this.logError(`Failed to check offer ${offer.id}: ${error}`);

        // Update last checked even if failed to avoid repeated failures
        await storage.updateProductOffer(offer.id, {
          lastLinkCheck: new Date(),
        });
      }
    }

    this.logInfo(
      `Price monitoring complete: ${checkedCount} offers checked, ${priceChanges.length} changes found`
    );

    return { changes: priceChanges, checked: checkedCount };
  }

  /**
   * Check for triggered price alerts
   */
  private async checkPriceAlerts(): Promise<{ triggered: AlertNotification[]; checked: number }> {
    this.logInfo('Checking price alerts');

    // Get active price alerts with current offers using storage layer
    const alerts = await storage.getActivePriceAlertsWithRelations();

    const triggeredAlerts: AlertNotification[] = [];

    for (const alert of alerts) {
      const product = alert.product;

      // Find the best current price across all retailers
      const offers = product?.offers || [];
      const bestOffer = offers
        .filter((offer) => offer.availability === 'in_stock')
        .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];

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
          url: bestOffer.productUrl || '',
        };

        triggeredAlerts.push(notification);
        this.logInfo(`Price alert triggered: ${product?.name} at $${currentPrice}`);

        // Deactivate the alert using storage layer (admin method - no user check needed)
        await storage.updatePriceAlertAdmin(alert.id, {
          isActive: false,
        });
      }
    }

    this.logInfo(
      `Alert check complete: ${alerts.length} alerts checked, ${triggeredAlerts.length} triggered`
    );

    return { triggered: triggeredAlerts, checked: alerts.length };
  }

  /**
   * Refresh offers that haven't been checked recently
   */
  private async refreshStaleOffers(
    maxAgeHours = 48
  ): Promise<{ refreshed: number; failed: number }> {
    this.logInfo(`Refreshing offers older than ${maxAgeHours} hours`);

    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    // Get stale offers using storage layer (smaller batch for full refresh)
    const staleOffers = await storage.getPriceMonitoringOffers(cutoffTime, 20);

    let refreshed = 0;
    let failed = 0;

    for (const offer of staleOffers) {
      try {
        await ScraperUtils.delay(5000, true); // Longer delays for full refresh

        const result = await dataExtractionAgent.processTask({
          action: 'extract_product_data',
          url: offer.productUrl || '',
          retailer: offer.retailer?.website || '',
          productId: offer.productId,
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
        await storage.updateProductOffer(offer.id, {
          lastLinkCheck: new Date(),
        });
      }
    }

    this.logInfo(`Refresh complete: ${refreshed} successful, ${failed} failed`);

    return { refreshed, failed };
  }

  /**
   * Get monitoring statistics using storage layer
   */
  async getMonitoringStats(): Promise<MonitoringStats> {
    return storage.getMonitoringStats() as Promise<MonitoringStats>;
  }

  /**
   * Schedule monitoring tasks based on retailer-specific intervals
   */
  scheduleMonitoringTasks(): void {
    this.logInfo('Scheduling monitoring tasks');

    // Schedule price change monitoring
    setTimeout(() => {
      void this.processTask({ action: 'monitor_price_changes', maxAge: 12 });
    }, 1000);

    // Schedule alert checking
    setTimeout(() => {
      void this.processTask({ action: 'check_alerts' });
    }, 5000);

    // Schedule periodic refresh
    setTimeout(() => {
      void this.processTask({ action: 'refresh_offers', maxAge: 48 });
    }, 10000);
  }
}

export const priceMonitoringAgent = new PriceMonitoringAgent();
