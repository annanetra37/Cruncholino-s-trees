# Cruncholino Trees

Map the fruit and nut trees around you. Two flows:

- **Capture** — someone standing in front of a tree records it: coordinates,
  resolved address, species, age, condition, fruit quality, photos, notes.
- **Dashboard** — every recorded tree on a map, filterable by species, age,
  condition, fruit quality and location.

Next.js (App Router) · PostgreSQL 16 + PostGIS · Prisma · MapLibre GL ·
Auth.js · Cloudflare R2 · deployed on Railway.

---

## Getting started

```sh
pnpm install
cp .env.example .env.local        # the defaults work for local development
pnpm db:up                        # PostGIS 16 in Docker
pnpm db:migrate                   # apply migrations
pnpm db:seed                      # 30 species, 30 trees, two demo accounts
pnpm dev
```

Open http://localhost:3000. With `AUTH_DEV_LOGIN=true` you can sign in as
`admin@example.org` or `contributor@example.org` by typing the address — no SMTP
server needed.

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm test` | Unit tests, plus integration tests when a database is reachable |
| `pnpm test:e2e` | Playwright, both critical paths |
| `pnpm lint` / `pnpm typecheck` | What CI runs |
| `pnpm db:reset` | Drop, migrate and reseed |
| `SEED_TREES=50000 pnpm db:seed` | The load-test dataset |
| `pnpm exec tsx scripts/load-check.ts` | Times the dashboard queries and prints the plan |
| `pnpm import:csv <file>` | Bulk import, dry run by default |

---

## How it fits together

```
src/
  env.ts                 every environment variable, validated at boot
  middleware.ts          security headers (no auth — see below)
  app/
    api/                 route handlers: trees, species, filters, export, health
    dashboard/           the map
    add/                 the capture flow
    admin/               review queue, species management
  lib/
    trees/               filters → SQL, queries, duplicate detection, revisions
    geocode/             reverse geocoding, provider adapters, coordinate cache
    policy.ts            authorisation rules, as pure functions
    authz.ts             the same rules, bound to a session
    storage/r2.ts        presigned uploads
    client/              browser-only: offline queue, EXIF, image resize
prisma/                  schema, migrations, seed
scripts/                 cron jobs, CSV import, load check, backup
docs/RUNBOOK.md          deploy, roll back, restore, rotate keys
```

### PostGIS through Prisma

Prisma has no geography type. The `trees.geom` column is declared as
`Unsupported("geography(Point, 4326)")` so Prisma knows it exists and reports no
drift, and it is a **generated column** derived from `latitude`/`longitude`:

```sql
ALTER TABLE "trees"
  ADD COLUMN "geom" geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
  ) STORED;
```

The application only ever writes plain coordinates, so the two representations
cannot disagree. Spatial predicates are raw SQL in `src/lib/trees/query.ts`,
built with `Prisma.sql` so every value stays parameterised.

Plain `latitude`/`longitude` columns are kept alongside `geom` deliberately:
CSV export, debugging and ordinary Prisma reads are all simpler for it.

### Filtering happens in Postgres

Every list endpoint filters, sorts and paginates server-side, and the map loads
by viewport bounding box. "Fetch all trees, filter in React" works at 200 trees
and dies at 20,000.

`src/lib/trees/filters.ts` parses the query string once; the list endpoint, the
GeoJSON endpoint, the stats bar and the export all use the result, so "the same
filters" is a property of the code rather than a promise in a document.

### A failed geocode never blocks a submission

Coordinates are the source of truth; the address is a convenience. If the
geocoding provider times out, the tree is still created with
`geocode_status = FAILED`, and an hourly job retries it. Lookups are cached by
coordinate rounded to four decimal places (~11 m), so a street full of trees
costs one provider call rather than forty.

### Authorisation

`src/lib/policy.ts` holds the rules as pure functions; `src/lib/authz.ts` binds
them to a session. Middleware sets security headers only — it runs on the edge
runtime, where Prisma cannot, and a second weaker copy of the rules there would
be worse than none.

- `CONTRIBUTOR` — creates trees, edits and deletes its own
- `REVIEWER` — edits any tree, changes status, exports
- `ADMIN` — everything, plus species management

### Field conditions shaped the capture flow

- GPS first, with the accuracy radius drawn honestly; then EXIF from an uploaded
  photo; then a manual pin. The flow completes with location permission denied.
- Nothing is ever lost: a failed submit retries, then falls back to an IndexedDB
  queue that syncs when the connection returns, with a visible pending count.
  Each queued entry carries an idempotency key, so a retry whose response was
  lost cannot create the tree twice.
- 48 px tap targets, no keyboard input required beyond optional notes.

### Two things the spec conflated, kept apart

`condition` (the tree) and `fruit_quality` (what it bears) are separate fields.
A healthy tree can bear bad fruit and a half-dead one can bear well.

Every enum has `UNKNOWN`. Field data is incomplete data, and forcing a guess
produces confident wrong answers rather than honest gaps.

---

## Deployment

See **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — services layout, PostGIS on Railway
(the stock Postgres template does not have it), variables, migrations on deploy,
cron jobs, backups and the restore drill, domain and TLS, key rotation.

Two things that catch people out:

- The app binds to `0.0.0.0` and `process.env.PORT`. Hardcoding `3000` or
  `127.0.0.1` is the most common Railway deploy failure.
- Behind Cloudflare, SSL mode must be **Full (strict)**. "Flexible" causes a
  redirect loop.

---

## Decisions still open

Tracked in [docs/DECISIONS.md](docs/DECISIONS.md): public versus login-gated
dashboard, geocoding provider and budget, moderation, Armenian-language UI,
existing survey data to import, and how far the region model needs to generalise
beyond Armenia's marz structure.
