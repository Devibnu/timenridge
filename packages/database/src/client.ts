import { PrismaClient as PgClient } from '@prisma/client';
import { PrismaClient as SqliteClient } from '@prisma/client-sqlite';
import { jsonExtension } from './jsonExtension';

declare global {
  // eslint-disable-next-line no-var
  var prisma: any | undefined;
}

const isSqlite = process.env.DATABASE_URL?.startsWith('file:');
const PrismaClientCtor = isSqlite ? SqliteClient : PgClient;

const basePrisma = new (PrismaClientCtor as any)({
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
