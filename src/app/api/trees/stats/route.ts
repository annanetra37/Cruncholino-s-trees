/**
 * T5.7 — the summary bar: how many trees match the current filter, split by
 * condition and by species.
 */
import { json, route } from '@/lib/api';
import { requireReadAccess } from '@/lib/authz';
import { parseTreeFilters } from '@/lib/trees/filters';
import { summariseTrees } from '@/lib/trees/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('trees.stats', async (request) => {
  await requireReadAccess();
  const filters = parseTreeFilters(new URL(request.url).searchParams);
  return json(await summariseTrees(filters));
});
