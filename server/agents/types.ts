/**
 * Agent Task Type Definitions
 *
 * Proper types for agent task data to replace 'unknown'
 */

// Base task interface
export interface BaseTask {
  id?: string;
  action: string;
  [key: string]: unknown;
}

// Affiliate agent tasks
export interface AffiliateLinkTask extends BaseTask {
  action: 'generate_links' | 'update_link' | 'batch_process' | 'health_check';
  retailerId?: number;
  offerId?: number;
  productId?: number;
}

// Coordinator agent tasks
export interface CoordinatorTask extends BaseTask {
  action: 'coordinate_workflow' | 'discover_trends' | 'full_cycle';
  categories?: string[];
  keywords?: string[];
  limit?: number;
}

// Extraction agent tasks
export interface ExtractionTask extends BaseTask {
  action: 'extract_product_data';
  url: string;
  retailer?: string;
}

// Discovery agent tasks
export interface DiscoveryTask extends BaseTask {
  action: 'discover_products';
  query: string;
  limit?: number;
}

// Monitoring agent tasks
export interface MonitoringTask extends BaseTask {
  action: 'monitor_prices' | 'check_availability' | 'update_status';
  productId?: number;
  offerId?: number;
}

// Generic task type
export type AgentTask =
  | AffiliateLinkTask
  | CoordinatorTask
  | ExtractionTask
  | DiscoveryTask
  | MonitoringTask
  | BaseTask;

// Agent result types
export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Trend data interface
export interface TrendData {
  query: string;
  category?: string;
  searchVolume?: number;
  relatedProducts?: string[];
}
