/**
 * Address search for the capture and edit forms.
 *
 * The capture flow assumes a contributor standing under the tree with a GPS
 * fix. That is the common case, not the only one: orchards get mapped from a
 * list, and records get corrected later from a desk. Both need a way to say
 * where a tree is in words.
 *
 * Coordinates typed directly are handled in the browser — no lookup is needed
 * to move a pin to a point that is already a point — so this endpoint only ever
 * sees free text.
 */
import { Role } from '@prisma/client';
import { json, route, badRequest } from '@/lib/api';
import { requireRole } from '@/lib/authz';
import { enforceWriteLimit } from '@/lib/rate-limit';
import { searchPlaces } from '@/lib/geocode/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_RESULTS = 5;

export const GET = route('geocode.search', async (request) => {
  const user = await requireRole(Role.CONTRIBUTOR);

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 3) throw badRequest('Type at least three characters to search');
  if (query.length > 200) throw badRequest('That search is too long');

  // Shares the write budget with the address preview and with saving a tree:
  // the upstream geocoder is a free service with one global rate limit, and
  // spending it on searches would cost the saves that matter.
  enforceWriteLimit(request, user.id, 'geocode.search');

  const matches = await searchPlaces(query, MAX_RESULTS);

  return json({
    query,
    results: matches.map((match) => ({
      label: match.label,
      latitude: match.latitude,
      longitude: match.longitude,
      city: match.address.city,
      region: match.address.region,
    })),
  });
});
