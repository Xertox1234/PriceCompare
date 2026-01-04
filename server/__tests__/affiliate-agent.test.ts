import { describe, it, expect } from 'vitest';
import { AffiliateLinkAgent } from '../agents/affiliate-agent';
import { storage } from '../storage';

describe('Affiliate Agent - Retailer Breakdown', () => {
  it('should return byRetailer field populated with affiliate link counts', async () => {
    // Create agent instance
    const agent = new AffiliateLinkAgent();
    // Get stats from the agent
    const stats = await agent.getStats();

    // Verify stats structure
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('links');
    expect(stats!.links).toHaveProperty('byRetailer');
    expect(typeof stats!.links.byRetailer).toBe('object');

    // byRetailer should be a Record<string, number>
    const byRetailer = stats!.links.byRetailer;

    // All values should be numbers >= 0
    Object.values(byRetailer).forEach((count) => {
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    // All keys should be retailer names (strings)
    Object.keys(byRetailer).forEach((name) => {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  it('should only include retailers with affiliate links in byRetailer', async () => {
    // Create agent instance
    const agent = new AffiliateLinkAgent();

    // Get all retailers
    const retailers = await storage.getRetailers();

    // Get stats
    const stats = await agent.getStats();
    expect(stats).toBeDefined();

    const byRetailer = stats!.links.byRetailer;

    // Each retailer in byRetailer should have affiliate_offers > 0
    for (const retailerName of Object.keys(byRetailer)) {
      const count = byRetailer[retailerName];
      expect(count).toBeGreaterThan(0);

      // Verify retailer exists
      const retailer = retailers.find((r) => r.name === retailerName);
      expect(retailer).toBeDefined();
    }
  });

  it('should handle empty database gracefully', async () => {
    // Create agent instance
    const agent = new AffiliateLinkAgent();

    // Even with no data, should return valid structure
    const stats = await agent.getStats();

    expect(stats).toBeDefined();
    expect(stats!.links.byRetailer).toBeDefined();
    expect(typeof stats!.links.byRetailer).toBe('object');
  });
});
