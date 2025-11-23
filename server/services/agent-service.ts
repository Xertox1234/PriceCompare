import { CoordinationAgent } from '../agents/coordinator-agent';
import { ProductDiscoveryAgent } from '../agents/discovery-agent';
import { SearchOrchestrationAgent } from '../agents/search-agent';
import { logger } from '../utils/logger';

/**
 * Agent Service
 *
 * Manages the lifecycle of AI agents used for product discovery and scraping.
 * Provides a centralized, testable interface for agent management.
 *
 * Features:
 * - Lazy initialization of agents
 * - Singleton pattern for agent instances
 * - Proper cleanup/memory management
 * - Thread-safe initialization
 */
export class AgentService {
  private coordinationAgent: CoordinationAgent | null = null;
  private discoveryAgent: ProductDiscoveryAgent | null = null;
  private searchAgent: SearchOrchestrationAgent | null = null;
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  /**
   * Initialize all agents
   * Safe to call multiple times - will only initialize once
   */
  async initialize(): Promise<void> {
    // Return existing initialization promise if already in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Skip if already initialized
    if (this.isInitialized) {
      return;
    }

    this.initializationPromise = this.performInitialization();

    try {
      await this.initializationPromise;
      this.isInitialized = true;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitialization(): Promise<void> {
    logger.info('[AgentService] Initializing agents...');

    try {
      // Create agents
      this.coordinationAgent = new CoordinationAgent();
      this.discoveryAgent = new ProductDiscoveryAgent();
      this.searchAgent = new SearchOrchestrationAgent();

      // Initialize all agents
      await this.coordinationAgent.initialize();
      await this.discoveryAgent.initialize();
      await this.searchAgent.initialize();

      logger.info('[AgentService] All agents initialized successfully');
    } catch (error) {
      logger.error('[AgentService] Failed to initialize agents:', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Clean up on failure
      this.cleanup();
      throw error;
    }
  }

  /**
   * Get the coordination agent
   * Initializes if not already done
   */
  async getCoordinationAgent(): Promise<CoordinationAgent> {
    await this.initialize();

    if (!this.coordinationAgent) {
      throw new Error('Coordination agent failed to initialize');
    }

    return this.coordinationAgent;
  }

  /**
   * Get the discovery agent
   * Initializes if not already done
   */
  async getDiscoveryAgent(): Promise<ProductDiscoveryAgent> {
    await this.initialize();

    if (!this.discoveryAgent) {
      throw new Error('Discovery agent failed to initialize');
    }

    return this.discoveryAgent;
  }

  /**
   * Get the search agent
   * Initializes if not already done
   */
  async getSearchAgent(): Promise<SearchOrchestrationAgent> {
    await this.initialize();

    if (!this.searchAgent) {
      throw new Error('Search agent failed to initialize');
    }

    return this.searchAgent;
  }

  /**
   * Check if agents are initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Clean up all agent instances and release memory
   */
  cleanup(): void {
    logger.info('[AgentService] Cleaning up agents...');

    // Stop agents if they support it
    if (this.coordinationAgent) {
      try {
        // CoordinationAgent has a stop method - call it if running
        const status = this.coordinationAgent.getStatus();
        if (status.isRunning) {
          this.coordinationAgent.stop().catch((err: unknown) => {
            logger.error('[AgentService] Error stopping coordination agent:', {
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Release references
    this.coordinationAgent = null;
    this.discoveryAgent = null;
    this.searchAgent = null;
    this.isInitialized = false;
    this.initializationPromise = null;

    logger.info('[AgentService] Agents cleaned up');
  }

  /**
   * Get status of all agents
   */
  getStatus(): {
    isInitialized: boolean;
    agents: {
      coordination: boolean;
      discovery: boolean;
      search: boolean;
    };
  } {
    return {
      isInitialized: this.isInitialized,
      agents: {
        coordination: this.coordinationAgent !== null,
        discovery: this.discoveryAgent !== null,
        search: this.searchAgent !== null,
      },
    };
  }
}

// Singleton instance for application use
export const agentService = new AgentService();
