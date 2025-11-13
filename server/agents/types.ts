/**
 * Agent Task Type Definitions
 *
 * Proper types for agent task data to replace 'unknown' and 'any'
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
  offerId: number;
  retailerId: number;
  productUrl: string;
  forceRegenerate?: boolean;
}

// Affiliate link health check task
export interface LinkHealthCheckTask {
  retailerId?: number;
  offerId?: number;
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
  retailer: string;
  searchQuery?: string;
  productId?: number;
}

// Discovery agent tasks
export interface DiscoveryTask extends BaseTask {
  action: 'discover_products';
  query: string;
  limit?: number;
}

// Discovery task data (alternative format)
export interface DiscoveryTaskData extends BaseTask {
  action: 'discover_products';
  sources: string[];
  categories?: string[];
  limit?: number;
}

// Monitoring agent tasks
export interface MonitoringTask extends BaseTask {
  action: 'monitor_price_changes' | 'check_alerts' | 'refresh_offers';
  productOfferId?: number;
  retailerId?: number;
  maxAge?: number; // Hours since last check
}

// Price change interface
export interface PriceChange {
  offerId: number;
  productName: string;
  retailerName: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  timestamp: Date;
}

// Search agent tasks
export interface SearchTaskData extends BaseTask {
  action: 'search_products';
  productName: string;
  category?: string;
  retailers: string[];
  trendingProductId?: number;
}

// Generic task type
export type AgentTask =
  | AffiliateLinkTask
  | CoordinatorTask
  | ExtractionTask
  | DiscoveryTask
  | MonitoringTask
  | SearchTaskData
  | BaseTask;

// Agent result types
export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Task result for base agent
export interface TaskResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metrics?: TaskMetrics;
}

// Task metrics
export interface TaskMetrics {
  duration?: number;
  retryCount?: number;
  timestamp?: string;
  [key: string]: string | number | boolean | undefined;
}

// Trend data interface (for coordinator and general use)
export interface TrendData {
  query: string;
  score: number;
  volume: number;
  category?: string;
  source: string;
  metadata?: Record<string, string | number>;
  searchVolume?: number;
  relatedProducts?: string[];
}

// Search result interface
export interface SearchResult {
  query: string;
  retailer: string;
  urls: string[];
  relevanceScore: number;
}

// Retailer configuration
export interface RetailerConfig {
  name: string;
  baseUrl: string;
  searchPath: string;
  selectors?: {
    productLink?: string;
    productTitle?: string;
    productPrice?: string;
    productImage?: string;
  };
}

// System status for coordinator agent
export interface SystemStatus {
  jobs: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  products: {
    discovered: number;
    processed: number;
    total: number;
  };
  agents: {
    active: number;
    idle: number;
  };
  uptime: number;
  timestamp: string;
}

// Monitoring statistics
export interface MonitoringStats {
  recentChecks: {
    last24h: number;
    last7d: number;
  };
  activeAlerts: {
    total: number;
    triggered: number;
    byType: Record<string, number>;
  };
  priceChanges: {
    increases: number;
    decreases: number;
    stable: number;
  };
  availability: {
    available: number;
    outOfStock: number;
    unknown: number;
  };
  timestamp: string;
}

// Affiliate link statistics
export interface AffiliateStats {
  agent: {
    isRunning: boolean;
    taskCount: number;
    successCount: number;
    errorCount: number;
  };
  links: {
    total: number;
    active: number;
    broken: number;
    byRetailer: Record<string, number>;
    recentGenerations?: number;
    recentHealthChecks?: number;
  };
  timestamp: string;
}

// Extraction result (basic)
export interface ExtractionResult {
  productName?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  description?: string;
  availability?: string;
  metadata?: Record<string, unknown>;
}

// Extracted product data (detailed)
export interface ExtractedProductData {
  title: string;
  price: number | null;
  currency: string;
  availability: string;
  description?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  brand?: string;
  model?: string;
}

// Trend source for discovery
export interface TrendSource {
  source: string;
  query: string;
  timestamp: Date;
  confidence?: number;
}
