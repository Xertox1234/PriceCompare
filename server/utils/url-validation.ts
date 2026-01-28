/**
 * URL Validation Utilities for SSRF Protection
 *
 * Provides comprehensive validation for web scraping URLs with multi-layer SSRF defense:
 * 1. Protocol whitelist (http/https only)
 * 2. Domain whitelist (allowed retailers)
 * 3. IPv4 private range blocking (RFC 1918, RFC 3927)
 * 4. IPv6 private range blocking (RFC 4193, RFC 4291)
 * 5. IPv4-mapped IPv6 address blocking (RFC 4291 §2.5.5.2)
 *
 * Security layers are applied in order. Each layer provides defense-in-depth against
 * Server-Side Request Forgery (SSRF) attacks targeting internal infrastructure.
 *
 * @see docs/04_SECURITY_PATTERNS.md for security architecture
 * @see docs/LEARNINGS_IPV6_SSRF_FIX_2025_12_23.md for implementation context
 */

/**
 * Result of URL validation with parsed URL if valid
 */
export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  parsedUrl?: URL;
}

/**
 * Configuration for URL validation
 */
export interface UrlValidationConfig {
  /** Allowed domain names (e.g., ['amazon.com', 'walmart.com']) */
  allowedDomains: string[];
  /** Allowed protocols (defaults to ['http:', 'https:']) */
  allowedProtocols?: string[];
}

// ============================================================================
// IPv6 Private Range Patterns (RFC-based)
// ============================================================================
// Pre-compiled regex patterns for performance (module-level constants)

/**
 * RFC 4193: Unique Local Addresses (ULA)
 * Range: fc00::/7 (includes fc00::/8 and fd00::/8)
 * Pattern: f followed by c or d, then any two hex digits
 * Examples: fc00::1, fd12:3456::1, fdff:ffff:ffff::1
 */
const IPV6_ULA_REGEX = /^f[cd][0-9a-f]{2}:/i;

/**
 * RFC 4291 §2.5.6: Link-Local Unicast Addresses
 * Range: fe80::/10 (fe80:0000::/10 to febf:ffff::/10)
 * Pattern: fe followed by 8-b in third nibble, then any hex in fourth
 * Examples: fe80::1, fe90::1, fea0::1, feb0::1
 */
const IPV6_LINK_LOCAL_REGEX = /^fe[89ab][0-9a-f]:/i;

/**
 * RFC 4291 §2.5.3: Loopback Address
 * Address: ::1 (0:0:0:0:0:0:0:1)
 * Handles both compressed (::1) and expanded (0:0:0:0:0:0:0:1) formats
 */
const IPV6_LOOPBACK_REGEX = /^(0:){7}1$|^::1$/i;

/**
 * RFC 4291 §2.5.2: Unspecified Address
 * Address: :: (0:0:0:0:0:0:0:0)
 * Handles both compressed (::) and expanded (0:0:0:0:0:0:0:0) formats
 */
const IPV6_UNSPECIFIED_REGEX = /^(0:){7}0$|^::$/i;

/**
 * RFC 4291 §2.5.5.2: IPv4-Mapped IPv6 Addresses
 * Range: ::ffff:0:0/96 (IPv4 addresses mapped into IPv6)
 * Format: ::ffff:192.168.1.1 (dotted) or ::ffff:c0a8:101 (hex notation)
 * Note: Node.js URL parser converts dotted format to hex (::ffff:127.0.0.1 → ::ffff:7f00:1)
 * Examples: ::ffff:127.0.0.1, ::ffff:7f00:1, ::ffff:c0a8:101
 */
const IPV4_MAPPED_IPV6_REGEX = /^::ffff:([0-9a-f]{1,4}:[0-9a-f]{1,4}|([0-9]{1,3}\.){3}[0-9]{1,3})$/i;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Defensively extracts hostname from URL object
 * Strips IPv6 brackets and validates output
 *
 * @param url - Parsed URL object
 * @returns Clean lowercase hostname WITHOUT brackets
 * @throws Error if hostname extraction fails
 */
function extractHostname(url: URL): string {
  // URL constructor guarantees hostname property exists
  let hostname = url.hostname.toLowerCase();

  // CRITICAL: Node.js URL.hostname INCLUDES brackets for IPv6 addresses
  // Strip brackets for consistent validation
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  // Validation: Ensure we got a valid hostname
  if (!hostname || hostname.length === 0) {
    throw new Error('Invalid hostname extracted from URL');
  }

  return hostname;
}

/**
 * Checks if an IPv4 address is in a private range
 *
 * Blocks:
 * - 127.0.0.0/8 (localhost - RFC 1122 §3.2.1.3)
 * - 10.0.0.0/8 (private - RFC 1918)
 * - 172.16.0.0/12 (private - RFC 1918)
 * - 192.168.0.0/16 (private - RFC 1918)
 * - 169.254.0.0/16 (link-local - RFC 3927)
 *
 * @param ip - IPv4 address string (e.g., "192.168.1.1")
 * @returns true if address is in a private range
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.');

  // Validation: Ensure we have exactly 4 octets
  if (parts.length !== 4) {
    return false;
  }

  // Validate each octet is numeric and in valid range (0-255)
  const octets: number[] = [];
  for (const part of parts) {
    const octetValue = parseInt(part, 10);
    if (isNaN(octetValue) || octetValue < 0 || octetValue > 255) {
      return false; // Invalid octet range
    }
    octets.push(octetValue);
  }

  const [first, second] = octets;

  // Check all private ranges
  return (
    first === 127 ||                                    // 127.0.0.0/8 (localhost)
    first === 10 ||                                     // 10.0.0.0/8 (private)
    (first === 172 && second >= 16 && second <= 31) ||  // 172.16.0.0/12 (private)
    (first === 192 && second === 168) ||                // 192.168.0.0/16 (private)
    (first === 169 && second === 254)                   // 169.254.0.0/16 (link-local)
  );
}

/**
 * Validates hostname against IPv6 private ranges
 *
 * @param hostname - Clean hostname (no brackets)
 * @returns Error message if blocked, undefined if allowed
 */
function validateIPv6Ranges(hostname: string): string | undefined {
  // Check for IPv6 Unique Local Addresses (fc00::/7)
  if (IPV6_ULA_REGEX.test(hostname)) {
    return 'Private IPv6 addresses (fc00::/7) are not allowed for security reasons.';
  }

  // Check for IPv6 Link-Local addresses (fe80::/10)
  if (IPV6_LINK_LOCAL_REGEX.test(hostname)) {
    return 'Link-local IPv6 addresses (fe80::/10) are not allowed for security reasons.';
  }

  // Check for IPv6 loopback (::1)
  if (IPV6_LOOPBACK_REGEX.test(hostname)) {
    return 'IPv6 loopback address (::1) is not allowed.';
  }

  // Check for IPv6 unspecified address (::)
  if (IPV6_UNSPECIFIED_REGEX.test(hostname)) {
    return 'IPv6 unspecified address (::) is not allowed.';
  }

  // Check for IPv4-mapped IPv6 addresses (::ffff:0:0/96)
  if (IPV4_MAPPED_IPV6_REGEX.test(hostname)) {
    // Extract the IPv4 portion and validate it
    // Node.js converts ::ffff:127.0.0.1 to ::ffff:7f00:1 (hex notation)
    // We need to handle both formats
    const dottedMatch = hostname.match(/([0-9]{1,3}\.){3}[0-9]{1,3}$/);
    const hexMatch = hostname.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);

    let ipv4Address: string | null = null;

    if (dottedMatch) {
      // Already in dotted decimal format
      ipv4Address = dottedMatch[0];
    } else if (hexMatch) {
      // Convert from hex notation to dotted decimal
      // Each hex value contains 2 octets: high byte and low byte
      // Example: ::ffff:7f00:1 → hex1=0x7f00 (127.0), hex2=0x0001 (0.1) → 127.0.0.1
      const hex1 = parseInt(hexMatch[1], 16);
      const hex2 = parseInt(hexMatch[2], 16);

      // Extract individual octets from each 16-bit hex value using bitwise operations
      // Each hex value is 16 bits (2 bytes), we need to extract both bytes
      const octet1 = (hex1 >> 8) & 0xFF;    // High byte of hex1: shift right 8 bits, mask to get low 8 bits
      const octet2 = hex1 & 0xFF;           // Low byte of hex1: mask with 0xFF to get low 8 bits
      const octet3 = (hex2 >> 8) & 0xFF;    // High byte of hex2: shift right 8 bits, mask to get low 8 bits
      const octet4 = hex2 & 0xFF;           // Low byte of hex2: mask with 0xFF to get low 8 bits

      ipv4Address = `${octet1}.${octet2}.${octet3}.${octet4}`;
    }

    if (ipv4Address && isPrivateIPv4(ipv4Address)) {
      return 'IPv4-mapped IPv6 addresses with private IPv4 ranges are not allowed.';
    }

    // IPv4-mapped but public IPv4 - allow
    return undefined;
  }

  return undefined;
}

/**
 * Validates hostname against IPv4 private ranges
 *
 * @param hostname - Clean hostname
 * @returns Error message if blocked, undefined if allowed
 */
function validateIPv4Ranges(hostname: string): string | undefined {
  // Check if hostname is an IPv4 address
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(hostname)) {
    return undefined;
  }

  // Validate against private ranges
  if (isPrivateIPv4(hostname)) {
    return 'Private and internal IP addresses are not allowed.';
  }

  return undefined;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validates URL for web scraping with comprehensive SSRF protection
 *
 * Applies multi-layer security validation:
 * 1. Protocol whitelist (http/https only)
 * 2. Domain whitelist (allowed retailers)
 * 3. IPv4 private range blocking
 * 4. IPv6 private range blocking
 * 5. IPv4-mapped IPv6 address blocking
 *
 * @param url - URL to validate
 * @param config - Validation configuration with allowed domains
 * @returns Validation result with parsed URL if valid
 *
 * @example
 * ```typescript
 * const result = validateScrapingUrl('https://amazon.com/product', {
 *   allowedDomains: ['amazon.com', 'walmart.com']
 * });
 *
 * if (!result.valid) {
 *   console.error(result.error);
 *   return;
 * }
 *
 * const productUrl = result.parsedUrl; // Type-safe URL object
 * ```
 */
export function validateScrapingUrl(
  url: string,
  config: UrlValidationConfig
): UrlValidationResult {
  try {
    const parsedUrl = new URL(url);
    const allowedProtocols = config.allowedProtocols || ['http:', 'https:'];

    // ========================================================================
    // Layer 1: Protocol Whitelist
    // ========================================================================
    // Only allow HTTP and HTTPS to prevent file://, ftp://, gopher://, etc.
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return {
        valid: false,
        error: 'Invalid URL protocol. Only HTTP and HTTPS are allowed.',
      };
    }

    // ========================================================================
    // Layer 2: Extract and Clean Hostname
    // ========================================================================
    const hostname = extractHostname(parsedUrl);

    // ========================================================================
    // Layer 3: Localhost String Variations (Quick Check First)
    // ========================================================================
    // Check common localhost string variations before expensive regex
    const localhostVariants = ['localhost', '0.0.0.0', '::1', '::'];
    if (localhostVariants.includes(hostname)) {
      return {
        valid: false,
        error: 'Localhost addresses are not allowed.',
      };
    }

    // ========================================================================
    // Layer 4: IPv4 Private Range Blocking (Defense-in-Depth)
    // ========================================================================
    // Block IPv4 private addresses BEFORE domain whitelist check
    // This prevents DNS rebinding or configuration attacks
    const ipv4Error = validateIPv4Ranges(hostname);
    if (ipv4Error) {
      return { valid: false, error: ipv4Error };
    }

    // ========================================================================
    // Layer 5: IPv6 Private Range Blocking (Defense-in-Depth)
    // ========================================================================
    // Block IPv6 private addresses BEFORE domain whitelist check
    // This prevents DNS rebinding or configuration attacks
    const ipv6Error = validateIPv6Ranges(hostname);
    if (ipv6Error) {
      return { valid: false, error: ipv6Error };
    }

    // ========================================================================
    // Layer 6: Domain Whitelist (Primary SSRF Defense)
    // ========================================================================
    // Validate against allowed domains (after IP checks)
    const isAllowedDomain = config.allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowedDomain) {
      return {
        valid: false,
        error: `Domain not allowed. Allowed domains: ${config.allowedDomains.join(', ')}`,
      };
    }

    // ========================================================================
    // All Validations Passed
    // ========================================================================
    return { valid: true, parsedUrl };

  } catch (error: unknown) {
    // URL constructor throws on invalid URLs
    return {
      valid: false,
      error: 'Invalid URL format.',
    };
  }
}

/**
 * Default allowed retailer domains for scraping
 * Maintained as a constant for consistency across the application
 */
export const DEFAULT_ALLOWED_RETAILER_DOMAINS = [
  // US Retailers
  'amazon.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'ebay.com',
  'newegg.com',
  'bhphotovideo.com',
  'apple.com',
  'homedepot.com',
  'lowes.com',
  'macys.com',
  'nordstrom.com',
  'costco.com',
  'samsclub.com',
  // Canadian Retailers (CAD currency)
  'amazon.ca',
  'bestbuy.ca',
  'canadacomputers.com',
  'memoryexpress.com',
  'newegg.ca',
  'walmart.ca',
  'costco.ca',
] as const;
