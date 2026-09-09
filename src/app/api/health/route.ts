/**
 * T10.6 — the healthcheck Railway polls.
 *
 * It checks the database, because an app that cannot reach Postgres is not
 * healthy no matter how cheerfully it serves HTML. It deliberately does *not*
 * check the geocoding provider: that dependency is allowed to be down, and
 * failing the healthcheck for it would take the whole service out of rotation
 * over an optional feature.
 */
import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('health', async () => {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    return json(
      {
        status: 'unhealthy',
        database: 'unreachable',
        error: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 503 },
    );
  }

  return json({
    status: 'ok',
    database: 'ok',
    latencyMs: Date.now() - startedAt,
    uptimeSeconds: Math.round(process.uptime()),
  });
});
