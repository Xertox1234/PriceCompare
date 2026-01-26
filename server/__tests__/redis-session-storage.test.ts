/**
 * Redis Session Storage Tests
 *
 * Tests for Redis session persistence, TTL behavior, and multi-instance compatibility.
 * These tests verify the fixes from todo 002 (Redis session storage integration).
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import type { RedisClientType } from 'redis';
import type { Store } from 'express-session';
import { initializeRedis, getRedisSessionClient, closeRedis } from '../config/redis';
import { createSessionStore } from '../config/session-store';

describe('Redis Session Storage Integration', () => {
  let app: express.Application;
  let redisSessionClient: RedisClientType | null;
  let sessionStore: Store | undefined;

  beforeAll(async () => {
    // Initialize Redis connection
    await initializeRedis();
    redisSessionClient = getRedisSessionClient();

    if (!redisSessionClient) {
      console.warn('⚠️  Redis not available - skipping Redis session tests');
      return;
    }

    sessionStore = await createSessionStore(redisSessionClient);

    // Create test Express app
    app = express();
    app.use(express.json());
    app.use(
      session({
        store: sessionStore,
        secret: 'test-secret-key-for-sessions-testing-only',
        resave: false,
        saveUninitialized: false,
        cookie: {
          // Use secure cookies in production, not in test
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
      })
    );

    // Test routes
    app.post('/api/test/login', (req, res) => {
      if (req.session) {
        req.session.userId = req.body.userId;
        req.session.username = req.body.username;
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Session not available' });
      }
    });

    app.get('/api/test/session', (req, res) => {
      if (req.session?.userId) {
        res.json({
          authenticated: true,
          userId: req.session.userId,
          username: req.session.username,
        });
      } else {
        res.json({ authenticated: false });
      }
    });

    app.post('/api/test/logout', (req, res) => {
      req.session?.destroy((err) => {
        if (err) {
          res.status(500).json({ error: 'Logout failed' });
        } else {
          res.json({ success: true });
        }
      });
    });
  });

  afterAll(async () => {
    await closeRedis();
  });

  beforeEach(async () => {
    if (!redisSessionClient) return;

    // Clean up test sessions before each test
    const keys = await redisSessionClient.keys('sess:*');
    if (keys.length > 0) {
      await redisSessionClient.del(keys);
    }
  });

  test('Redis session client should be initialized', () => {
    if (!redisSessionClient) {
      console.warn('⚠️  Skipping test - Redis not available');
      return;
    }

    expect(redisSessionClient).toBeDefined();
    expect(typeof redisSessionClient.ping).toBe('function');
  });

  test('session store should be initialized with Redis', () => {
    if (!redisSessionClient) {
      console.warn('⚠️  Skipping test - Redis not available');
      return;
    }

    expect(sessionStore).toBeDefined();
    if (!sessionStore) return;
    // connect-redis v9 store should have these methods
    expect(typeof sessionStore.get).toBe('function');
    expect(typeof sessionStore.set).toBe('function');
    expect(typeof sessionStore.destroy).toBe('function');
  });

  test('should create session on login', async () => {
    if (!app) {
      console.warn('⚠️  Skipping test - App not initialized');
      return;
    }

    const response = await request(app)
      .post('/api/test/login')
      .send({ userId: 123, username: 'testuser' })
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify session was stored in Redis
    if (!redisSessionClient) return;
    const sessionKeys = await redisSessionClient.keys('sess:*');
    expect(sessionKeys.length).toBeGreaterThan(0);
  });

  test('should persist session data across requests', async () => {
    if (!app) {
      console.warn('⚠️  Skipping test - App not initialized');
      return;
    }

    // Login to create session
    const loginResponse = await request(app)
      .post('/api/test/login')
      .send({ userId: 456, username: 'persistuser' })
      .expect(200);

    // Extract session cookie
    const cookies = loginResponse.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // Make subsequent request with session cookie
    const sessionResponse = await request(app)
      .get('/api/test/session')
      .set('Cookie', cookies)
      .expect(200);

    expect(sessionResponse.body.authenticated).toBe(true);
    expect(sessionResponse.body.userId).toBe(456);
    expect(sessionResponse.body.username).toBe('persistuser');
  });

  test('should destroy session on logout', async () => {
    if (!app) {
      console.warn('⚠️  Skipping test - App not initialized');
      return;
    }

    // Login
    const loginResponse = await request(app)
      .post('/api/test/login')
      .send({ userId: 789, username: 'logoutuser' })
      .expect(200);

    const cookies = loginResponse.headers['set-cookie'];

    // Verify session exists in Redis
    if (!redisSessionClient) return;
    let sessionKeys = await redisSessionClient.keys('sess:*');
    expect(sessionKeys.length).toBeGreaterThan(0);

    // Logout
    await request(app).post('/api/test/logout').set('Cookie', cookies).expect(200);

    // Verify session was removed from Redis
    sessionKeys = await redisSessionClient.keys('sess:*');
    expect(sessionKeys.length).toBe(0);
  });

  test('session should use correct Redis key prefix', async () => {
    if (!app) {
      console.warn('⚠️  Skipping test - App not initialized');
      return;
    }

    await request(app)
      .post('/api/test/login')
      .send({ userId: 999, username: 'prefixuser' })
      .expect(200);

    if (!redisSessionClient) return;
    const sessionKeys = await redisSessionClient.keys('sess:*');
    expect(sessionKeys.length).toBeGreaterThan(0);

    // Verify all keys start with 'sess:' prefix
    for (const key of sessionKeys) {
      expect(key).toMatch(/^sess:/);
    }
  });

  test('unauthenticated request should not have session data', async () => {
    if (!app) {
      console.warn('⚠️  Skipping test - App not initialized');
      return;
    }

    const response = await request(app).get('/api/test/session').expect(200);

    expect(response.body.authenticated).toBe(false);
  });

  test('session TTL should be configured correctly', async () => {
    if (!redisSessionClient || !sessionStore) {
      console.warn('⚠️  Skipping test - Redis not available');
      return;
    }

    // Extract sessionStore (guaranteed by guard above)
    const store = sessionStore;

    // Create a test session directly via the store
    const testSessionId = 'test-session-ttl-123';
    const testSessionData = {
      cookie: { maxAge: 86400000 }, // 24 hours
      userId: 111,
      username: 'ttluser',
    };

    await new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Session store type mismatch with express-session types
      store.set(testSessionId, testSessionData as any, (err?: Error) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    // Check TTL in Redis (should be ~86400 seconds / 24 hours)
    const ttl = await redisSessionClient.ttl(`sess:${testSessionId}`);
    expect(ttl).toBeGreaterThan(86300); // Allow small margin
    expect(ttl).toBeLessThanOrEqual(86400);

    // Clean up
    await redisSessionClient.del(`sess:${testSessionId}`);
  });

  test('should handle concurrent sessions for different users', async () => {
    if (!app) {
      console.warn('⚠️  Skipping test - App not initialized');
      return;
    }

    // Create two different sessions
    const response1 = await request(app)
      .post('/api/test/login')
      .send({ userId: 1001, username: 'user1' })
      .expect(200);

    const response2 = await request(app)
      .post('/api/test/login')
      .send({ userId: 1002, username: 'user2' })
      .expect(200);

    const cookies1 = response1.headers['set-cookie'];
    const cookies2 = response2.headers['set-cookie'];

    // Verify both sessions are independent
    const session1 = await request(app)
      .get('/api/test/session')
      .set('Cookie', cookies1)
      .expect(200);

    const session2 = await request(app)
      .get('/api/test/session')
      .set('Cookie', cookies2)
      .expect(200);

    expect(session1.body.userId).toBe(1001);
    expect(session2.body.userId).toBe(1002);

    // Verify both sessions exist in Redis
    if (!redisSessionClient) return;
    const sessionKeys = await redisSessionClient.keys('sess:*');
    expect(sessionKeys.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Redis Session Store Fallback', () => {
  test('should gracefully handle Redis unavailability', async () => {
    // Pass null to simulate Redis being unavailable
    const store = await createSessionStore(null);

    // Should return undefined, causing express-session to use MemoryStore
    expect(store).toBeUndefined();
  });
});
