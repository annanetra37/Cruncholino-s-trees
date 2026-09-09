# Decisions

What was decided while building this, what it cost, and what is still open.

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

## Open questions (from §4 of the spec)

These need a person, not a default. Where the code has to do *something*, it
does the reversible thing and puts the switch in an environment variable.

### 1. Public dashboard, or login-gated?

**Currently:** `PUBLIC_READ=true`, `FUZZ_PUBLIC_COORDINATES=false`.

With public read on, the coordinates of trees on private land are public data.
Three positions are supported without a code change:

| Setting | Effect |
|---|---|
| `PUBLIC_READ=true` | Anyone can browse the map at full precision |
| `PUBLIC_READ=true` + `FUZZ_PUBLIC_COORDINATES=true` | Signed-out viewers see coordinates rounded to ~110 m; signed-in users see the real position |
| `PUBLIC_READ=false` | The dashboard and the API require an account |

Fuzzing is applied at serialisation, so the database keeps full precision and
the decision stays reversible. It does *not* protect against a determined
scraper correlating many fuzzed points — if the exact locations are genuinely
sensitive, gate the dashboard.

### 2. Geocoding provider and budget

**Currently:** Nominatim, throttled to one request per second.

Nominatim's usage policy forbids heavy production use. `GEOCODING_PROVIDER`
switches to MapTiler with a key; both response shapes are normalised in
`src/lib/geocode/normalise.ts` and covered by tests. The coordinate cache means
the bill scales with distinct ~11 m locations, not with trees, so an orchard
survey costs far less than the tree count suggests. Somebody still has to pick a
provider and set a monthly cap.

### 3. Immediate publish, or review first?

**Currently:** `MODERATION_ENABLED=false` — submissions publish immediately.

Setting it to `true` lands new trees in `DRAFT`, where the review queue at
`/admin/review` picks them up. Contributors always see their own drafts under
"My trees". Worth turning on only if there is somebody to work the queue;
otherwise it is a way to quietly lose contributions.

### 4. Armenian UI at launch?

**Currently:** English interface, with Armenian species names shown alongside
English everywhere species appear — the picker, the filters, the list and the
detail panel. Species search matches both.

That covers the vocabulary a contributor in the field actually needs. Full
interface localisation is not done, and the strings are not extracted for it. If
Armenian UI is required at launch, that is a real piece of work and needs to be
scheduled, not assumed.

### 5. Existing survey data to import?

`pnpm import:csv <file>` validates the whole file and reports every problem
before writing anything, because a half-imported survey is worse than a rejected
one. Column mapping is at the top of `scripts/import-csv.ts` and will need
adjusting to whatever the real files look like.

### 6. One country, or global?

**Currently:** one generic `region` column, populated from whatever the geocoder
calls the first administrative level (`state` in Nominatim, which is what
Armenia's marzer come back as).

This is deliberately the flat, non-committal model. It will not represent a
country whose administrative hierarchy is deeper than country → region → city,
and it cannot express that a marz is not a state. Going global properly means a
`regions` table with polygons and a spatial join, which is a schema change and a
migration — worth doing once, when it is actually needed, rather than guessing
now.
