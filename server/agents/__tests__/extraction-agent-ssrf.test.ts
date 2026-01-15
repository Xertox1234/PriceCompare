/**
 * SSRF Protection Tests for Data Extraction Agent
 *
 * Verifies that the extraction agent properly validates URLs to prevent
 * Server-Side Request Forgery (SSRF) attacks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataExtractionAgent } from '../extraction-agent';
import type { ExtractionTask } from '../types';

describe('DataExtractionAgent - SSRF Protection', () => {
  let agent: DataExtractionAgent;

  beforeEach(() => {
    agent = new DataExtractionAgent();
  });

  describe('Blocks Private IP Addresses', () => {
    it('should reject localhost (127.0.0.1)', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://127.0.0.1/admin',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Private and internal IP/);
    });

    it('should reject private network 10.0.0.0/8', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://10.0.0.1/config',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Private and internal IP/);
    });

    it('should reject private network 172.16.0.0/12', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://172.16.0.1/admin',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Private and internal IP/);
    });

    it('should reject private network 192.168.0.0/16', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://192.168.1.1/router',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Private and internal IP/);
    });

    it('should reject AWS metadata endpoint (169.254.169.254)', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://169.254.169.254/latest/meta-data/',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Private and internal IP/);
    });
  });

  describe('Blocks Localhost Variations', () => {
    it('should reject localhost string', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://localhost:8080/admin',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Localhost/);
    });

    it('should reject IPv6 localhost (::1)', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://[::1]/admin',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Localhost/);
    });

    it('should reject 0.0.0.0', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://0.0.0.0/admin',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Localhost/);
    });
  });

  describe('Blocks IPv6 Private Addresses', () => {
    it('should reject IPv6 ULA (fc00::/7)', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://[fc00::1]/admin',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Private IPv6/);
    });

    it('should reject IPv6 link-local (fe80::/10)', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://[fe80::1]/admin',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Link-local IPv6/);
    });

    it('should reject IPv4-mapped IPv6 with private IP', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://[::ffff:127.0.0.1]/admin',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/IPv4-mapped IPv6/);
    });
  });

  describe('Enforces Domain Allowlist', () => {
    it('should reject non-whitelisted domain', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://malicious-site.com/product',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Domain not allowed/);
    });

    it('should reject domain with whitelisted domain in path', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://evil.com/amazon.com/product',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Domain not allowed/);
    });

    it('should reject domain with whitelisted domain suffix but different root', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://amazon.com.evil.com/product',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
      await expect(agent.processTask(task)).rejects.toThrow(/Domain not allowed/);
    });
  });

  describe('Allows Valid Retailer URLs', () => {
    // Note: These are unit tests for URL validation only.
    // Actual extraction is tested in integration tests with network access.
    // We verify that valid retailer URLs pass validation (fail fast is disabled).

    it.skip('should allow Amazon URLs (requires network access)', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://www.amazon.com/product/B08N5WRWNW',
        retailer: 'amazon.com',
      };

      // Will fail later in extraction, but URL validation should pass
      // The error should NOT be about URL validation
      await expect(agent.processTask(task)).rejects.not.toThrow(/URL validation failed/);
    });

    it.skip('should allow Walmart URLs (requires network access)', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://www.walmart.com/ip/12345',
        retailer: 'walmart.com',
      };

      // Will fail later in extraction, but URL validation should pass
      await expect(agent.processTask(task)).rejects.not.toThrow(/URL validation failed/);
    });

    it.skip('should allow Target URLs (requires network access)', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://www.target.com/p/A-12345',
        retailer: 'target.com',
      };

      // Will fail later in extraction, but URL validation should pass
      await expect(agent.processTask(task)).rejects.not.toThrow(/URL validation failed/);
    });

    it.skip('should allow BestBuy URLs (requires network access)', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://www.bestbuy.com/site/12345',
        retailer: 'bestbuy.com',
      };

      // Will fail later in extraction, but URL validation should pass
      await expect(agent.processTask(task)).rejects.not.toThrow(/URL validation failed/);
    });
  });

  describe('Attack Vector Prevention', () => {
    it('should prevent internal service scanning', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://192.168.1.100:8080/api/admin',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
    });

    it('should prevent cloud metadata access', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
    });

    it('should prevent port scanning', async () => {
      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'http://10.0.0.1:22/ssh',
        retailer: 'test',
      };

      await expect(agent.processTask(task)).rejects.toThrow(/URL validation failed/);
    });
  });
});
