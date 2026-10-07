import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

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
    callback: (
      tx: Omit<
        PrismaClient,
        '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
      >,
    ) => Promise<T>,
  ): Promise<T> {
    return await prisma.$transaction(async (tx) => {
      return await callback(tx);
    });
  }
}
