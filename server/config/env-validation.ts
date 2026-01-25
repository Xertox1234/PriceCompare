/**
 * Environment Variable Validation
 *
 * This module ensures all required secrets and configuration values are present
 * before the application starts. This prevents security vulnerabilities from
 * missing or default secret values.
 */

import { createLogger } from '../utils/logger';

const log = createLogger('EnvValidation');

interface RequiredEnvVar {
  name: string;
  description: string;
  critical: boolean;
}

const REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  {
    name: 'DATABASE_URL',
    description: 'PostgreSQL connection string',
    critical: true,
  },
  {
    name: 'SESSION_SECRET',
    description: 'Secret key for session encryption (min 32 characters)',
    critical: true,
  },
  {
    name: 'ENCRYPTION_KEY',
    description: 'AES-256 encryption key for PII data at rest (64 hex characters = 32 bytes)',
    critical: true,
  },
  {
    name: 'DISCOURSE_SSO_SECRET',
    description: 'Secret key for Discourse SSO HMAC signing',
    critical: true,
  },
  {
    name: 'CSRF_SECRET',
    description: 'Secret key for CSRF token generation',
    critical: true,
  },
];

const PRODUCTION_REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  {
    name: 'REDIS_URL',
    description: 'Redis connection URL (required in production for distributed features)',
    critical: true,
  },
  {
    name: 'APP_URL',
    description: 'Application URL for email links (e.g., https://pricecompare.com)',
    critical: true,
  },
  {
    name: 'CLIENT_URL',
    description: 'Frontend URL for CORS/WebSocket origins (e.g., https://pricecompare.com)',
    critical: true,
  },
  {
    name: 'ALLOWED_ORIGINS',
    description: 'Comma-separated list of allowed CORS origins (e.g., https://pricecompare.com)',
    critical: true,
  },
];

const OPTIONAL_ENV_VARS: RequiredEnvVar[] = [
  // NOTE: REDIS_URL is NOT listed here - it's in PRODUCTION_REQUIRED_ENV_VARS
  // In development, Redis is optional (app uses in-memory fallback with warnings)
  // In production, Redis is mandatory (validated separately above)
  {
    name: 'DISCOURSE_URL',
    description: 'Discourse forum URL',
    critical: false,
  },
  {
    name: 'DISCOURSE_API_KEY',
    description: 'Discourse API key',
    critical: false,
  },
  {
    name: 'OPENAI_API_KEY',
    description: 'OpenAI API key for AI features',
    critical: false,
  },
];

/**
 * Validates that a secret meets minimum security requirements
 */
function validateSecretStrength(name: string, value: string): string[] {
  const errors: string[] = [];

  // Check minimum length
  if (value.length < 32) {
    errors.push(`${name} must be at least 32 characters long (current: ${value.length})`);
  }

  // Check for common weak values
  const weakSecrets = [
    'change-this',
    'change-in-production',
    'your-secret',
    'secret-key',
    'password',
    '12345',
  ];

  for (const weak of weakSecrets) {
    if (value.toLowerCase().includes(weak)) {
      errors.push(`${name} contains weak/default pattern: "${weak}"`);
    }
  }

  return errors;
}

/**
 * Validates that a URL meets production requirements
 * - Must be a valid URL
 * - Must use HTTPS (not HTTP)
 * - Must not be localhost
 */
function validateProductionUrl(name: string, value: string): string[] {
  const errors: string[] = [];

  // Check if it's a valid URL
  try {
    const url = new URL(value);

    // Must use HTTPS in production
    if (url.protocol !== 'https:') {
      errors.push(
        `${name} must use HTTPS in production (got: ${url.protocol}//). ` +
          'HTTP is insecure and should never be used in production.'
      );
    }

    // Must not be localhost
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      errors.push(
        `${name} cannot be localhost in production (got: ${hostname}). ` +
          'Set this to your actual production domain.'
      );
    }
  } catch {
    errors.push(`${name} is not a valid URL (got: ${value})`);
  }

  return errors;
}

/**
 * Validates all required environment variables are present and secure
 * Throws an error if validation fails in production
 * Logs warnings in development
 */
export function validateEnvironment(): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  log.info('🔍 Validating environment configuration...');

  // Check required variables (all environments)
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      const message = `❌ CRITICAL: ${envVar.name} is not set (${envVar.description})`;
      errors.push(message);
      continue;
    }

    // Validate ENCRYPTION_KEY separately (hex format, not base64)
    if (envVar.critical && envVar.name === 'ENCRYPTION_KEY') {
      const keyErrors: string[] = [];

      // Check if it's valid hex
      if (!/^[0-9a-fA-F]+$/.test(value)) {
        keyErrors.push(`${envVar.name} must be a valid hex string (only 0-9, a-f characters)`);
      }

      // Check length (must be 64 hex characters = 32 bytes)
      if (value.length !== 64) {
        keyErrors.push(
          `${envVar.name} must be exactly 64 hex characters (32 bytes for AES-256). ` +
            `Current: ${value.length} characters`
        );
      }

      // Verify it decodes to correct byte length
      const keyBuffer = Buffer.from(value, 'hex');
      if (keyBuffer.length !== 32) {
        keyErrors.push(
          `${envVar.name} decodes to ${keyBuffer.length} bytes, but must be 32 bytes for AES-256`
        );
      }

      if (keyErrors.length > 0) {
        log.error(`\n❌ SECURITY: Invalid encryption key for ${envVar.name}:`);
        keyErrors.forEach((e) => log.error(`  ${e}`));
        log.error('\n💡 Generate a valid encryption key with: openssl rand -hex 32');
        errors.push(...keyErrors);
      }
    }
    // Validate secret strength for critical secrets (SESSION_SECRET, CSRF_SECRET, etc.)
    else if (envVar.critical && envVar.name.includes('SECRET')) {
      const secretErrors = validateSecretStrength(envVar.name, value);
      if (secretErrors.length > 0) {
        // SECURITY: Enforce strong secrets in all environments (including dev)
        // This prevents weak secrets from accidentally making it to production
        log.error(`\n❌ SECURITY: Weak secret detected for ${envVar.name}:`);
        secretErrors.forEach((e) => log.error(`  ${e}`));

        if (isDevelopment || isTest) {
          log.error('\n💡 TIP: Even in development, use strong secrets.');
          log.error(
            "   Generate a secure secret with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
          );
        }

        errors.push(...secretErrors);
      }
    }

    log.info(`  ✅ ${envVar.name} is set`);
  }

  // Check production-required variables (only in production)
  if (isProduction) {
    for (const envVar of PRODUCTION_REQUIRED_ENV_VARS) {
      const value = process.env[envVar.name];

      if (!value) {
        const message = `❌ CRITICAL: ${envVar.name} is not set (${envVar.description})`;
        errors.push(message);
        log.error(message);

        // Provide specific guidance based on variable type
        if (envVar.name === 'REDIS_URL') {
          log.error('\n💡 PRODUCTION REQUIREMENT: Redis is mandatory in production for:');
          log.error('   - Distributed rate limiting across multiple server instances');
          log.error('   - Session storage and persistence');
          log.error('   - Account lockout tracking');
          log.error('   - Caching and performance optimization');
          log.error('   - Job queue coordination');
          log.error('\n   Set REDIS_URL in your environment: redis://hostname:6379');
        } else if (envVar.name === 'APP_URL') {
          log.error('\n💡 PRODUCTION REQUIREMENT: APP_URL is used in:');
          log.error('   - Password reset email links');
          log.error('   - Notification email links');
          log.error('   - Any user-facing URLs in emails');
          log.error('\n   Example: APP_URL=https://pricecompare.com');
        } else if (envVar.name === 'CLIENT_URL') {
          log.error('\n💡 PRODUCTION REQUIREMENT: CLIENT_URL is used for:');
          log.error('   - WebSocket CORS origin validation');
          log.error('   - Real-time notification delivery');
          log.error('\n   Example: CLIENT_URL=https://pricecompare.com');
        } else if (envVar.name === 'ALLOWED_ORIGINS') {
          log.error('\n💡 PRODUCTION REQUIREMENT: ALLOWED_ORIGINS is used for:');
          log.error('   - CORS policy configuration');
          log.error('   - Cross-origin request validation');
          log.error('\n   Example: ALLOWED_ORIGINS=https://pricecompare.com,https://www.pricecompare.com');
        }
      } else {
        // Validate URL format for URL-type variables
        if (envVar.name === 'APP_URL' || envVar.name === 'CLIENT_URL') {
          const urlErrors = validateProductionUrl(envVar.name, value);
          if (urlErrors.length > 0) {
            log.error(`\n❌ SECURITY: Invalid URL for ${envVar.name}:`);
            urlErrors.forEach((e) => log.error(`  ${e}`));
            errors.push(...urlErrors);
          } else {
            log.info(`  ✅ ${envVar.name} is set (production requirement)`);
          }
        } else if (envVar.name === 'ALLOWED_ORIGINS') {
          // Validate each origin in the comma-separated list
          const origins = value.split(',').map((o) => o.trim());
          let allOriginsValid = true;

          for (const origin of origins) {
            const originErrors = validateProductionUrl(`${envVar.name} entry "${origin}"`, origin);
            if (originErrors.length > 0) {
              log.error(`\n❌ SECURITY: Invalid origin in ${envVar.name}:`);
              originErrors.forEach((e) => log.error(`  ${e}`));
              errors.push(...originErrors);
              allOriginsValid = false;
            }
          }

          if (allOriginsValid) {
            log.info(`  ✅ ${envVar.name} is set with ${origins.length} origin(s) (production requirement)`);
          }
        } else {
          log.info(`  ✅ ${envVar.name} is set (production requirement)`);
        }
      }
    }
  }

  // Check optional variables (warnings only)
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      warnings.push(`⚠️  OPTIONAL: ${envVar.name} is not set (${envVar.description})`);
    } else {
      log.info(`  ✅ ${envVar.name} is set`);
    }
  }

  // Display warnings
  if (warnings.length > 0) {
    log.warn('\n⚠️  Environment Warnings:');
    warnings.forEach((w) => log.warn(`  ${w}`));
  }

  // Handle errors
  if (errors.length > 0) {
    log.error('\n❌ Environment Validation Failed:\n');
    errors.forEach((e) => log.error(`  ${e}`));
    log.error('\n');

    // SECURITY: Fail fast in all environments (including dev)
    // This enforces proper configuration and prevents weak secrets
    log.error('💥 CRITICAL: Cannot start application with invalid environment configuration.');
    log.error('   Please set all required environment variables with proper values.');
    log.error('   See .env.example for reference.\n');

    if (isDevelopment || isTest) {
      log.error('📝 NOTE: Strong secrets are now required even in development.');
      log.error('   This prevents accidentally deploying weak secrets to production.\n');
    }

    process.exit(1);
  } else {
    log.info('✅ Environment validation passed\n');
  }
}

/**
 * Gets a required environment variable, throwing an error if not set
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required environment variable ${name} is not set. ` +
        'Please check your .env file or environment configuration.'
    );
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 * Only use this for truly optional, non-security-critical values
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}
