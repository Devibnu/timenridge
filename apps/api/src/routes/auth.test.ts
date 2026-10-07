import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { prisma } from '@timebridge/database';
import { verifyPassword } from '@timebridge/security';
import { authorize } from '../middleware/authorize';
import authRoutes from './auth';

// Setup basic app for testing
const app = express();
app.set('trust proxy', 1); // 1 = trust first proxy
app.use(express.json());
app.use('/api/auth', authRoutes);

// Mock route for testing RBAC
app.post(
  '/api/test-rbac',
  // Inject mock user to req
  (req: Request, res: Response, next) => {
    if (req.headers.authorization?.startsWith('Bearer mock-')) {
      req.user = { userId: 'user-1', role: req.headers.authorization.replace('Bearer mock-', '') };
    }
    next();
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authorize('devices.create' as any),
  (req, res) => res.status(200).json({ success: true }),
);

// Mock external dependencies
vi.mock('@timebridge/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@timebridge/database')>();
  return {
    ...actual,
    UserStatus: { ACTIVE: 'ACTIVE', DISABLED: 'DISABLED' },
    UserRole: { OPERATOR: 'OPERATOR', SUPER_ADMIN: 'SUPER_ADMIN', AUDITOR: 'AUDITOR' },
    AuditAction: { LOGIN_SUCCESS: 'LOGIN_SUCCESS', LOGIN_FAILED: 'LOGIN_FAILED' },
    prisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      securityAuditLog: {
        create: vi.fn(),
      },
    },
  };
});

vi.mock('@timebridge/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@timebridge/security')>();
  return {
    ...actual,
    verifyPassword: vi.fn(),
    signToken: vi.fn().mockReturnValue('mock-jwt-token'),
    verifyToken: vi.fn((token) => {
      if (token === 'expired-token') throw new Error('Token expired');
      if (token === 'invalid-token') throw new Error('Invalid token');
      return { userId: 'user-1', role: 'OPERATOR' };
    }),
  };
});

describe('Auth Routes (P2 Security Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validUser = {
    id: 'user-1',
    email: 'test@test.com',
    password_hash: 'hashed_pass',
    status: 'ACTIVE',
    role: 'OPERATOR',
  };

  it('P2-AUTH-001: Valid login returns JWT and hides password', async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(validUser);
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('mock-jwt-token');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.password_hash).toBeUndefined(); // P2-AUTH-012

    expect(prisma.securityAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'LOGIN_SUCCESS', user_id: 'user-1' }),
      }),
    );
  });

  it('P2-AUTH-002: Invalid password returns generic error', async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(validUser);
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@test.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('P2-AUTH-003: Disabled user cannot login', async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...validUser,
      status: 'DISABLED',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Account is disabled');
  });

  it('P2-AUTH-004: Expired token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Unauthorized: Token expired or invalid');
  });

  it('P2-AUTH-005: Missing authentication', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('P2-AUTH-006: Unauthorized role', async () => {
    const res = await request(app)
      .post('/api/test-rbac')
      .set('Authorization', 'Bearer mock-NON_EXISTENT_ROLE');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');
  });

  it('P2-AUTH-007: Auditor mutation attempt', async () => {
    // AUDITOR testing against devices.create (mutation)
    const res = await request(app)
      .post('/api/test-rbac')
      .set('Authorization', 'Bearer mock-AUDITOR');

    expect(res.status).toBe(403); // Denied
  });

  it('P2-AUTH-008: Operator restricted operation', async () => {
    // OPERATOR testing against devices.create (mutation)
    const res = await request(app)
      .post('/api/test-rbac')
      .set('Authorization', 'Bearer mock-OPERATOR');

    expect(res.status).toBe(403); // Denied
  });

  it('P2-AUTH-009: Login rate limit', async () => {
    // express-rate-limit is set to 5 per minute.
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(validUser);
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    let res;
    for (let i = 0; i < 6; i++) {
      res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.100') // Use specific IP for this test
        .send({
          email: 'limit@test.com',
          password: 'password123',
        });
    }

    // The 6th request should be rate-limited
    expect(res?.status).toBe(429);
  });

  it('P2-AUTH-010: Secret exposure check', async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(validUser);
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '192.168.1.101')
      .send({
        email: 'test@test.com',
        password: 'password123',
      });

    const responseStr = JSON.stringify(res.body);
    expect(responseStr).not.toContain('password');
    expect(responseStr).not.toContain('hashed_pass');
    expect(responseStr).not.toContain('secret');
  });

  it('P2-AUTH-011: Password not logged in audit', async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(validUser);
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await request(app).post('/api/auth/login').set('X-Forwarded-For', '192.168.1.102').send({
      email: 'test@test.com',
      password: 'SUPER_SECRET_PASSWORD',
    });

    // Check last call to create audit log
    const mockCallArgs = (
      prisma.securityAuditLog.create as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.at(-1)![0];
    const logStr = JSON.stringify(mockCallArgs);
    expect(logStr).not.toContain('SUPER_SECRET_PASSWORD');
    expect(logStr).not.toContain('hashed_pass');
  });

  it('P2-AUTH-012: Password hash not exposed', async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(validUser);
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '192.168.1.103')
      .send({
        email: 'test@test.com',
        password: 'password123',
      });

    expect(res.body.user).toBeDefined();
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });
});
