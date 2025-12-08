import { logger } from '../utils/logger';
import { eventBus, AppEvents } from '../utils/event-bus';
import type { DashboardMetrics } from './monitoring-service';

/**
 * Alert Service
 *
 * Handles alerting for critical system events via Slack and WebSocket
 */

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: DashboardMetrics) => boolean;
  level: AlertLevel;
  message: (metrics: DashboardMetrics) => string;
  cooldown: number; // milliseconds
}

class AlertService {
  private lastAlertTimes: Map<string, number> = new Map();
  private alertHistory: Alert[] = [];
  private readonly MAX_HISTORY = 100;

  // Alert rules
  private rules: AlertRule[] = [
    {
      id: 'high_error_rate',
      name: 'High Error Rate',
      level: 'critical',
      condition: (metrics) => {
        const { jobs } = metrics;
        const errorRate = jobs.total > 0 ? jobs.failed / jobs.total : 0;
        return errorRate > 0.2; // 20% error rate
      },
      message: (metrics) =>
        `⚠️ High error rate detected: ${Math.round((metrics.jobs.failed / metrics.jobs.total) * 100)}% (${metrics.jobs.failed}/${metrics.jobs.total} jobs failed)`,
      cooldown: 300000, // 5 minutes
    },
    {
      id: 'queue_backlog',
      name: 'Queue Backlog',
      level: 'warning',
      condition: (metrics) => metrics.jobs.pending > 100,
      message: (metrics) => `📊 Job queue backlog: ${metrics.jobs.pending} pending jobs`,
      cooldown: 600000, // 10 minutes
    },
    {
      id: 'agent_down',
      name: 'Agent Down',
      level: 'critical',
      condition: (metrics) => metrics.agents.active === 0 && metrics.agents.total > 0,
      message: () => `🔴 No active agents detected`,
      cooldown: 60000, // 1 minute
    },
    {
      id: 'redis_down',
      name: 'Redis Disconnected',
      level: 'critical',
      condition: (metrics) => !metrics.health.services.redis,
      message: () => `❌ Redis connection lost`,
      cooldown: 300000, // 5 minutes
    },
    {
      id: 'low_success_rate',
      name: 'Low Success Rate',
      level: 'warning',
      condition: (metrics) => metrics.jobs.successRate < 0.8 && metrics.jobs.total > 10,
      message: (metrics) => `📉 Low success rate: ${Math.round(metrics.jobs.successRate * 100)}%`,
      cooldown: 300000, // 5 minutes
    },
    {
      id: 'cache_low_hit_rate',
      name: 'Low Cache Hit Rate',
      level: 'warning',
      condition: (metrics) => {
        const totalRequests = metrics.cache.overall.totalHits + metrics.cache.overall.totalMisses;
        return totalRequests > 50 && metrics.cache.overall.combinedHitRate < 0.7;
      },
      message: (metrics) =>
        `💾 Low cache hit rate: ${Math.round(metrics.cache.overall.combinedHitRate * 100)}%`,
      cooldown: 600000, // 10 minutes
    },
  ];

  /**
   * Check all alert rules against current metrics
   */
  async checkAlerts(metrics: DashboardMetrics): Promise<void> {
    for (const rule of this.rules) {
      try {
        if (rule.condition(metrics)) {
          await this.triggerAlert(rule, metrics);
        }
      } catch (error: unknown) {
        logger.error(`Alert rule check failed: ${rule.name}`, {
          error: error instanceof Error ? error.message : String(error),
          ruleId: rule.id,
        });
      }
    }
  }

  /**
   * Trigger an alert if not in cooldown
   */
  private async triggerAlert(rule: AlertRule, metrics: DashboardMetrics): Promise<void> {
    const now = Date.now();
    const lastAlertTime = this.lastAlertTimes.get(rule.id) || 0;

    // Check cooldown
    if (now - lastAlertTime < rule.cooldown) {
      logger.debug(`Alert in cooldown: ${rule.name}`, {
        ruleId: rule.id,
        cooldownRemaining: rule.cooldown - (now - lastAlertTime),
      });
      return;
    }

    const alert: Alert = {
      id: `${rule.id}_${now}`,
      level: rule.level,
      title: rule.name,
      message: rule.message(metrics),
      context: {
        ruleId: rule.id,
        metrics,
      },
      timestamp: new Date().toISOString(),
    };

    // Store alert
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > this.MAX_HISTORY) {
      this.alertHistory = this.alertHistory.slice(0, this.MAX_HISTORY);
    }

    // Update last alert time
    this.lastAlertTimes.set(rule.id, now);

    // Log alert
    logger.warn(`Alert triggered: ${rule.name}`, {
      level: rule.level,
      message: alert.message,
      ruleId: rule.id,
    });

    // Send to Slack
    await this.sendSlackAlert(alert);

    // Emit event for WebSocket broadcast (decoupled via event bus)
    eventBus.emit(AppEvents.ALERT_TRIGGERED, {
      alertId: alert.id,
      ruleName: alert.title,
      severity: alert.level,
      message: alert.message,
      data: alert.context,
      timestamp: alert.timestamp,
    });
  }

  /**
   * Send alert to Slack webhook
   */
  private async sendSlackAlert(alert: Alert): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      logger.debug('Slack webhook not configured, skipping Slack alert');
      return;
    }

    try {
      const color = this.getAlertColor(alert.level);
      const emoji = this.getAlertEmoji(alert.level);

      const payload = {
        text: `${emoji} *${alert.title}*`,
        attachments: [
          {
            color,
            text: alert.message,
            fields: [
              {
                title: 'Severity',
                value: alert.level.toUpperCase(),
                short: true,
              },
              {
                title: 'Timestamp',
                value: new Date(alert.timestamp).toLocaleString(),
                short: true,
              },
            ],
            footer: 'PriceCompare AI Agent Monitoring',
            ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
      }

      logger.info('Slack alert sent successfully', {
        alertId: alert.id,
        level: alert.level,
      });
    } catch (error: unknown) {
      logger.error('Failed to send Slack alert', {
        error: error instanceof Error ? error.message : String(error),
        alertId: alert.id,
      });
    }
  }

  /**
   * Manually trigger a custom alert
   */
  async sendCustomAlert(
    level: AlertLevel,
    title: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    const alert: Alert = {
      id: `custom_${Date.now()}`,
      level,
      title,
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    // Store alert
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > this.MAX_HISTORY) {
      this.alertHistory = this.alertHistory.slice(0, this.MAX_HISTORY);
    }

    // Log alert
    logger.info(`Custom alert: ${title}`, {
      level,
      message,
    });

    // Send to Slack
    await this.sendSlackAlert(alert);

    // Emit event for WebSocket broadcast (decoupled via event bus)
    eventBus.emit(AppEvents.ALERT_TRIGGERED, {
      alertId: alert.id,
      ruleName: alert.title,
      severity: alert.level,
      message: alert.message,
      data: alert.context,
      timestamp: alert.timestamp,
    });
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 20): Alert[] {
    return this.alertHistory.slice(0, limit);
  }

  /**
   * Clear alert history
   */
  clearHistory(): void {
    this.alertHistory = [];
    logger.info('Alert history cleared');
  }

  /**
   * Get alert color for Slack
   */
  private getAlertColor(level: AlertLevel): string {
    switch (level) {
      case 'critical':
        return 'danger'; // red
      case 'warning':
        return 'warning'; // yellow
      case 'info':
        return 'good'; // green
      default:
        return '#808080'; // gray
    }
  }

  /**
   * Get alert emoji
   */
  private getAlertEmoji(level: AlertLevel): string {
    switch (level) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  }

  /**
   * Reset cooldowns (for testing)
   */
  resetCooldowns(): void {
    this.lastAlertTimes.clear();
    logger.info('Alert cooldowns reset');
  }
}

// Singleton instance
export const alertService = new AlertService();
