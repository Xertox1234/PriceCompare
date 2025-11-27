/**
 * Agent Query Limits Routes
 *
 * API endpoints for monitoring and managing AI agent query limits.
 * All endpoints require admin authentication except the status check.
 */
import type { Express } from 'express';
import { agentQueryLimiter } from '../services/agent-query-limiter';
import { withAuth, withAdmin } from './helpers';
import { sendSuccess, sendErrorFromException } from '../utils/api-response';
import { logger } from '../utils/logger';

/**
 * Register agent limits routes
 */
export function registerAgentLimitsRoutes(app: Express): void {
  /**
   * GET /api/agent-limits/status
   * Get current agent query usage statistics
   * Requires authentication
   */
  app.get('/api/agent-limits/status', withAuth(async (req, res) => {
    try {
      const stats = await agentQueryLimiter.getUsageStats();

      sendSuccess(res, {
        ...stats,
        percentUsed: Math.round((stats.totalUsed / stats.dailyLimit) * 100),
        resetTimeFormatted: stats.resetTime.toISOString()
      });
    } catch (error) {
      sendErrorFromException(res, error, 'GetAgentLimitStatus');
    }
  }));

  /**
   * GET /api/agent-limits/remaining
   * Quick check of remaining queries
   * Requires authentication
   */
  app.get('/api/agent-limits/remaining', withAuth(async (req, res) => {
    try {
      const remaining = await agentQueryLimiter.checkRemaining();
      const limit = agentQueryLimiter.getDailyLimit();

      sendSuccess(res, {
        remaining,
        limit,
        percentRemaining: Math.round((remaining / limit) * 100)
      });
    } catch (error) {
      sendErrorFromException(res, error, 'GetRemainingQueries');
    }
  }));

  /**
   * POST /api/agent-limits/reset
   * Reset daily query counter (admin only)
   * Use with caution - mainly for testing or emergency situations
   */
  app.post('/api/agent-limits/reset', withAdmin(async (req, res) => {
    try {
      await agentQueryLimiter.resetDailyLimit();

      logger.info('Agent query limit reset by admin', {
        userId: req.user?.id,
        username: req.user?.username
      });

      sendSuccess(res, {
        message: 'Daily agent query limit has been reset'
      });
    } catch (error) {
      sendErrorFromException(res, error, 'ResetAgentLimit');
    }
  }));

  /**
   * GET /api/agent-limits/config
   * Get limit configuration (admin only)
   */
  app.get('/api/agent-limits/config', withAdmin(async (req, res) => {
    try {
      const limit = agentQueryLimiter.getDailyLimit();
      const configuredLimit = process.env.AGENT_DAILY_QUERY_LIMIT || '100 (default)';

      sendSuccess(res, {
        dailyLimit: limit,
        configuredValue: configuredLimit,
        envVariable: 'AGENT_DAILY_QUERY_LIMIT',
        description: 'Maximum number of AI agent queries allowed per day (Google Search, OpenAI, etc.)',
        resetSchedule: 'Midnight UTC daily'
      });
    } catch (error) {
      sendErrorFromException(res, error, 'GetAgentLimitConfig');
    }
  }));
}
