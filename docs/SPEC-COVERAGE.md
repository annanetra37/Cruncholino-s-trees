# Spec coverage

Task by task, against the brief. Anything not delivered says so plainly and says
why.

## E1 — Project setup

| Task | Status | Where |
|---|---|---|
| T1.1 Repository scaffold | Done | Next 15 + TS strict (`noUncheckedIndexedAccess` on), ESLint, Prettier, `@/*` aliases |
| T1.2 Environment contract | Done | `src/env.ts` — Zod, fails at boot naming the variable |
| T1.3 Local dev database | Done | `docker-compose.yml` (PostGIS 16-3.4), `pnpm db:seed` |

Husky's pre-commit hook (`.husky/pre-commit` → `lint-staged`) is committed; it
installs itself on `pnpm install` via the `prepare` script.

## E2 — Data model

| Task | Status | Notes |
|---|---|---|
| T2.1 Core schema | Done | `prisma/schema.prisma`. `species` is a table; `condition` and `fruit_quality` are separate; every enum has `UNKNOWN`; `latitude`/`longitude` kept alongside `geom` |
| T2.2 PostGIS via Prisma | Done | `Unsupported(...)` + generated column. Verified: `ST_DWithin` returns correct results in `tests/integration/spatial.test.ts` |
| T2.3 Indexes | Done | GiST on `geom`, B-trees on every filter column, a composite for the dashboard's common combination, partial indexes for live rows, trigram GIN for free-text. Verified at 50k rows: bitmap index scan on `trees_geom_idx`, 24 ms |
| T2.4 Species seed | Done | 30 species, English + Armenian |
| T2.5 Migration workflow | Done | `prisma migrate deploy` as Railway's pre-deploy command, never at build time |

Extra: `CHECK` constraints on the coordinate ranges, because a swapped lat/lng
pair is the classic mapping bug.

## E3 — Backend API

| Task | Status | Notes |
|---|---|---|
| T3.1 `POST /api/trees` | Done | 422 with per-field errors; returns the created tree with its resolved address |
| T3.2 `GET /api/trees` | Done | Every filter in the spec, plus `country_code` and `created_by` |
| T3.3 `GET /api/trees/geojson` | Done | Falls back to server-side clusters above `MAX_GEOJSON_FEATURES` |
| T3.4 `GET`/`PATCH`/`DELETE /api/trees/:id` | Done | Soft delete; every PATCH writes a revision; moving the pin re-geocodes |
| T3.5 `GET /api/species` | Done | Cached |
| T3.6 `GET /api/filters/locations` | Done | Cities, regions, countries with counts, cached 5 minutes |
| T3.7 Reverse geocoding | Done | Server-only, 4dp cache, 3 s timeout, one retry, throttled. **Verified**: with the geocoder unreachable, creation still succeeds with `geocode_status = FAILED` |
| T3.8 Backfill job | Done | `scripts/geocode-backfill.ts`, hourly cron |
| T3.9 Duplicate detection | Done | `ST_DWithin`, soft warning with the nearby trees, never a block |
| T3.10 Export | Done | CSV and GeoJSON, streamed with keyset pagination, REVIEWER+ |
| T3.11 Rate limiting | Done | Per-user and per-IP on writes and geocode-triggering endpoints |

## E4 — Capture flow

| Task | Status | Notes |
|---|---|---|
| T4.1 Location acquisition | Done | GPS with accuracy radius, EXIF fallback, manual pin. `location_source` and `accuracy_m` stored. E2E-tested with permission denied |
| T4.2 Add-tree form | Done | Searchable species picker (EN + HY), 48 px targets, no keyboard needed |
| T4.3 Address confirmation | Done | Correcting the city or region sets `geocode_status = MANUAL` |
| T4.4 Optimistic submit + recovery | Done | Retry, then the offline queue; a draft survives a reload |
| T4.5 PWA + offline queue | Done | Manifest, service worker, IndexedDB queue, visible pending count, idempotency keys |
| T4.6 "My trees" | Done | Own submissions including drafts, editable |

## E5 — Dashboard

All of T5.1–T5.7 done: viewport-scoped map with debounced refetch, marker
styling on three independent channels (colour/shape/size) with an always-visible
legend, clustering, URL-backed filters with a live count, detail panel with
history, list view, summary stats bar.

## E6 — Photos

| Task | Status | Notes |
|---|---|---|
| T6.1 Direct-to-R2 upload | Done | Presigned PUT; bytes never touch the app server |
| T6.2 Client resize + EXIF | Done | GPS and timestamp read first, then downscaled to 1600 px, which drops the rest of the EXIF |
| T6.3 Thumbnails | **Not done** | The popup serves the 1600 px upload. Needs Cloudflare Images or an R2 Worker transform; deferred until photo volume makes it matter |
| T6.4 Orphan cleanup | Done | `scripts/orphan-cleanup.ts`, 24 h grace period, `DRY_RUN=1` supported |

## E7 — Auth and roles

T7.1 (magic link, no passwords), T7.2 (role enforcement — a contributor cannot
PATCH another user's tree; unit-tested and verified against the running app) and
T7.3 (public-read mode with optional coordinate fuzzing) are all done. The T7.3
decision itself is open — see `docs/DECISIONS.md`.

## E8 — Admin and data quality

| Task | Status | Notes |
|---|---|---|
| T8.1 Species management | Done | Add, rename, deactivate, merge — merges write a revision per affected tree |
| T8.2 Flag and review queue | Done | `/admin/review` |
| T8.3 Bulk edit | **Not done** | Reassigning species in bulk is covered by the merge tool; a general filtered bulk edit is not built |
| T8.4 CSV import | Done | Dry run by default; refuses a file with problems unless `--force` |
| T8.5 Revision history | Done | Shown in the tree detail panel to the contributor and to reviewers |

## E9 — Railway

All of T9.1–T9.10 are configured and documented (`railway.json`, `Dockerfile`,
`docs/RUNBOOK.md`). The image binds `0.0.0.0:$PORT`, migrations run as the
pre-deploy command, `DATABASE_URL` is a reference variable over the private
network, and the runbook covers staging/production, domain and TLS, backups with
a restore drill, cron services and key rotation.

**Not verified:** the Docker image has not been built. The sandbox this was
written in cannot pull from Docker Hub. What *was* verified is the part the
Dockerfile's runtime stage depends on: `.next/standalone` assembled by hand and
run with `node server.js` serves pages, static assets, the PWA files and a
healthy `/api/health` against a real database.

## E10 — Testing and hardening

| Task | Status | Notes |
|---|---|---|
| T10.1 Unit tests | Done | 43 tests: filter parsing, SQL building, geocode normalisation, cache keys, authorisation, rate limiting, revision diffs |
| T10.2 Integration tests | Done | 10 tests against real Postgres + PostGIS |
| T10.3 E2E | Done | Playwright, both critical paths, mobile and desktop projects |
| T10.4 Error tracking | **Not done** | No Sentry. Structured logs carry request ids; wiring Sentry is a dependency and a DSN, and is the first thing to add before real traffic |
| T10.5 Structured logging | Done | One JSON line per request, request id threaded through and returned in `x-request-id` |
| T10.6 `/api/health` | Done | Checks the database; wired to Railway's healthcheck |
| T10.7 Load check | Done | 50k rows: viewport load 24 ms, slowest query 93 ms against a 500 ms budget, index scan confirmed |
| T10.8 Security pass | Done | Zod on every input, parameterised SQL, no secrets in the client bundle, CSP and security headers, dependency audit in CI |
