/**
 * Application Constants
 *
 * Centralized constants to replace magic numbers and strings throughout the codebase.
 */

/**
 * Password validation constants
 */
export const PASSWORD = {
  MIN_LENGTH: 12,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  MIN_STRENGTH_SCORE: 3, // zxcvbn score (0-4)
  BCRYPT_ROUNDS: 12, // Cost factor for password hashing (production security)
  BCRYPT_ROUNDS_TEST: 4, // Fast tests (intentionally weak, bcrypt minimum)
} as const;

/**
 * Cache duration constants (in seconds)
 */
export const CACHE_DURATION = {
  SHORT: 60, // 1 minute
  MEDIUM: 180, // 3 minutes
  LONG: 300, // 5 minutes
  VERY_LONG: 600, // 10 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;

/**
 * Pagination constants
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

/**
 * Rate limiting constants
 */
export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100, // per window
  AUTH_MAX_REQUESTS: process.env.NODE_ENV === 'production' ? 5 : 50, // for auth endpoints (lenient in dev)
  SKIP_SUCCESSFUL_REQUESTS: false,
} as const;

/**
 * Rate limit tier definitions
 * Multiplier applied to base maxRequests value per user role.
 */
export const RATE_LIMIT_TIERS = {
  anonymous: { multiplier: 0.5, maxRequests: 50 },
  free: { multiplier: 0.5, maxRequests: 50 },
  user: { multiplier: 1, maxRequests: 100 },
  premium: { multiplier: 5, maxRequests: 500 },
  moderator: { multiplier: 10, maxRequests: 1000 },
  admin: { multiplier: 100, maxRequests: 10000 },
} as const;

/**
 * Watchlist-specific rate limiting configuration
 * Applied per-user (based on authenticated userId)
 */
export const WATCHLIST_RATE_LIMITS = {
  CREATE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many watch list creation attempts. Please try again later.',
  },
  PRODUCT_ADD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many product add attempts. Please try again later.',
  },
} as const;

/**
 * Session constants
 */
export const SESSION = {
  MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  SECRET_MIN_LENGTH: 32,
  COOKIE_NAME: 'connect.sid',
} as const;

/**
 * Database constants
 */
export const DATABASE = {
  CONNECTION_POOL_MIN: 2,
  CONNECTION_POOL_MAX: 20,
  CONNECTION_TIMEOUT_MS: 2000,
  IDLE_TIMEOUT_MS: 30000,
  MAX_USES: 7500,
} as const;

/**
 * Forum constants
 */
export const FORUM = {
  DEALS_CATEGORY_ID: 1,
  MAX_POST_LENGTH: 10000,
  MAX_TOPIC_TITLE_LENGTH: 255,
  MIN_TRUST_LEVEL_TO_POST: 0,
  MIN_TRUST_LEVEL_TO_CREATE_TOPIC: 0,
} as const;

/**
 * Trust levels (Discourse-like)
 */
export const TRUST_LEVEL = {
  NEW_USER: 0,
  BASIC_USER: 1,
  MEMBER: 2,
  REGULAR: 3,
  LEADER: 4,
} as const;

/**
 * Price alert constants
 */
export const PRICE_ALERT = {
  DEFAULT_THRESHOLD_PERCENT: 10,
  DEFAULT_THRESHOLD_AMOUNT: 5.0,
  MAX_ALERTS_PER_USER: 50,
} as const;

/**
 * Account lockout constants
 */
export const ACCOUNT_LOCKOUT = {
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
} as const;

/**
 * Password reset constants
 */
export const PASSWORD_RESET = {
  TOKEN_EXPIRY_HOURS: 1,
  MAX_REQUESTS_PER_HOUR: 3,
} as const;

/**
 * Price history constants
 */
export const PRICE_HISTORY = {
  MAX_DAYS: 365,
  SNAPSHOT_BATCH_SIZE: 1000,
  DEFAULT_DAYS: 30,
} as const;

/**
 * Batch processing constants for background jobs and data operations
 */
export const BATCH_PROCESSING = {
  /** Trend analysis - parallel processing batch size */
  TREND_ANALYSIS: 20,
  /** Price snapshot - offers processed per batch */
  PRICE_SNAPSHOT: 500,
  /** Price trend upsert - records per database chunk */
  PRICE_TREND_UPSERT: 100,
  /** Maximum batch size for any operation */
  MAX_BATCH_SIZE: 1000,
} as const;

/**
 * Scraping constants
 */
export const SCRAPING = {
  MAX_CONCURRENT_REQUESTS: 3,
  REQUEST_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

/**
 * Scraper/Playwright timeout constants
 * Centralized for easy tuning and consistency
 */
export const SCRAPER = {
  /** Maximum time to wait for page navigation */
  NAVIGATION_TIMEOUT_MS: 30000,
  /** Time to wait for price/product selectors to appear */
  SELECTOR_TIMEOUT_MS: 10000,
  /** Time to wait for network to become idle */
  NETWORK_IDLE_TIMEOUT_MS: 5000,
  /** Time to wait when extracting text/attributes from elements */
  ELEMENT_TIMEOUT_MS: 2000,
  /** Delay between requests to same domain */
  REQUEST_DELAY_MS: 2000,
  /** Maximum concurrent browser contexts */
  MAX_CONCURRENT_CONTEXTS: 3,
  /** Browser launch args */
  BROWSER_ARGS: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
  ],
} as const;

/**
 * User domain constants
 * Used by DatabaseStorage user-related methods for validation and defaults
 */
export const USER_CONSTANTS = {
  TRUST_LEVEL: {
    MIN: 0,
    MAX: 4,
  },
  PROFILE: {
    MAX_BIO_LENGTH: 500,
    MAX_LOCATION_LENGTH: 100,
    MAX_WEBSITE_LENGTH: 255,
    MAX_AVATAR_URL_LENGTH: 500,
  },
  GROWTH_DATA: {
    DEFAULT_DAYS: 30,
    MAX_DAYS: 365,
  },
} as const;

/**
 * Product domain constants
 * Used by DatabaseStorage product-related methods for validation and search defaults
 */
export const PRODUCT_CONSTANTS = {
  VALIDATION: {
    MIN_PRODUCT_ID: 1,
    MIN_RETAILER_ID: 1,
    MAX_NAME_LENGTH: 255,
  },
  SEARCH: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  FUZZY_SEARCH: {
    MIN_THRESHOLD: 0.0,
    MAX_THRESHOLD: 1.0,
    DEFAULT_THRESHOLD: 0.6,
  },
} as const;

/**
 * Job Lock domain constants
 * Used by JobLockStorage for distributed locking validation
 */
export const JOB_LOCK_CONSTANTS = {
  VALIDATION: {
    MIN_JOB_NAME_LENGTH: 1,
    MAX_JOB_NAME_LENGTH: 255,
    MIN_LOCKED_BY_LENGTH: 1,
    MAX_LOCKED_BY_LENGTH: 255,
    MIN_TTL_SECONDS: 1,
    MAX_TTL_SECONDS: 604800, // 7 days (recommended max for background jobs)
  },
} as const;

/**
 * Alert domain constants
 * Used by DatabaseStorage price alert methods for validation
 */
export const ALERT_CONSTANTS = {
  VALIDATION: {
    MIN_ID: 1,
    MIN_PRICE: 0,
  },
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  AUTHENTICATION_REQUIRED: 'Authentication required',
  AUTHORIZATION_FAILED: 'Access denied',
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account temporarily locked due to too many failed attempts',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  VALIDATION_FAILED: 'Validation failed',
  RESOURCE_NOT_FOUND: 'Resource not found',
  INTERNAL_ERROR: 'Internal server error',
  DATABASE_ERROR: 'Database error occurred',
} as const;

/**
 * Notification constants (Phase 8 - Storage Layer Migration)
 * Used by NotificationStorage for deduplication and daily limits
 */
export const NOTIFICATION = {
  /** Hours window for deduplication (prevent duplicate notifications within this window) */
  DEDUP_TTL_HOURS: 6,
  /** Maximum notifications per user per day for smart alerts */
  SMART_ALERT_DAILY_LIMIT: 3,
  /** Default pagination limit for notification queries */
  DEFAULT_LIMIT: 50,
  /** Maximum batch size for bulk operations */
  MAX_BATCH_SIZE: 100,
} as const;

/**
 * Transaction retry constants (Phase 8)
 * Used for SERIALIZABLE transaction retry logic
 */
export const TRANSACTION_RETRY = {
  /** Maximum retry attempts for serialization failures */
  MAX_RETRIES: 3,
  /** Initial delay in milliseconds before first retry */
  INITIAL_DELAY_MS: 100,
  /** Maximum delay in milliseconds between retries */
  MAX_DELAY_MS: 1000,
  /** PostgreSQL error code for serialization failure */
  SERIALIZATION_FAILURE_CODE: '40001',
} as const;

/**
 * Storage layer validation constants (Phase 8)
 * Used by domain repositories for input validation
 */
export const STORAGE_VALIDATION = {
  /** Minimum valid ID (all IDs must be positive) */
  MIN_ID: 1,
  /** Maximum days for price history queries */
  MAX_PRICE_HISTORY_DAYS: 3650,
  /** Maximum items in a batch query */
  MAX_BATCH_IDS: 1000,
} as const;

/**
 * Data retention constants (Phase 8)
 * Used by cleanup jobs and storage methods
 */
export const DATA_RETENTION = {
  /** Days to retain notification records */
  NOTIFICATION_DAYS: 90,
  /** Days to retain price snapshots */
  PRICE_SNAPSHOT_DAYS: 365,
  /** Days to retain analytics data */
  ANALYTICS_DAYS: 730,
} as const;
