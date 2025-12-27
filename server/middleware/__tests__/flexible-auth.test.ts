import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { flexibleAuth } from '../flexible-auth';
import { basicAuth } from '../basic-auth';
import { sendError } from '../../utils/api-response';

// Mock dependencies
vi.mock('../basic-auth');
vi.mock('../../utils/api-response');
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('flexibleAuth middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockBasicAuth: Mock;
  let mockSendError: Mock;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    mockBasicAuth = basicAuth as Mock;
    mockSendError = sendError as Mock;

    // Default request mock
    mockReq = {
      headers: {},
      path: '/api/test',
      method: 'GET',
      // @ts-expect-error - Test mock with partial Session object
      session: {},
      // @ts-expect-error - Test mock function without type predicate
      isAuthenticated: vi.fn(() => false),
    };

    // Default response mock
    mockRes = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('HTTP Basic Auth (Priority 1)', () => {
    it('uses Basic Auth when Authorization header present', async () => {
      mockReq.headers = {
        // SECURITY: Test fixture - base64(user:pass), not a real secret
        // SECURITY: Test fixture - base64(user:pass), not a real secret
        authorization: 'Basic dXNlcjpwYXNz',
      };

      // Mock basicAuth to call next() successfully
      mockBasicAuth.mockImplementation((_req, _res, next) => next());

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should set isBasicAuth flag
      expect(mockReq.isBasicAuth).toBe(true);

      // Should delegate to basicAuth middleware
      expect(mockBasicAuth).toHaveBeenCalledWith(mockReq, mockRes, mockNext);

      // Should not call sendError
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('sets isBasicAuth=true before calling basicAuth', async () => {
      mockReq.headers = {
        // SECURITY: Test fixture - base64(user:pass), not a real secret
        authorization: 'Basic dXNlcjpwYXNz',
      };

      // Capture the request state when basicAuth is called
      let capturedIsBasicAuth: boolean | undefined;
      mockBasicAuth.mockImplementation((req, _res, next) => {
        capturedIsBasicAuth = req.isBasicAuth;
        next();
      });

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(capturedIsBasicAuth).toBe(true);
    });

    it('does not try session auth when Basic Auth header present', async () => {
      mockReq.headers = {
        // SECURITY: Test fixture - base64(user:pass), not a real secret
        authorization: 'Basic dXNlcjpwYXNz',
      };
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => true);

      mockBasicAuth.mockImplementation((_req, _res, next) => next());

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should use Basic Auth (priority 1) even though session exists
      expect(mockBasicAuth).toHaveBeenCalled();
      expect(mockReq.isBasicAuth).toBe(true);
    });

    it('handles basicAuth rejection without calling next', async () => {
      mockReq.headers = {
        // SECURITY: Test fixture - invalid base64 credentials, not a real secret
        authorization: 'Basic aW52YWxpZA==',
      };

      // Mock basicAuth to reject (send error, don't call next)
      mockBasicAuth.mockImplementation((req, res) => {
        sendError(res, 'Invalid credentials', 401);
        // Note: basicAuth doesn't call next() when auth fails
      });

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockBasicAuth).toHaveBeenCalled();
      // next() should NOT be called (basicAuth rejected)
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('only checks for "Basic " prefix (case-sensitive)', async () => {
      mockReq.headers = {
        authorization: 'Bearer some-token', // Not Basic Auth
      };
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => false);

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should NOT use Basic Auth (wrong scheme)
      expect(mockBasicAuth).not.toHaveBeenCalled();

      // Should reject (no session either)
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
    });
  });

  describe('Session Auth (Priority 2)', () => {
    it('uses session auth when authenticated', async () => {
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => true);
      // @ts-expect-error - Test mock with partial user object
      mockReq.user = { id: 1, username: 'testuser', role: 'user' };

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should set isBasicAuth=false
      expect(mockReq.isBasicAuth).toBe(false);

      // Should call next() (authenticated)
      expect(mockNext).toHaveBeenCalled();

      // Should not call basicAuth
      expect(mockBasicAuth).not.toHaveBeenCalled();

      // Should not send error
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('prefers Basic Auth over session when both present', async () => {
      mockReq.headers = {
        // SECURITY: Test fixture - base64(user:pass), not a real secret
        authorization: 'Basic dXNlcjpwYXNz',
      };
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => true);
      // @ts-expect-error - Test mock with partial user object
      mockReq.user = { id: 1, username: 'testuser', role: 'user' };

      mockBasicAuth.mockImplementation((_req, _res, next) => next());

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should use Basic Auth (priority 1)
      expect(mockBasicAuth).toHaveBeenCalled();
      expect(mockReq.isBasicAuth).toBe(true);

      // isAuthenticated should not have been checked
      // (we branch on Authorization header first)
    });

    it('sets isBasicAuth=false for session auth', async () => {
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => true);
      // @ts-expect-error - Test mock with partial user object
      mockReq.user = { id: 1, username: 'testuser', role: 'user' };

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.isBasicAuth).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('No Authentication (Priority 3)', () => {
    it('rejects when no auth method available', async () => {
      mockReq.headers = {}; // No Authorization header
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => false); // No session

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should set WWW-Authenticate header
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        'Basic realm="PriceCompare API"'
      );

      // Should send 401 error
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);

      // Should not call next()
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('rejects when session exists but not authenticated', async () => {
      // @ts-expect-error - Test mock with partial session object
      mockReq.session = { id: 'some-session-id' };
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => false);

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('does not set isBasicAuth flag when rejecting', async () => {
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => false);

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Flag should remain undefined (not set)
      expect(mockReq.isBasicAuth).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing headers object', async () => {
      delete mockReq.headers;
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => false);

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should reject gracefully
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
    });

    it('handles empty Authorization header', async () => {
      mockReq.headers = {
        authorization: '', // Empty string
      };
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => false);

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should not use Basic Auth (empty header)
      expect(mockBasicAuth).not.toHaveBeenCalled();

      // Should reject
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
    });

    it('handles malformed Authorization header (no space after Basic)', async () => {
      mockReq.headers = {
        authorization: 'Basicdm9pZA==', // Missing space
      };
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => false);

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should not match "Basic " prefix (requires space)
      expect(mockBasicAuth).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
    });

    it('handles case-sensitive Basic scheme', async () => {
      mockReq.headers = {
        authorization: 'basic dXNlcjpwYXNz', // lowercase "basic"
      };
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => false);

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Should not match (case-sensitive)
      expect(mockBasicAuth).not.toHaveBeenCalled();
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
    });

    it('preserves user object from basicAuth', async () => {
      mockReq.headers = {
        // SECURITY: Test fixture - base64(user:pass), not a real secret
        authorization: 'Basic dXNlcjpwYXNz',
      };

      const mockUser = { id: 2, username: 'basicuser', role: 'admin' };

      // Mock basicAuth to set req.user
      mockBasicAuth.mockImplementation((req, _res, next) => {
        req.user = mockUser;
        next();
      });

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // User should be preserved
      expect(mockReq.user).toEqual(mockUser);
    });
  });

  describe('Security Considerations', () => {
    it('does not expose authentication method in error', async () => {
      // @ts-expect-error - Test mock function
      mockReq.isAuthenticated = vi.fn(() => false);

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);

      // Error message should be generic (don't leak auth methods)
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);

      // Should include WWW-Authenticate header (standard)
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        'Basic realm="PriceCompare API"'
      );
    });

    it('sets isBasicAuth flag for CSRF middleware to check', async () => {
      // Test that flag is correctly set for both auth types

      // Basic Auth
      mockReq.headers = { authorization: 'Basic dXNlcjpwYXNz' };
      mockBasicAuth.mockImplementation((_req, _res, next) => next());

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.isBasicAuth).toBe(true); // CSRF exempt

      // Session Auth
      vi.clearAllMocks();
      mockReq = {
        headers: {},
        // @ts-expect-error - Test mock function
        isAuthenticated: vi.fn(() => true),
        // @ts-expect-error - Test mock with partial user object
        user: { id: 1 },
        path: '/api/test',
        method: 'GET',
      };

      await flexibleAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.isBasicAuth).toBe(false); // CSRF required
    });
  });
});
