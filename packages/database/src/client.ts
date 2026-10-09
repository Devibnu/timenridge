import { PrismaClient } from '@prisma/client';
import { jsonExtension } from './jsonExtension';

declare global {
  // eslint-disable-next-line no-var
  var prisma: any | undefined;
}

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const prisma = global.prisma || basePrisma.$extends(jsonExtension);

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * TransactionManager helper
 */
export class TransactionManager {
  /**
   * Executes a callback within a Prisma transaction.
   * @param callback Function to execute with the transaction client.
   */
  static async execute<T>(
    callback: (tx: any) => Promise<T>,
  ): Promise<T> {
    return await prisma.$transaction(async (tx: any) => {
      return await callback(tx);
    });
  }
}
