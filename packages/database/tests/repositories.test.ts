import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceRepository } from '../src/repositories';
import { prisma } from '../src/client';

// Mock the prisma client
vi.mock('../src/client', () => ({
  prisma: {
    device: {
      findUnique: vi.fn(),
    },
  },
}));

describe('DeviceRepository', () => {
  let repository: DeviceRepository;

  beforeEach(() => {
    repository = new DeviceRepository();
    vi.clearAllMocks();
  });

  it('should find a device by ID', async () => {
    const mockDevice = { id: 'dev-1', name: 'Test Device', is_active: true };
    (prisma.device.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevice);

    const result = await repository.findById('dev-1');
    expect(result).toEqual(mockDevice);
    expect(prisma.device.findUnique).toHaveBeenCalledWith({ where: { id: 'dev-1' } });
  });
});
