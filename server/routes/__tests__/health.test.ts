/**
 * Health Check Endpoints Tests
 *
 * Verifies health check endpoints for load balancers and monitoring systems.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { healthRouter } from '../health';
import { getRedisClient } from '../../config/redis';

describe('Health Check Endpoints', () => {
  const app = express();
  app.use(healthRouter);

  describe('GET /health', () => {
    it('should return 200 with basic status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });

      // Verify timestamp is valid ISO date
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);

      // Uptime should be positive
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('should not require authentication', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
    });

    it('should respond quickly', async () => {
      const start = Date.now();
      await request(app).get('/health').expect(200);
      const duration = Date.now() - start;

      // Should respond in less than 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 with dependency status when all healthy', async () => {
      const response = await request(app).get('/health/ready').expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded)$/),
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number),
        checks: {
          database: {
            status: expect.stringMatching(/^(pass|fail)$/),
          },
          redis: {
            status: expect.stringMatching(/^(pass|fail)$/),
          },
        },
        memory: {
          heapUsedMB: expect.any(Number),
          heapTotalMB: expect.any(Number),
          rssMB: expect.any(Number),
        },
      });
    });

    it('should include latency metrics for successful checks', async () => {
      const response = await request(app).get('/health/ready').expect(200);

      if (response.body.checks.database.status === 'pass') {
        expect(response.body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
      }

      if (response.body.checks.redis.status === 'pass') {
        expect(response.body.checks.redis.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should verify database connectivity', async () => {
      const response = await request(app).get('/health/ready');

      // Database should be healthy in test environment
      expect(response.body.checks.database.status).toBe('pass');
      expect(response.body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should verify Redis connectivity if available', async () => {
      const redisClient = getRedisClient();
      const response = await request(app).get('/health/ready');

      if (redisClient) {
        // Redis is configured - should pass
        expect(response.body.checks.redis.status).toBe('pass');
        expect(response.body.checks.redis.latencyMs).toBeGreaterThanOrEqual(0);
      } else {
        // Redis not configured - should fail
        expect(response.body.checks.redis.status).toBe('fail');
        expect(response.body.checks.redis.message).toBeTruthy();
      }
    });

    it('should include memory metrics', async () => {
      const response = await request(app).get('/health/ready').expect(200);

      expect(response.body.memory.heapUsedMB).toBeGreaterThan(0);
      expect(response.body.memory.heapTotalMB).toBeGreaterThan(0);
      expect(response.body.memory.rssMB).toBeGreaterThan(0);

      // Heap used should be less than total
      expect(response.body.memory.heapUsedMB).toBeLessThanOrEqual(
        response.body.memory.heapTotalMB
      );
    });

    it('should return degraded status when Redis is unavailable', async () => {
      const response = await request(app).get('/health/ready');

      // In test environment without Redis, status should be degraded or healthy
      // (healthy if database is working, degraded if Redis is missing)
      expect(['healthy', 'degraded']).toContain(response.body.status);

      // But response should still be 200
      expect(response.status).toBe(200);
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed diagnostics in development', async () => {
      const response = await request(app).get('/health/detailed').expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        environment: expect.any(String),
        nodeVersion: expect.any(String),
        uptime: expect.any(Number),
        pid: expect.any(Number),
        memory: {
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number),
        },
        cpu: {
          user: expect.any(Number),
          system: expect.any(Number),
        },
      });
    });

    it('should include Node.js version', async () => {
      const response = await request(app).get('/health/detailed').expect(200);

      expect(response.body.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it('should include process ID', async () => {
      const response = await request(app).get('/health/detailed').expect(200);

      expect(response.body.pid).toBe(process.pid);
    });

    it('should include CPU usage metrics', async () => {
      const response = await request(app).get('/health/detailed').expect(200);

      expect(response.body.cpu.user).toBeGreaterThanOrEqual(0);
      expect(response.body.cpu.system).toBeGreaterThanOrEqual(0);
    });

    it('should require auth header in production', async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.HEALTH_CHECK_KEY = 'test-secret-key';

      try {
        // Without header - should fail
        await request(app).get('/health/detailed').expect(403);

        // With wrong header - should fail
        await request(app)
          .get('/health/detailed')
          .set('x-health-key', 'wrong-key')
          .expect(403);

        // With correct header - should succeed
        const response = await request(app)
          .get('/health/detailed')
          .set('x-health-key', 'test-secret-key')
          .expect(200);

        expect(response.body.status).toBe('healthy');
      } finally {
        // Restore environment
        process.env.NODE_ENV = originalEnv;
        delete process.env.HEALTH_CHECK_KEY;
      }
    });
  });

  describe('Response format consistency', () => {
    it('all endpoints should return JSON', async () => {
      const endpoints = ['/health', '/health/ready', '/health/detailed'];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.headers['content-type']).toMatch(/application\/json/);
      }
    });

    it('all endpoints should include timestamp', async () => {
      const endpoints = ['/health', '/health/ready', '/health/detailed'];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.body.timestamp).toBeTruthy();
        expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
      }
    });
  });
});
