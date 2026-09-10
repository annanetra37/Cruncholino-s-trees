/**
 * Reverse geocoding for the capture form.
 *
 * The address of a tree is resolved server-side when it is saved, which means a
 * contributor standing under the tree sees only a pair of coordinates and has
 * no way to tell whether the pin is on the right street until the record
 * already exists. This endpoint gives the form the same answer the save path
 * will produce — and because it goes through `resolveAddress`, the lookup it
 * performs is cached and reused by that save rather than duplicated.
 */
import { z } from 'zod';
import { GeocodeStatus } from '@prisma/client';
import { Role } from '@prisma/client';
import { json, route, badRequest } from '@/lib/api';
import { requireRole } from '@/lib/authz';
import { enforceWriteLimit } from '@/lib/rate-limit';
import { resolveAddress } from '@/lib/geocode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const GET = route('geocode.reverse', async (request) => {
  const user = await requireRole(Role.CONTRIBUTOR);

  const url = new URL(request.url);
  const parsed = query.safeParse({
    lat: url.searchParams.get('lat'),
    lng: url.searchParams.get('lng'),
  });
  if (!parsed.success) throw badRequest('Provide a valid lat and lng');

  // The pin moves as a contributor drags it, so this is called far more often
  // than a save. It shares the write budget deliberately: the upstream provider
  // is a free service with its own rate limit, and burning it on previews would
  // cost the saves that matter.
  enforceWriteLimit(request, user.id, 'geocode.reverse');

  const result = await resolveAddress(parsed.data.lat, parsed.data.lng);

  return json({
    status: result.status,
    cached: result.cached,
    address: result.status === GeocodeStatus.OK ? result.address : null,
  });
});
