/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import eventsRouter from './events';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AttendanceNormalizer } from '@timebridge/attendance-engine';

vi.mock('../middleware/authenticate', () => ({
  authenticate: vi.fn((req, res, next) => next()),
}));

vi.mock('../middleware/authorize', () => ({
  authorize: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

vi.mock('@timebridge/attendance-engine', () => {
  return {
    AttendanceNormalizer: vi.fn().mockImplementation(() => ({
      normalizePending: vi.fn(),
    })),
  };
});

const app = express();
app.use(express.json());
app.use('/api/events', eventsRouter);

describe('Events API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('P6-API-001: should trigger normalization successfully', async () => {
    const mockNormalizePending = vi.fn().mockResolvedValue([
      { raw_event_id: '1', status: 'RECEIVED' },
      { raw_event_id: '2', status: 'DUPLICATE' },
    ]);

    (AttendanceNormalizer as any).mockImplementation(() => ({
      normalizePending: mockNormalizePending,
    }));

    const response = await request(app).post('/api/events/normalize');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.processed_count).toBe(2);
    expect(response.body.data.results).toHaveLength(2);
    expect(mockNormalizePending).toHaveBeenCalledTimes(1);
  });

  it('P6-API-002: should handle errors during normalization', async () => {
    const mockNormalizePending = vi.fn().mockRejectedValue(new Error('DB Error'));

    (AttendanceNormalizer as any).mockImplementation(() => ({
      normalizePending: mockNormalizePending,
    }));

    const response = await request(app).post('/api/events/normalize');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('DB Error');
  });
});
