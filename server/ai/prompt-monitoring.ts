/**
 * Prompt Performance Monitoring System
 *
 * Tracks and logs AI prompt performance metrics including:
 * - Latency (response time)
 * - Quality scores
 * - Success/failure rates
 * - Token usage
 * - Cost estimation
 */

import { createLogger } from '../utils/logger';

const log = createLogger('PromptMonitoring');

export interface PromptExecutionMetrics {
  promptName: string;
  promptVersion: string;
  model: string;
  startTime: number;
  endTime?: number;
  latency?: number;
  success: boolean;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  qualityScore?: number;
  validationPassed?: boolean;
  validationErrors?: number;
  metadata?: Record<string, unknown>;
}

export interface PromptMetricsSummary {
  promptName: string;
  promptVersion: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  avgQualityScore: number;
  totalTokens: number;
  estimatedTotalCost: number;
  lastExecuted: Date;
}

class PromptMonitor {
  private metrics: PromptExecutionMetrics[] = [];
  private readonly MAX_METRICS_SIZE = 10000;

  // Pricing (per 1M tokens for gpt-4o-mini)
  private readonly PRICING = {
    'gpt-4o-mini': {
      input: 0.150,   // $0.150 per 1M input tokens
      output: 0.600   // $0.600 per 1M output tokens
    },
    'text-embedding-3-small': {
      input: 0.020,   // $0.020 per 1M tokens
      output: 0
    }
  };

  /**
   * Start tracking a prompt execution
   */
  startExecution(
    promptName: string,
    promptVersion: string,
    model: string,
    metadata?: Record<string, unknown>
  ): string {
    const executionId = `${promptName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const metrics: PromptExecutionMetrics = {
      promptName,
      promptVersion,
      model,
      startTime: Date.now(),
      success: false,
      metadata
    };

    this.metrics.push(metrics);
    this.enforceMetricsLimit();

    return executionId;
  }

  /**
   * Complete tracking of a prompt execution
   */
  completeExecution(
    promptName: string,
    success: boolean,
    options: {
      error?: string;
      inputTokens?: number;
      outputTokens?: number;
      qualityScore?: number;
      validationPassed?: boolean;
      validationErrors?: number;
    } = {}
  ): void {
    // Find the most recent execution for this prompt
    const execution = this.metrics
      .reverse()
      .find(m => m.promptName === promptName && !m.endTime);

    if (!execution) {
      log.warn('No active execution found', { promptName });
      return;
    }

    this.metrics.reverse(); // Restore original order

    execution.endTime = Date.now();
    execution.latency = execution.endTime - execution.startTime;
    execution.success = success;
    execution.error = options.error;
    execution.inputTokens = options.inputTokens;
    execution.outputTokens = options.outputTokens;
    execution.totalTokens = (options.inputTokens || 0) + (options.outputTokens || 0);
    execution.qualityScore = options.qualityScore;
    execution.validationPassed = options.validationPassed;
    execution.validationErrors = options.validationErrors;

    // Calculate cost
    if (execution.inputTokens || execution.outputTokens) {
      execution.estimatedCost = this.calculateCost(
        execution.model,
        execution.inputTokens || 0,
        execution.outputTokens || 0
      );
    }

    // Log the execution
    this.logExecution(execution);
  }

  /**
   * Calculate estimated cost based on token usage
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.PRICING[model as keyof typeof this.PRICING];
    if (!pricing) return 0;

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Log execution metrics
   */
  private logExecution(metrics: PromptExecutionMetrics): void {
    const latency = metrics.latency ? `${metrics.latency}ms` : 'N/A';
    const cost = metrics.estimatedCost ? `$${metrics.estimatedCost.toFixed(6)}` : 'N/A';
    const quality = metrics.qualityScore !== undefined ? metrics.qualityScore.toFixed(2) : 'N/A';

    const logData = {
      promptName: metrics.promptName,
      promptVersion: metrics.promptVersion,
      success: metrics.success,
      latency,
      quality,
      cost,
      tokens: metrics.totalTokens || 'N/A',
      error: metrics.error,
    };

    if (metrics.success) {
      log.info('AI prompt execution succeeded', logData);
    } else {
      log.error('AI prompt execution failed', logData);
    }

    // Log validation failures
    if (metrics.validationPassed === false && metrics.validationErrors) {
      log.warn('Validation failed', {
        promptName: metrics.promptName,
        validationErrors: metrics.validationErrors,
      });
    }
  }

  /**
   * Get summary metrics for a specific prompt
   */
  getSummary(promptName: string, promptVersion?: string): PromptMetricsSummary | null {
    const filtered = this.metrics.filter(
      m => m.promptName === promptName &&
      (promptVersion === undefined || m.promptVersion === promptVersion) &&
      m.endTime !== undefined
    );

    if (filtered.length === 0) return null;

    const successful = filtered.filter(m => m.success);
    const failed = filtered.filter(m => !m.success);

    const latencies = filtered.map(m => m.latency!).filter(l => l !== undefined);
    const qualityScores = filtered
      .map(m => m.qualityScore)
      .filter((q): q is number => q !== undefined);

    const totalTokens = filtered.reduce((sum, m) => sum + (m.totalTokens || 0), 0);
    const estimatedTotalCost = filtered.reduce((sum, m) => sum + (m.estimatedCost || 0), 0);

    const lastExecution = filtered.reduce((latest, m) =>
      m.endTime! > latest ? m.endTime! : latest,
      0
    );

    return {
      promptName,
      promptVersion: promptVersion || 'all',
      totalExecutions: filtered.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      successRate: successful.length / filtered.length,
      avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      avgQualityScore: qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0,
      totalTokens,
      estimatedTotalCost,
      lastExecuted: new Date(lastExecution)
    };
  }

  /**
   * Get all metrics for a time range
   */
  getMetricsInRange(startTime: Date, endTime: Date): PromptExecutionMetrics[] {
    return this.metrics.filter(
      m => m.startTime >= startTime.getTime() && m.startTime <= endTime.getTime()
    );
  }

  /**
   * Get recent failures for debugging
   */
  getRecentFailures(limit = 10): PromptExecutionMetrics[] {
    return this.metrics
      .filter(m => !m.success)
      .slice(-limit)
      .reverse();
  }

  /**
   * Calculate quality score based on various factors
   */
  calculateQualityScore(options: {
    validationPassed: boolean;
    latency: number;
    targetLatency?: number;
    outputLength?: number;
    expectedLength?: number;
  }): number {
    let score = 0;

    // Validation score (40 points)
    if (options.validationPassed) {
      score += 40;
    }

    // Latency score (30 points)
    const targetLatency = options.targetLatency || 2000;
    if (options.latency <= targetLatency) {
      score += 30;
    } else if (options.latency <= targetLatency * 1.5) {
      score += 20;
    } else if (options.latency <= targetLatency * 2) {
      score += 10;
    }

    // Output length score (30 points) - optional
    if (options.outputLength !== undefined && options.expectedLength !== undefined) {
      const lengthRatio = options.outputLength / options.expectedLength;
      if (lengthRatio >= 0.8 && lengthRatio <= 1.2) {
        score += 30;
      } else if (lengthRatio >= 0.5 && lengthRatio <= 1.5) {
        score += 20;
      } else {
        score += 10;
      }
    } else {
      score += 30; // Default if not measured
    }

    return Math.min(score, 100);
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(promptName?: string): string {
    const data = promptName
      ? this.metrics.filter(m => m.promptName === promptName)
      : this.metrics;

    return JSON.stringify(data, null, 2);
  }

  /**
   * Clear old metrics to prevent memory issues
   */
  private enforceMetricsLimit(): void {
    if (this.metrics.length > this.MAX_METRICS_SIZE) {
      const toRemove = this.metrics.length - this.MAX_METRICS_SIZE;
      this.metrics.splice(0, toRemove);
      log.info('Cleared old prompt metrics', { removedCount: toRemove });
    }
  }

  /**
   * Get all prompt names with metrics
   */
  getAllPromptNames(): string[] {
    const names = new Set(this.metrics.map(m => m.promptName));
    return Array.from(names);
  }

  /**
   * Print performance report to console
   */
  printReport(): void {
    log.info('AI Prompt Performance Report');

    const prompts = this.getAllPromptNames();

    for (const promptName of prompts) {
      const summary = this.getSummary(promptName);
      if (!summary) continue;

      log.info('Prompt metrics', {
        promptName,
        version: summary.promptVersion,
        totalExecutions: summary.totalExecutions,
        successful: summary.successfulExecutions,
        failed: summary.failedExecutions,
        successRate: `${(summary.successRate * 100).toFixed(1)}%`,
        avgLatency: `${summary.avgLatency.toFixed(0)}ms`,
        minLatency: `${summary.minLatency}ms`,
        maxLatency: `${summary.maxLatency}ms`,
        avgQuality: `${summary.avgQualityScore.toFixed(1)}/100`,
        totalTokens: summary.totalTokens.toLocaleString(),
        estimatedCost: `$${summary.estimatedTotalCost.toFixed(4)}`,
        lastExecuted: summary.lastExecuted.toISOString(),
      });
    }
  }
}

// Singleton instance
export const promptMonitor = new PromptMonitor();
