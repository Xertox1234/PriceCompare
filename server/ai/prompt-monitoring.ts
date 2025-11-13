/**
import { logger } from "../utils/logger";
 * Prompt Performance Monitoring System
import { logger } from "../utils/logger";
 *
import { logger } from "../utils/logger";
 * Tracks and logs AI prompt performance metrics including:
import { logger } from "../utils/logger";
 * - Latency (response time)
import { logger } from "../utils/logger";
 * - Quality scores
import { logger } from "../utils/logger";
 * - Success/failure rates
import { logger } from "../utils/logger";
 * - Token usage
import { logger } from "../utils/logger";
 * - Cost estimation
import { logger } from "../utils/logger";
 */
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
export interface PromptExecutionMetrics {
import { logger } from "../utils/logger";
  promptName: string;
import { logger } from "../utils/logger";
  promptVersion: string;
import { logger } from "../utils/logger";
  model: string;
import { logger } from "../utils/logger";
  startTime: number;
import { logger } from "../utils/logger";
  endTime?: number;
import { logger } from "../utils/logger";
  latency?: number;
import { logger } from "../utils/logger";
  success: boolean;
import { logger } from "../utils/logger";
  error?: string;
import { logger } from "../utils/logger";
  inputTokens?: number;
import { logger } from "../utils/logger";
  outputTokens?: number;
import { logger } from "../utils/logger";
  totalTokens?: number;
import { logger } from "../utils/logger";
  estimatedCost?: number;
import { logger } from "../utils/logger";
  qualityScore?: number;
import { logger } from "../utils/logger";
  validationPassed?: boolean;
import { logger } from "../utils/logger";
  validationErrors?: number;
import { logger } from "../utils/logger";
  metadata?: Record<string, any>;
import { logger } from "../utils/logger";
}
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
export interface PromptMetricsSummary {
import { logger } from "../utils/logger";
  promptName: string;
import { logger } from "../utils/logger";
  promptVersion: string;
import { logger } from "../utils/logger";
  totalExecutions: number;
import { logger } from "../utils/logger";
  successfulExecutions: number;
import { logger } from "../utils/logger";
  failedExecutions: number;
import { logger } from "../utils/logger";
  successRate: number;
import { logger } from "../utils/logger";
  avgLatency: number;
import { logger } from "../utils/logger";
  minLatency: number;
import { logger } from "../utils/logger";
  maxLatency: number;
import { logger } from "../utils/logger";
  avgQualityScore: number;
import { logger } from "../utils/logger";
  totalTokens: number;
import { logger } from "../utils/logger";
  estimatedTotalCost: number;
import { logger } from "../utils/logger";
  lastExecuted: Date;
import { logger } from "../utils/logger";
}
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
class PromptMonitor {
import { logger } from "../utils/logger";
  private metrics: PromptExecutionMetrics[] = [];
import { logger } from "../utils/logger";
  private readonly MAX_METRICS_SIZE = 10000;
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  // Pricing (per 1M tokens for gpt-4o-mini)
import { logger } from "../utils/logger";
  private readonly PRICING = {
import { logger } from "../utils/logger";
    'gpt-4o-mini': {
import { logger } from "../utils/logger";
      input: 0.150,   // $0.150 per 1M input tokens
import { logger } from "../utils/logger";
      output: 0.600   // $0.600 per 1M output tokens
import { logger } from "../utils/logger";
    },
import { logger } from "../utils/logger";
    'text-embedding-3-small': {
import { logger } from "../utils/logger";
      input: 0.020,   // $0.020 per 1M tokens
import { logger } from "../utils/logger";
      output: 0
import { logger } from "../utils/logger";
    }
import { logger } from "../utils/logger";
  };
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Start tracking a prompt execution
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  startExecution(
import { logger } from "../utils/logger";
    promptName: string,
import { logger } from "../utils/logger";
    promptVersion: string,
import { logger } from "../utils/logger";
    model: string,
import { logger } from "../utils/logger";
    metadata?: Record<string, any>
import { logger } from "../utils/logger";
  ): string {
import { logger } from "../utils/logger";
    const executionId = `${promptName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    const metrics: PromptExecutionMetrics = {
import { logger } from "../utils/logger";
      promptName,
import { logger } from "../utils/logger";
      promptVersion,
import { logger } from "../utils/logger";
      model,
import { logger } from "../utils/logger";
      startTime: Date.now(),
import { logger } from "../utils/logger";
      success: false,
import { logger } from "../utils/logger";
      metadata
import { logger } from "../utils/logger";
    };
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    this.metrics.push(metrics);
import { logger } from "../utils/logger";
    this.enforceMetricsLimit();
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    return executionId;
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Complete tracking of a prompt execution
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  completeExecution(
import { logger } from "../utils/logger";
    promptName: string,
import { logger } from "../utils/logger";
    success: boolean,
import { logger } from "../utils/logger";
    options: {
import { logger } from "../utils/logger";
      error?: string;
import { logger } from "../utils/logger";
      inputTokens?: number;
import { logger } from "../utils/logger";
      outputTokens?: number;
import { logger } from "../utils/logger";
      qualityScore?: number;
import { logger } from "../utils/logger";
      validationPassed?: boolean;
import { logger } from "../utils/logger";
      validationErrors?: number;
import { logger } from "../utils/logger";
    } = {}
import { logger } from "../utils/logger";
  ): void {
import { logger } from "../utils/logger";
    // Find the most recent execution for this prompt
import { logger } from "../utils/logger";
    const execution = this.metrics
import { logger } from "../utils/logger";
      .reverse()
import { logger } from "../utils/logger";
      .find(m => m.promptName === promptName && !m.endTime);
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    if (!execution) {
import { logger } from "../utils/logger";
      logger.warn(`No active execution found for prompt: ${promptName}`);
import { logger } from "../utils/logger";
      return;
import { logger } from "../utils/logger";
    }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    this.metrics.reverse(); // Restore original order
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    execution.endTime = Date.now();
import { logger } from "../utils/logger";
    execution.latency = execution.endTime - execution.startTime;
import { logger } from "../utils/logger";
    execution.success = success;
import { logger } from "../utils/logger";
    execution.error = options.error;
import { logger } from "../utils/logger";
    execution.inputTokens = options.inputTokens;
import { logger } from "../utils/logger";
    execution.outputTokens = options.outputTokens;
import { logger } from "../utils/logger";
    execution.totalTokens = (options.inputTokens || 0) + (options.outputTokens || 0);
import { logger } from "../utils/logger";
    execution.qualityScore = options.qualityScore;
import { logger } from "../utils/logger";
    execution.validationPassed = options.validationPassed;
import { logger } from "../utils/logger";
    execution.validationErrors = options.validationErrors;
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    // Calculate cost
import { logger } from "../utils/logger";
    if (execution.inputTokens || execution.outputTokens) {
import { logger } from "../utils/logger";
      execution.estimatedCost = this.calculateCost(
import { logger } from "../utils/logger";
        execution.model,
import { logger } from "../utils/logger";
        execution.inputTokens || 0,
import { logger } from "../utils/logger";
        execution.outputTokens || 0
import { logger } from "../utils/logger";
      );
import { logger } from "../utils/logger";
    }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    // Log the execution
import { logger } from "../utils/logger";
    this.logExecution(execution);
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Calculate estimated cost based on token usage
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
import { logger } from "../utils/logger";
    const pricing = this.PRICING[model as keyof typeof this.PRICING];
import { logger } from "../utils/logger";
    if (!pricing) return 0;
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
import { logger } from "../utils/logger";
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    return inputCost + outputCost;
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Log execution metrics
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  private logExecution(metrics: PromptExecutionMetrics): void {
import { logger } from "../utils/logger";
    const status = metrics.success ? '✅' : '❌';
import { logger } from "../utils/logger";
    const latency = metrics.latency ? `${metrics.latency}ms` : 'N/A';
import { logger } from "../utils/logger";
    const cost = metrics.estimatedCost ? `$${metrics.estimatedCost.toFixed(6)}` : 'N/A';
import { logger } from "../utils/logger";
    const quality = metrics.qualityScore !== undefined ? metrics.qualityScore.toFixed(2) : 'N/A';
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    logger.info(
import { logger } from "../utils/logger";
      `${status} AI Prompt: ${metrics.promptName} (${metrics.promptVersion}) | ` +
import { logger } from "../utils/logger";
      `Latency: ${latency} | Quality: ${quality} | Cost: ${cost} | ` +
import { logger } from "../utils/logger";
      `Tokens: ${metrics.totalTokens || 'N/A'}` +
import { logger } from "../utils/logger";
      (metrics.error ? ` | Error: ${metrics.error}` : '')
import { logger } from "../utils/logger";
    );
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    // Log validation failures
import { logger } from "../utils/logger";
    if (metrics.validationPassed === false && metrics.validationErrors) {
import { logger } from "../utils/logger";
      logger.warn(
import { logger } from "../utils/logger";
        `⚠️  Validation failed for ${metrics.promptName}: ${metrics.validationErrors} error(s)`
import { logger } from "../utils/logger";
      );
import { logger } from "../utils/logger";
    }
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Get summary metrics for a specific prompt
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  getSummary(promptName: string, promptVersion?: string): PromptMetricsSummary | null {
import { logger } from "../utils/logger";
    const filtered = this.metrics.filter(
import { logger } from "../utils/logger";
      m => m.promptName === promptName &&
import { logger } from "../utils/logger";
      (promptVersion === undefined || m.promptVersion === promptVersion) &&
import { logger } from "../utils/logger";
      m.endTime !== undefined
import { logger } from "../utils/logger";
    );
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    if (filtered.length === 0) return null;
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    const successful = filtered.filter(m => m.success);
import { logger } from "../utils/logger";
    const failed = filtered.filter(m => !m.success);
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    const latencies = filtered.map(m => m.latency!).filter(l => l !== undefined);
import { logger } from "../utils/logger";
    const qualityScores = filtered
import { logger } from "../utils/logger";
      .map(m => m.qualityScore)
import { logger } from "../utils/logger";
      .filter((q): q is number => q !== undefined);
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    const totalTokens = filtered.reduce((sum, m) => sum + (m.totalTokens || 0), 0);
import { logger } from "../utils/logger";
    const estimatedTotalCost = filtered.reduce((sum, m) => sum + (m.estimatedCost || 0), 0);
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    const lastExecution = filtered.reduce((latest, m) =>
import { logger } from "../utils/logger";
      m.endTime! > latest ? m.endTime! : latest,
import { logger } from "../utils/logger";
      0
import { logger } from "../utils/logger";
    );
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    return {
import { logger } from "../utils/logger";
      promptName,
import { logger } from "../utils/logger";
      promptVersion: promptVersion || 'all',
import { logger } from "../utils/logger";
      totalExecutions: filtered.length,
import { logger } from "../utils/logger";
      successfulExecutions: successful.length,
import { logger } from "../utils/logger";
      failedExecutions: failed.length,
import { logger } from "../utils/logger";
      successRate: successful.length / filtered.length,
import { logger } from "../utils/logger";
      avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
import { logger } from "../utils/logger";
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
import { logger } from "../utils/logger";
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
import { logger } from "../utils/logger";
      avgQualityScore: qualityScores.length > 0
import { logger } from "../utils/logger";
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
import { logger } from "../utils/logger";
        : 0,
import { logger } from "../utils/logger";
      totalTokens,
import { logger } from "../utils/logger";
      estimatedTotalCost,
import { logger } from "../utils/logger";
      lastExecuted: new Date(lastExecution)
import { logger } from "../utils/logger";
    };
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Get all metrics for a time range
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  getMetricsInRange(startTime: Date, endTime: Date): PromptExecutionMetrics[] {
import { logger } from "../utils/logger";
    return this.metrics.filter(
import { logger } from "../utils/logger";
      m => m.startTime >= startTime.getTime() && m.startTime <= endTime.getTime()
import { logger } from "../utils/logger";
    );
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Get recent failures for debugging
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  getRecentFailures(limit: number = 10): PromptExecutionMetrics[] {
import { logger } from "../utils/logger";
    return this.metrics
import { logger } from "../utils/logger";
      .filter(m => !m.success)
import { logger } from "../utils/logger";
      .slice(-limit)
import { logger } from "../utils/logger";
      .reverse();
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Calculate quality score based on various factors
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  calculateQualityScore(options: {
import { logger } from "../utils/logger";
    validationPassed: boolean;
import { logger } from "../utils/logger";
    latency: number;
import { logger } from "../utils/logger";
    targetLatency?: number;
import { logger } from "../utils/logger";
    outputLength?: number;
import { logger } from "../utils/logger";
    expectedLength?: number;
import { logger } from "../utils/logger";
  }): number {
import { logger } from "../utils/logger";
    let score = 0;
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    // Validation score (40 points)
import { logger } from "../utils/logger";
    if (options.validationPassed) {
import { logger } from "../utils/logger";
      score += 40;
import { logger } from "../utils/logger";
    }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    // Latency score (30 points)
import { logger } from "../utils/logger";
    const targetLatency = options.targetLatency || 2000;
import { logger } from "../utils/logger";
    if (options.latency <= targetLatency) {
import { logger } from "../utils/logger";
      score += 30;
import { logger } from "../utils/logger";
    } else if (options.latency <= targetLatency * 1.5) {
import { logger } from "../utils/logger";
      score += 20;
import { logger } from "../utils/logger";
    } else if (options.latency <= targetLatency * 2) {
import { logger } from "../utils/logger";
      score += 10;
import { logger } from "../utils/logger";
    }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    // Output length score (30 points) - optional
import { logger } from "../utils/logger";
    if (options.outputLength !== undefined && options.expectedLength !== undefined) {
import { logger } from "../utils/logger";
      const lengthRatio = options.outputLength / options.expectedLength;
import { logger } from "../utils/logger";
      if (lengthRatio >= 0.8 && lengthRatio <= 1.2) {
import { logger } from "../utils/logger";
        score += 30;
import { logger } from "../utils/logger";
      } else if (lengthRatio >= 0.5 && lengthRatio <= 1.5) {
import { logger } from "../utils/logger";
        score += 20;
import { logger } from "../utils/logger";
      } else {
import { logger } from "../utils/logger";
        score += 10;
import { logger } from "../utils/logger";
      }
import { logger } from "../utils/logger";
    } else {
import { logger } from "../utils/logger";
      score += 30; // Default if not measured
import { logger } from "../utils/logger";
    }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    return Math.min(score, 100);
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Export metrics to JSON
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  exportMetrics(promptName?: string): string {
import { logger } from "../utils/logger";
    const data = promptName
import { logger } from "../utils/logger";
      ? this.metrics.filter(m => m.promptName === promptName)
import { logger } from "../utils/logger";
      : this.metrics;
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    return JSON.stringify(data, null, 2);
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Clear old metrics to prevent memory issues
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  private enforceMetricsLimit(): void {
import { logger } from "../utils/logger";
    if (this.metrics.length > this.MAX_METRICS_SIZE) {
import { logger } from "../utils/logger";
      const toRemove = this.metrics.length - this.MAX_METRICS_SIZE;
import { logger } from "../utils/logger";
      this.metrics.splice(0, toRemove);
import { logger } from "../utils/logger";
      logger.info(`📊 Cleared ${toRemove} old prompt metrics`);
import { logger } from "../utils/logger";
    }
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Get all prompt names with metrics
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  getAllPromptNames(): string[] {
import { logger } from "../utils/logger";
    const names = new Set(this.metrics.map(m => m.promptName));
import { logger } from "../utils/logger";
    return Array.from(names);
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
  /**
import { logger } from "../utils/logger";
   * Print performance report to console
import { logger } from "../utils/logger";
   */
import { logger } from "../utils/logger";
  printReport(): void {
import { logger } from "../utils/logger";
    logger.info('\n📊 === AI Prompt Performance Report ===\n');
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    const prompts = this.getAllPromptNames();
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    for (const promptName of prompts) {
import { logger } from "../utils/logger";
      const summary = this.getSummary(promptName);
import { logger } from "../utils/logger";
      if (!summary) continue;
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
      logger.info(`\n🔹 ${promptName}`);
import { logger } from "../utils/logger";
      logger.info(`   Version: ${summary.promptVersion}`);
import { logger } from "../utils/logger";
      logger.info(`   Executions: ${summary.totalExecutions} (${summary.successfulExecutions} success, ${summary.failedExecutions} failed)`);
import { logger } from "../utils/logger";
      logger.info(`   Success Rate: ${(summary.successRate * 100).toFixed(1)}%`);
import { logger } from "../utils/logger";
      logger.info(`   Avg Latency: ${summary.avgLatency.toFixed(0)}ms (min: ${summary.minLatency}ms, max: ${summary.maxLatency}ms)`);
import { logger } from "../utils/logger";
      logger.info(`   Avg Quality: ${summary.avgQualityScore.toFixed(1)}/100`);
import { logger } from "../utils/logger";
      logger.info(`   Total Tokens: ${summary.totalTokens.toLocaleString()}`);
import { logger } from "../utils/logger";
      logger.info(`   Estimated Cost: $${summary.estimatedTotalCost.toFixed(4)}`);
import { logger } from "../utils/logger";
      logger.info(`   Last Executed: ${summary.lastExecuted.toISOString()}`);
import { logger } from "../utils/logger";
    }
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
    logger.info('\n=====================================\n');
import { logger } from "../utils/logger";
  }
import { logger } from "../utils/logger";
}
import { logger } from "../utils/logger";

import { logger } from "../utils/logger";
// Singleton instance
import { logger } from "../utils/logger";
export const promptMonitor = new PromptMonitor();
import { logger } from "../utils/logger";
