/**
 * Environment Variable Validation
 *
 * This module ensures all required secrets and configuration values are present
 * before the application starts. This prevents security vulnerabilities from
 * missing or default secret values.
 */

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

const OPTIONAL_ENV_VARS: RequiredEnvVar[] = [
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
 * Validates all required environment variables are present and secure
 * Throws an error if validation fails in production
 * Logs warnings in development
 */
export function validateEnvironment(): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('🔍 Validating environment configuration...');

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      const message = `❌ CRITICAL: ${envVar.name} is not set (${envVar.description})`;
      errors.push(message);
      continue;
    }

    // Validate secret strength for critical secrets
    if (envVar.critical && envVar.name.includes('SECRET')) {
      const secretErrors = validateSecretStrength(envVar.name, value);
      if (secretErrors.length > 0) {
        if (isDevelopment || isTest) {
          warnings.push(...secretErrors.map(e => `⚠️  WARNING: ${e}`));
        } else {
          errors.push(...secretErrors);
        }
      }
    }

    console.log(`  ✅ ${envVar.name} is set`);
  }

  // Check optional variables (warnings only)
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      warnings.push(`⚠️  OPTIONAL: ${envVar.name} is not set (${envVar.description})`);
    } else {
      console.log(`  ✅ ${envVar.name} is set`);
    }
  }

  // Display warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Environment Warnings:');
    warnings.forEach(w => console.log(`  ${w}`));
  }

  // Handle errors
  if (errors.length > 0) {
    console.error('\n❌ Environment Validation Failed:\n');
    errors.forEach(e => console.error(`  ${e}`));
    console.error('\n');

    if (!isDevelopment && !isTest) {
      console.error('💥 CRITICAL: Cannot start application with invalid environment configuration.');
      console.error('   Please set all required environment variables before starting the server.');
      console.error('   See .env.example for reference.\n');
      process.exit(1);
    } else {
      console.warn('\n⚠️  Development mode: Continuing despite errors (fix before production!)');
    }
  } else {
    console.log('✅ Environment validation passed\n');
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
