/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Router, Request, Response } from 'express';
import { AttendanceNormalizer } from '@timebridge/attendance-engine';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { Permissions } from '@timebridge/security';
import { UserRole } from '@timebridge/database';

const router = Router();

// Only SUPER_ADMIN and INTEGRATION_ADMIN can trigger normalization manually
router.post(
  '/normalize',
  authenticate,
  authorize(Permissions.ATTENDANCE_PROCESS),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const normalizer = new AttendanceNormalizer();
      const results = await normalizer.normalizePending();

      res.status(200).json({
        success: true,
        data: {
          processed_count: results.length,
          results,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An unexpected error occurred during normalization',
        },
      });
    }
  },
);

export default router;
