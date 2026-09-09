import { PrismaClient } from '@prisma/client';
import { env } from '@/env';

/**
 * Next's dev server re-evaluates modules on every edit; without this cache each
 * reload would open a fresh pool and exhaust Postgres' connection limit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.LOG_LEVEL === 'debug' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
