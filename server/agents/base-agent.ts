import { EventEmitter } from 'events';
import crypto from 'crypto';
import { db } from '../db.js';
import { agentSessions, scrapingJobs } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import type {
  AgentSession,
  InsertAgentSession,
  ScrapingJob,
  InsertScrapingJob
} from '../../shared/schema.js';
import type { TaskResult, TaskMetrics } from './types.js';
import { logger } from '../utils/logger.js';

export interface AgentConfig {
  name: string;
  type: string;
  maxConcurrentTasks: number;
  retryAttempts: number;
  retryDelay: number;
}

export type { TaskResult, TaskMetrics };

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected sessionId: string;
  protected dbSessionId: number | null = null;
  protected isRunning: boolean = false;
  protected activeTasks: Map<string, Promise<TaskResult>> = new Map();
  protected startTime: Date;
  protected taskCount: number = 0;
  protected successCount: number = 0;
  protected errorCount: number = 0;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    // Use cryptographically secure random ID generation instead of Math.random()
    const randomId = crypto.randomBytes(6).toString('hex');
    this.sessionId = `${config.type}_${Date.now()}_${randomId}`;
    this.startTime = new Date();
  }

  async initialize(): Promise<void> {
    try {
      const sessionData: InsertAgentSession = {
        agentType: this.config.type,
        sessionId: this.sessionId,
        status: 'active'
      };

      const [session] = await db.insert(agentSessions).values(sessionData).returning();
      this.dbSessionId = session.id;
      
      this.emit('initialized', { sessionId: this.sessionId, dbSessionId: this.dbSessionId });
      logger.info(`Agent ${this.config.name} initialized with session ${this.sessionId}`);
    } catch (error) {
      logger.error(`Failed to initialize agent ${this.config.name}`, {
        error: error instanceof Error ? error.message : String(error),
        agentName: this.config.name
      });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error(`Agent ${this.config.name} is already running`);
    }

    if (!this.dbSessionId) {
      await this.initialize();
    }

    this.isRunning = true;
    this.emit('started', { sessionId: this.sessionId });
    logger.info(`Agent ${this.config.name} started`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    await Promise.allSettled(Array.from(this.activeTasks.values()));
    
    if (this.dbSessionId) {
      await this.updateSession({
        sessionEnd: new Date(),
        status: 'completed',
        tasksCompleted: this.taskCount,
        successRate: (this.taskCount > 0 ? this.successCount / this.taskCount : 0).toString(),
        errorsEncountered: this.errorCount,
        performanceMetrics: JSON.stringify(this.getPerformanceMetrics())
      });
    }

    this.emit('stopped', { sessionId: this.sessionId });
    logger.info(`Agent ${this.config.name} stopped`);
  }

  protected async executeTask<T>(
    taskId: string,
    taskFn: () => Promise<T>,
    jobData?: Partial<InsertScrapingJob>
  ): Promise<TaskResult> {
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      throw new Error(`Agent ${this.config.name} has reached maximum concurrent tasks`);
    }

    const taskPromise = this.runTaskWithRetry(taskId, taskFn, jobData);
    this.activeTasks.set(taskId, taskPromise);

    try {
      const result = await taskPromise;
      return result;
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  private async runTaskWithRetry<T>(
    taskId: string,
    taskFn: () => Promise<T>,
    jobData?: Partial<InsertScrapingJob>
  ): Promise<TaskResult> {
    this.taskCount++;
    let dbJobId: number | null = null;

    if (jobData && this.dbSessionId) {
      try {
        const job: InsertScrapingJob = {
          jobType: jobData.jobType || 'unknown',
          targetData: jobData.targetData || JSON.stringify({ taskId }),
          agentSessionId: this.dbSessionId,
          startedAt: new Date(),
          ...jobData
        };

        const [createdJob] = await db.insert(scrapingJobs).values(job).returning();
        dbJobId = createdJob.id;
      } catch (error) {
        logger.error('Failed to create job record', {
          error: error instanceof Error ? error.message : String(error),
          agentName: this.config.name
        });
      }
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.emit('taskStarted', { taskId, attempt, sessionId: this.sessionId });
        
        const startTime = Date.now();
        const result = await taskFn();
        const duration = Date.now() - startTime;

        const taskResult: TaskResult = {
          success: true,
          data: result,
          metrics: {
            duration,
            attempt,
            taskId
          }
        };

        if (dbJobId) {
          await this.updateJob(dbJobId, {
            status: 'completed',
            completedAt: new Date(),
            resultData: JSON.stringify(taskResult)
          });
        }

        this.successCount++;
        this.emit('taskCompleted', { taskId, result: taskResult, sessionId: this.sessionId });
        return taskResult;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
          this.emit('taskRetry', { taskId, attempt, error: lastError.message, sessionId: this.sessionId });
        }
      }
    }

    const taskResult: TaskResult = {
      success: false,
      error: lastError?.message || 'Unknown error',
      metrics: {
        attempts: this.config.retryAttempts + 1,
        taskId
      }
    };

    if (dbJobId) {
      await this.updateJob(dbJobId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: lastError?.message || 'Unknown error',
        retryCount: this.config.retryAttempts
      });
    }

    this.errorCount++;
    this.emit('taskFailed', { taskId, error: lastError?.message, sessionId: this.sessionId });
    return taskResult;
  }

  private async updateSession(updates: Partial<AgentSession>): Promise<void> {
    if (!this.dbSessionId) return;

    try {
      await db.update(agentSessions)
        .set(updates)
        .where(eq(agentSessions.id, this.dbSessionId));
    } catch (error) {
      logger.error(`Failed to update session ${this.dbSessionId}`, {
        error: error instanceof Error ? error.message : String(error),
        sessionId: this.dbSessionId
      });
    }
  }

  private async updateJob(jobId: number, updates: Partial<ScrapingJob>): Promise<void> {
    try {
      await db.update(scrapingJobs)
        .set(updates)
        .where(eq(scrapingJobs.id, jobId));
    } catch (error) {
      logger.error(`Failed to update job ${jobId}`, {
        error: error instanceof Error ? error.message : String(error),
        jobId
      });
    }
  }

  protected getPerformanceMetrics(): Record<string, unknown> {
    const runtime = Date.now() - this.startTime.getTime();
    
    return {
      runtime,
      taskCount: this.taskCount,
      successCount: this.successCount,
      errorCount: this.errorCount,
      successRate: this.taskCount > 0 ? this.successCount / this.taskCount : 0,
      averageTaskTime: this.taskCount > 0 ? runtime / this.taskCount : 0,
      activeTasks: this.activeTasks.size
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  abstract processTask(taskData: unknown): Promise<unknown>;

  async healthCheck(): Promise<boolean> {
    return this.isRunning && this.activeTasks.size < this.config.maxConcurrentTasks;
  }

  getStatus() {
    return {
      sessionId: this.sessionId,
      dbSessionId: this.dbSessionId,
      isRunning: this.isRunning,
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      metrics: this.getPerformanceMetrics()
    };
  }
}