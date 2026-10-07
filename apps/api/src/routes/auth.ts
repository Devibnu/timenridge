import { Router, Request, Response } from 'express';
import { prisma, AuditAction, UserStatus } from '@timebridge/database';
import { verifyPassword, signToken } from '@timebridge/security';
import { loginRateLimiter } from '../middleware/rate-limiter';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// A generic error message to prevent account enumeration
const GENERIC_LOGIN_ERROR = 'Invalid email or password';

router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      await logSecurityAudit(null, AuditAction.LOGIN_FAILED, email, { reason: 'user_not_found' });
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    if (user.status === UserStatus.DISABLED) {
      await logSecurityAudit(user.id, AuditAction.LOGIN_FAILED, email, {
        reason: 'account_disabled',
      });
      return res.status(401).json({ error: 'Account is disabled' });
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      await logSecurityAudit(user.id, AuditAction.LOGIN_FAILED, email, {
        reason: 'invalid_password',
      });
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    // Success
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    await logSecurityAudit(user.id, AuditAction.LOGIN_SUCCESS, email);

    const token = signToken({ userId: user.id, role: user.role });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  const user = req.user;
  if (user) {
    await logSecurityAudit(user.userId, AuditAction.LOGOUT, user.userId);
  }
  return res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const payload = req.user;

  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
        last_login_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Fetch me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper for audit logging
async function logSecurityAudit(
  userId: string | null,
  action: AuditAction,
  target: string | null = null,
  metadata: unknown = null,
) {
  try {
    await prisma.securityAuditLog.create({
      data: {
        user_id: userId,
        action,
        target,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  } catch (error) {
    console.error('Failed to write security audit log:', error);
  }
}

export default router;
