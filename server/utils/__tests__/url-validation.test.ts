import { describe, it, expect } from 'vitest';
import {
  validateScrapingUrl,
  DEFAULT_ALLOWED_RETAILER_DOMAINS,
  type UrlValidationConfig,
} from '../url-validation';

// Test configuration with common allowed domains
const testConfig: UrlValidationConfig = {
  allowedDomains: ['amazon.com', 'walmart.com', 'target.com'],
};

describe('validateScrapingUrl', () => {
  // ==========================================================================
  // Protocol Validation Tests
  // ==========================================================================
  describe('Protocol Whitelist', () => {
    it('should allow HTTP protocol', () => {
      const result = validateScrapingUrl('http://amazon.com/product', testConfig);
      expect(result.valid).toBe(true);
      expect(result.parsedUrl).toBeDefined();
      expect(result.parsedUrl?.protocol).toBe('http:');
    });

    it('should allow HTTPS protocol', () => {
      const result = validateScrapingUrl('https://amazon.com/product', testConfig);
      expect(result.valid).toBe(true);
      expect(result.parsedUrl).toBeDefined();
      expect(result.parsedUrl?.protocol).toBe('https:');
    });

    it('should block file:// protocol', () => {
      const result = validateScrapingUrl('file:///etc/passwd', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('protocol');
    });

    it('should block ftp:// protocol', () => {
      const result = validateScrapingUrl('ftp://amazon.com/file', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('protocol');
    });

    it('should block gopher:// protocol', () => {
      const result = validateScrapingUrl('gopher://amazon.com/file', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('protocol');
    });

    it('should block data: protocol', () => {
      const result = validateScrapingUrl('data:text/html,<h1>test</h1>', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('protocol');
    });
  });

  // ==========================================================================
  // Domain Whitelist Tests (Primary SSRF Defense)
  // ==========================================================================
  describe('Domain Whitelist', () => {
    it('should allow exact match of whitelisted domain', () => {
      const result = validateScrapingUrl('https://amazon.com/product', testConfig);
      expect(result.valid).toBe(true);
    });

    it('should allow subdomain of whitelisted domain', () => {
      const result = validateScrapingUrl('https://www.amazon.com/product', testConfig);
      expect(result.valid).toBe(true);
    });

    it('should allow deep subdomain of whitelisted domain', () => {
      const result = validateScrapingUrl('https://smile.www.amazon.com/product', testConfig);
      expect(result.valid).toBe(true);
    });

    it('should block non-whitelisted domain', () => {
      const result = validateScrapingUrl('https://evil.com/product', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Domain not allowed');
    });

    it('should block domain that contains whitelisted domain but is not subdomain', () => {
      // amazon.com.evil.com should NOT match amazon.com
      const result = validateScrapingUrl('https://amazon.com.evil.com/product', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Domain not allowed');
    });

    it('should be case-insensitive for domain matching', () => {
      const result = validateScrapingUrl('https://AMAZON.COM/product', testConfig);
      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // IPv4 Private Range Tests
  // ==========================================================================
  describe('IPv4 SSRF Protection', () => {
    it('should block localhost (127.0.0.1)', () => {
      const result = validateScrapingUrl('http://127.0.0.1/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private and internal IP');
    });

    it('should block private network 10.0.0.0/8', () => {
      const result = validateScrapingUrl('http://10.0.0.1/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private and internal IP');
    });

    it('should block private network 172.16.0.0/12', () => {
      const result = validateScrapingUrl('http://172.16.0.1/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private and internal IP');
    });

    it('should block private network 192.168.0.0/16', () => {
      const result = validateScrapingUrl('http://192.168.1.1/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private and internal IP');
    });

    it('should block link-local 169.254.0.0/16', () => {
      const result = validateScrapingUrl('http://169.254.1.1/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private and internal IP');
    });

    it('should block localhost string', () => {
      const result = validateScrapingUrl('http://localhost/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Localhost');
    });

    it('should block 0.0.0.0', () => {
      const result = validateScrapingUrl('http://0.0.0.0/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Localhost');
    });
  });

  // ==========================================================================
  // IPv6 SSRF Protection - ULA (Unique Local Addresses)
  // ==========================================================================
  describe('IPv6 SSRF Protection - ULA (fc00::/7)', () => {
    it('should block fc00::/8 range (start of ULA)', () => {
      const result = validateScrapingUrl('http://[fc00::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6');
      expect(result.error).toContain('fc00::/7');
    });

    it('should block fc00::/8 with full address', () => {
      const result = validateScrapingUrl('http://[fc00:1234:5678:9abc:def0:1234:5678:9abc]/page', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6');
    });

    it('should block fd00::/8 range (second half of ULA)', () => {
      const result = validateScrapingUrl('http://[fd00::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6');
    });

    it('should block fd12::/16 (middle of fd00::/8)', () => {
      const result = validateScrapingUrl('http://[fd12:3456::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6');
    });

    it('should block fdff::/16 (end of fd00::/8)', () => {
      const result = validateScrapingUrl('http://[fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6');
    });

    it('should block ULA with port number', () => {
      const result = validateScrapingUrl('http://[fc00::1]:8080/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6');
    });
  });

  // ==========================================================================
  // IPv6 SSRF Protection - Link-Local (fe80::/10)
  // ==========================================================================
  describe('IPv6 SSRF Protection - Link-Local (fe80::/10)', () => {
    it('should block fe80::/10 (start of link-local)', () => {
      const result = validateScrapingUrl('http://[fe80::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Link-local IPv6');
      expect(result.error).toContain('fe80::/10');
    });

    it('should block fe80:: with full address', () => {
      const result = validateScrapingUrl('http://[fe80:1234:5678:9abc::1]/page', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Link-local IPv6');
    });

    it('should block fe90:: (middle of fe80::/10 range)', () => {
      const result = validateScrapingUrl('http://[fe90::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Link-local IPv6');
    });

    it('should block fea0:: (middle of fe80::/10 range)', () => {
      const result = validateScrapingUrl('http://[fea0::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Link-local IPv6');
    });

    it('should block feb0:: (end of fe80::/10 range)', () => {
      const result = validateScrapingUrl('http://[febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Link-local IPv6');
    });

    it('should block link-local with port number', () => {
      const result = validateScrapingUrl('http://[fe80::1]:8080/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Link-local IPv6');
    });
  });

  // ==========================================================================
  // IPv6 SSRF Protection - Loopback and Unspecified
  // ==========================================================================
  describe('IPv6 SSRF Protection - Loopback and Unspecified', () => {
    it('should block IPv6 loopback ::1', () => {
      const result = validateScrapingUrl('http://[::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Localhost');
    });

    it('should block IPv6 unspecified address ::', () => {
      const result = validateScrapingUrl('http://[::]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Localhost');
    });

    it('should block expanded IPv6 loopback (Node.js compresses to ::1)', () => {
      // Node.js URL parser compresses 0:0:0:0:0:0:0:1 to ::1
      const result = validateScrapingUrl('http://[0:0:0:0:0:0:0:1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Localhost'); // Caught by string check
    });

    it('should block expanded IPv6 unspecified (Node.js compresses to ::)', () => {
      // Node.js URL parser compresses 0:0:0:0:0:0:0:0 to ::
      const result = validateScrapingUrl('http://[0:0:0:0:0:0:0:0]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Localhost'); // Caught by string check
    });
  });

  // ==========================================================================
  // IPv6 SSRF Protection - IPv4-Mapped IPv6 Addresses
  // ==========================================================================
  describe('IPv6 SSRF Protection - IPv4-Mapped IPv6', () => {
    it('should block IPv4-mapped IPv6 with localhost (::ffff:127.0.0.1)', () => {
      const result = validateScrapingUrl('http://[::ffff:127.0.0.1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('IPv4-mapped IPv6');
    });

    it('should block IPv4-mapped IPv6 with private 10.0.0.0/8', () => {
      const result = validateScrapingUrl('http://[::ffff:10.0.0.1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('IPv4-mapped IPv6');
    });

    it('should block IPv4-mapped IPv6 with private 192.168.0.0/16', () => {
      const result = validateScrapingUrl('http://[::ffff:192.168.1.1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('IPv4-mapped IPv6');
    });

    it('should block IPv4-mapped IPv6 with private 172.16.0.0/12', () => {
      const result = validateScrapingUrl('http://[::ffff:172.16.0.1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('IPv4-mapped IPv6');
    });

    it('should block IPv4-mapped IPv6 with link-local 169.254.0.0/16', () => {
      const result = validateScrapingUrl('http://[::ffff:169.254.1.1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('IPv4-mapped IPv6');
    });

    it('should block IPv4-mapped IPv6 with public IPv4 if domain not whitelisted', () => {
      // Verify that public IPs in IPv4-mapped format still respect domain whitelist
      // Google Public DNS (8.8.8.8) is public but not in our test whitelist
      const result = validateScrapingUrl('http://[::ffff:8.8.8.8]/dns', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Domain not allowed'); // Should fail at domain check, NOT IPv6 check
    });

    it('should allow IPv4-mapped IPv6 with public IPv4 to pass IPv6 validation (but still check domain)', () => {
      // This documents that IPv6 validation correctly allows public IPv4 ranges in IPv4-mapped format
      // Node.js converts ::ffff:8.8.8.8 to ::ffff:808:808 (hex notation)
      // The hostname becomes "::ffff:808:808" which won't match domain whitelist "8.8.8.8"
      // This is expected behavior - IPv6 addresses must match domain whitelist in their hostname form
      const customConfig: UrlValidationConfig = {
        allowedDomains: ['::ffff:808:808'], // Whitelisting the actual hostname form Node.js produces
      };
      const result = validateScrapingUrl('http://[::ffff:8.8.8.8]/dns', customConfig);
      expect(result.valid).toBe(true); // Should pass IPv6 validation AND domain whitelist
      expect(result.parsedUrl).toBeDefined();
    });
  });

  // ==========================================================================
  // IPv6 Valid Public Addresses
  // ==========================================================================
  describe('IPv6 Public Addresses (Should Allow)', () => {
    it('should allow public IPv6 (Google DNS 2001:4860:4860::8888)', () => {
      // Note: This will still fail domain whitelist, but passes IPv6 validation
      const result = validateScrapingUrl('http://[2001:4860:4860::8888]/page', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Domain not allowed'); // Fails at domain check, not IPv6
    });

    it('should allow public IPv6 (Cloudflare DNS 2606:4700:4700::1111)', () => {
      // Note: This will still fail domain whitelist, but passes IPv6 validation
      const result = validateScrapingUrl('http://[2606:4700:4700::1111]/page', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Domain not allowed'); // Fails at domain check, not IPv6
    });
  });

  // ==========================================================================
  // IPv6 Address Compression Variants
  // ==========================================================================
  describe('IPv6 Address Compression Variants', () => {
    it('should block compressed IPv6 loopback (::1)', () => {
      const result = validateScrapingUrl('http://[::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Localhost');
    });

    it('should block zero-compressed ULA (fc00::1)', () => {
      const result = validateScrapingUrl('http://[fc00::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6');
    });

    it('should block zero-compressed link-local (fe80::1)', () => {
      const result = validateScrapingUrl('http://[fe80::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Link-local IPv6');
    });
  });

  // ==========================================================================
  // Case Sensitivity Tests
  // ==========================================================================
  describe('Case Sensitivity', () => {
    it('should block uppercase IPv6 ULA (FC00::1)', () => {
      const result = validateScrapingUrl('http://[FC00::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6');
    });

    it('should block mixed case IPv6 ULA (Fc00::1)', () => {
      const result = validateScrapingUrl('http://[Fc00::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6');
    });

    it('should block uppercase IPv6 link-local (FE80::1)', () => {
      const result = validateScrapingUrl('http://[FE80::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Link-local IPv6');
    });

    it('should block mixed case IPv6 link-local (Fe80::1)', () => {
      const result = validateScrapingUrl('http://[Fe80::1]/admin', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Link-local IPv6');
    });
  });

  // ==========================================================================
  // Edge Cases and Attack Vectors
  // ==========================================================================
  describe('Edge Cases and Attack Vectors', () => {
    it('should block IPv6 with whitelisted domain in path', () => {
      // Attacker tries to bypass by including amazon.com in path, but hostname is fc00::1
      const result = validateScrapingUrl('http://[fc00::1]/amazon.com/page', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6'); // Fails at IPv6 validation
    });

    it('should block IPv6 with whitelisted domain in query param', () => {
      // Attacker tries to bypass by including amazon.com in query, but hostname is fc00::1
      const result = validateScrapingUrl('http://[fc00::1]/?domain=amazon.com', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private IPv6'); // Fails at IPv6 validation
    });

    it('should handle malformed URL gracefully', () => {
      const result = validateScrapingUrl('not-a-url', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should handle empty URL gracefully', () => {
      const result = validateScrapingUrl('', testConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should handle URL with no hostname gracefully', () => {
      const result = validateScrapingUrl('http://', testConfig);
      expect(result.valid).toBe(false);
      // Either invalid format or domain not allowed
      expect(result.error).toBeDefined();
    });
  });

  // ==========================================================================
  // Integration with Whitelisted Domains
  // ==========================================================================
  describe('Integration with Whitelisted Domains', () => {
    it('should allow valid HTTPS URL with whitelisted domain', () => {
      const result = validateScrapingUrl('https://www.amazon.com/dp/B08N5WRWNW', testConfig);
      expect(result.valid).toBe(true);
      expect(result.parsedUrl).toBeDefined();
      expect(result.parsedUrl?.hostname).toBe('www.amazon.com');
    });

    it('should allow valid HTTP URL with whitelisted domain', () => {
      const result = validateScrapingUrl('http://walmart.com/product/12345', testConfig);
      expect(result.valid).toBe(true);
      expect(result.parsedUrl).toBeDefined();
    });

    it('should allow URL with query parameters', () => {
      const result = validateScrapingUrl('https://amazon.com/product?id=123&ref=test', testConfig);
      expect(result.valid).toBe(true);
    });

    it('should allow URL with fragment', () => {
      const result = validateScrapingUrl('https://target.com/product#reviews', testConfig);
      expect(result.valid).toBe(true);
    });

    it('should allow URL with port number', () => {
      const result = validateScrapingUrl('https://amazon.com:443/product', testConfig);
      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // DEFAULT_ALLOWED_RETAILER_DOMAINS Tests
  // ==========================================================================
  describe('DEFAULT_ALLOWED_RETAILER_DOMAINS', () => {
    it('should include common retailers', () => {
      expect(DEFAULT_ALLOWED_RETAILER_DOMAINS).toContain('amazon.com');
      expect(DEFAULT_ALLOWED_RETAILER_DOMAINS).toContain('walmart.com');
      expect(DEFAULT_ALLOWED_RETAILER_DOMAINS).toContain('target.com');
      expect(DEFAULT_ALLOWED_RETAILER_DOMAINS).toContain('bestbuy.com');
    });

    it('should work with default configuration', () => {
      const result = validateScrapingUrl('https://amazon.com/product', {
        allowedDomains: [...DEFAULT_ALLOWED_RETAILER_DOMAINS],
      });
      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // Custom Protocol Configuration
  // ==========================================================================
  describe('Custom Protocol Configuration', () => {
    it('should allow custom protocols when specified', () => {
      const customConfig: UrlValidationConfig = {
        allowedDomains: ['amazon.com'],
        allowedProtocols: ['http:', 'https:', 'ftp:'],
      };
      const result = validateScrapingUrl('ftp://amazon.com/file', customConfig);
      expect(result.valid).toBe(true);
    });

    it('should block protocols not in custom whitelist', () => {
      const customConfig: UrlValidationConfig = {
        allowedDomains: ['amazon.com'],
        allowedProtocols: ['https:'], // Only HTTPS
      };
      const result = validateScrapingUrl('http://amazon.com/product', customConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('protocol');
    });
  });
});
