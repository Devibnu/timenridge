import { Request, Response, NextFunction } from 'express';
import { hasPermission, PermissionType } from '@timebridge/security';
import { UserRole } from '@timebridge/database';

export function authorize(permission: PermissionType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: User not found in request' });
      return;
    }

    if (!hasPermission(req.user.role as UserRole, permission)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return;
    }

    next();
  };
}
