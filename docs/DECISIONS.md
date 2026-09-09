# Decisions

What was decided while building this, and what it cost.

The six questions the spec left open (§4) are answered below, after the
decisions that were made while building.

---

## Settled here, with reasons

### PostGIS, not float columns with a bounding box

The spec left this open below ~5,000 trees. PostGIS is in because three things
the app already does need it: radius search (`near` + `radius_m`), duplicate
detection by proximity, and server-side clustering. Hand-rolling great-circle
arithmetic for those, and then an index that can serve them, is more code and
more ways to be subtly wrong than depending on an extension that has done it
correctly since 2001.

The cost is real and is paid in `docs/RUNBOOK.md` §2.1: Railway's stock Postgres
template does not include PostGIS, so the database is deployed from the
`postgis/postgis` image with a volume attached by hand.

### `geom` as a generated column, not a trigger

The spec allowed either. A generated column cannot drift: there is no window
where `latitude` has been updated and `geom` has not, and no way for a
`createMany` or a raw `UPDATE` to bypass it the way it can bypass a trigger the
author forgot to make fire on the right events.

### Route handlers, not a separate Express service

There is no non-web client. One deployable, one set of environment variables,
one healthcheck. Splitting is easy later; the API layer is already isolated from
the React components.

### JWT sessions with the Prisma adapter

The adapter is needed for magic-link verification tokens either way. Database
sessions would add a lookup to every request; a JWT does not. The cost is that a
role change takes effect on the next token refresh, bounded to five minutes in
`src/lib/auth.ts`.

### In-process rate limiting, and no Redis yet

`src/lib/rate-limit.ts` is a fixed-window counter in memory. With
`numReplicas: 1` it is exact. At two replicas the effective limit doubles, which
is the point at which the `redis` service in the spec's E9 earns its keep — the
module's interface is the only thing that changes. Shipping Redis now would be a
service to run, pay for and monitor in exchange for nothing.

### `species` is a table, and the seed list is data

Adding "medlar" next spring is an INSERT through the admin UI, not a migration
and a deploy. Deactivating is the default over deleting, because a species with
trees attached cannot be deleted without either orphaning or silently rewriting
somebody's field observations. Merging duplicates writes a revision on every
affected tree.

### Soft deletes, everywhere

A tree is an observation somebody walked out to record. `deleted_at` is checked
in one place — `buildTreeWhere` — so no read path can forget it.

---

## Answered (§4 of the spec)

All six are settled. Where a decision needed code rather than a flag, the code
is in place and the flag records the choice.

### 1. Login-gated, not public

**`PUBLIC_READ=false`.** Tree locations — including trees in private gardens —
are visible only to signed-in members.

What that changes, in the code rather than in principle:

- `/dashboard`, `/add`, `/my-trees` and `/admin` redirect an anonymous visitor
  to `/signin`.
- `GET /api/trees`, `/api/trees/geojson`, `/api/trees/stats`,
  `/api/trees/:id` and `/api/filters/locations` return 401 without a session.
- The home page stays public but shows only aggregate counts: how many trees,
  how many species, how many places. No individual tree and no coordinate is
  reachable from it.

Coordinate fuzzing (`FUZZ_PUBLIC_COORDINATES`) is kept but has no effect while
the dashboard is gated — there are no signed-out viewers to protect. It is
there for the day someone wants to open the map up with a privacy margin
rather than all at once.

### 2. Nominatim — free, no key, no account

**`GEOCODING_PROVIDER=nominatim`.** OpenStreetMap's own geocoder. It costs
nothing, needs no key, and gives the best address detail for Armenia of the
free options.

Its usage policy caps requests at one per second and forbids bulk use. Two
things already in the code keep this app well inside that:

- The outbound throttle (`GEOCODING_MIN_INTERVAL_MS=1100`) serialises calls.
- The coordinate cache keys on the position rounded to ~11 m, so the bill is
  paid per *place*, not per tree. A surveyor working down one street makes one
  call, not forty.

**Photon** (`GEOCODING_PROVIDER=photon`) is implemented as the second free
option: Komoot's OSM geocoder, also keyless, also free, with no published hard
rate limit. Switch to it with one environment variable if Nominatim starts
refusing requests. Both response shapes are normalised to the same structure
and both are covered by tests.

**Monthly budget: zero.** If usage ever outgrows the free tiers, the paths out
are, in order of cost: self-host Nominatim (an Armenia extract is small), or
set `GEOCODING_PROVIDER=maptiler` with a key and `GEOCODING_MIN_INTERVAL_MS=0`.

### 3. Publish immediately

**`MODERATION_ENABLED=false`.** A submitted tree is `PUBLISHED` and on the map
straight away.

The review queue at `/admin/review` still exists, because it is now for
*flagged* trees rather than for a gate every submission has to pass. A reviewer
can flag something that looks wrong and work through the queue; nothing waits
on them to appear.

### 4. English and Armenian, both at launch

The whole interface is translated, not just the species names. See
`src/i18n/`: two catalogues, with the Armenian one typed against the English
one so a missing key fails the build rather than showing an English word
mid-sentence.

- A language switcher sits in the navigation bar.
- The choice is a cookie, not a URL segment, so a shared dashboard link does
  not force the recipient into the sender's language.
- With no cookie set, the browser's `Accept-Language` decides — someone in
  Armenia gets Armenian on their first visit without touching anything.
- `<html lang>` follows the locale, which is what tells a screen reader to
  pronounce Armenian as Armenian.
- Species names show in both languages everywhere, and the species search
  matches either, regardless of interface language: the name someone reaches
  for is the one they know the tree by.
- Dates and numbers format per locale.

### 5. No existing survey data

Nothing to import. `pnpm import:csv` stays in the repository — it validates a
whole file before writing anything — but it is not on the launch path and
nobody needs to look at it.

### 6. Armenia first

The `region` column stays generic, and the geocoder's answer is canonicalised
onto Armenia's eleven marzer in `src/lib/geocode/armenia.ts`.

This matters more than it sounds. The same province arrives as "Shirak",
"Shirak Province", "Shiraki Marz" or «Շիրակի մարզ» depending on the provider
and the day; left alone, the region filter fills up with four spellings of one
place and the counts are quietly wrong. The table maps all of them onto one
canonical name and carries the Armenian name for the interface — which is why
the region filter can say «Շիրակ» while the stored value, and therefore any
shared URL, stays stable.

A tree recorded outside Armenia keeps whatever region the geocoder gave it.
Armenia first does not mean Armenia only.

What this deliberately does **not** do is model administrative hierarchy
properly. There is no `regions` table, no polygons, no spatial join. A country
whose structure is deeper than country → region → city will not fit, and
making it fit is a schema change worth doing once, when there is a second
country to fit it to.

