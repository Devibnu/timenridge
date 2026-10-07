import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '@timebridge/security';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
    return;
  }
}
