import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('P15 Production Readiness Tests', () => {
  it('P15-ENV-001: .env.example contains essential environment contract variables', () => {
    const envExamplePath = path.resolve(__dirname, '../../../.env.example');
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');

    // Expected keys
    const expectedKeys = [
      'DATABASE_URL',
      'REDIS_HOST',
      'REDIS_PORT',
      'REDIS_PASSWORD',
      'JWT_SECRET',
      'VITE_API_URL',
      'SFTP_HOST',
      'SAP_HCI_URL',
      'LOG_LEVEL',
    ];

    expectedKeys.forEach((key) => {
      expect(envExampleContent).toContain(`${key}=`);
    });
  });

  it('P15-SEC-001: JWT_SECRET does not fallback to unsafe default in source', () => {
    const jwtSrcPath = path.resolve(__dirname, '../../security/src/auth/jwt.ts');
    const jwtSrcContent = fs.readFileSync(jwtSrcPath, 'utf-8');

    // Should NOT contain the old fallback
    // eslint-disable-next-line quotes
    expect(jwtSrcContent).not.toContain("process.env.JWT_SECRET || 'dev-secret-key");

    // Should explicitly throw if undefined
    expect(jwtSrcContent).toContain('throw new Error');
  });

  it('P15-OPS-003: Graceful shutdown handlers are registered in API entrypoint', () => {
    const apiIndexPath = path.resolve(__dirname, '../../../apps/api/src/index.ts');
    if (fs.existsSync(apiIndexPath)) {
      const apiIndexContent = fs.readFileSync(apiIndexPath, 'utf-8');

      // eslint-disable-next-line quotes
      expect(apiIndexContent).toContain("process.on('SIGTERM'");
      // eslint-disable-next-line quotes
      expect(apiIndexContent).toContain("process.on('SIGINT'");
      expect(apiIndexContent).toContain('server.close');
      expect(apiIndexContent).toContain('prisma.$disconnect');
    }
  });

  it('P15-DB-001: Deployment Runbook documents strictly migrate deploy', () => {
    const runbookPath = path.resolve(__dirname, '../../../docs/P15_DEPLOYMENT_RUNBOOK.md');
    const runbookContent = fs.readFileSync(runbookPath, 'utf-8');

    expect(runbookContent).toContain('npx prisma migrate deploy');
    expect(runbookContent).toContain('Never squash or reset');
  });
});
