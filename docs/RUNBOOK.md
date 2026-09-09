# Deployment runbook

Everything an on-call person needs for this service, on one page: how to deploy,
how to roll back, how to reach the database, how to read logs, and how to rotate
a key.

---

## 1. What is deployed

Railway project, one per environment (`staging` and `production`), each with:

| Service | What it is | Notes |
|---|---|---|
| `web` | The Next.js app | Built from `Dockerfile`, configured by `railway.json` |
| `db` | PostgreSQL 16 + PostGIS | `postgis/postgis:16-3.4`, persistent volume at `/var/lib/postgresql/data` |
| `cron-geocode` | `pnpm job:geocode-backfill` | Hourly. Retries failed address lookups |
| `cron-orphans` | `pnpm job:orphan-cleanup` | Daily. Deletes unreferenced R2 objects |
| `cron-backup` | `scripts/backup-to-r2.sh` | Daily. `pg_dump` to R2, on top of Railway's own backups |
| `redis` | *not deployed* | Only needed when a second `web` replica arrives — see §9 |

---

## 2. First-time setup

### 2.1 The database (T9.2)

Railway's stock Postgres template **does not include PostGIS**, and this app
does not work without it. Deploy the database from the Docker image instead:

1. **New → Empty Service → Deploy from Docker image**: `postgis/postgis:16-3.4`
2. Variables:
   ```
   POSTGRES_USER=trees
   POSTGRES_PASSWORD=<generate a strong one>
   POSTGRES_DB=trees
   PGDATA=/var/lib/postgresql/data/pgdata
   ```
   `PGDATA` pointing at a subdirectory matters: the image refuses to initialise
   into a volume root that already contains `lost+found`.
3. Attach a **volume** mounted at `/var/lib/postgresql/data`. Without it the
   database is wiped on every redeploy.
4. Confirm the extension is available:
   ```sh
   railway run --service db psql -c "SELECT PostGIS_Version();"
   ```
   The first migration runs `CREATE EXTENSION IF NOT EXISTS postgis`, so nothing
   else is needed by hand.

### 2.2 The web service

1. **New → GitHub Repo**, pick this repository. `railway.json` is picked up
   automatically: Dockerfile build, `/api/health` healthcheck, and
   `prisma migrate deploy` as the pre-deploy command.
2. Set the variables from §3.
3. Deploy. The healthcheck must go green before traffic is switched over.

### 2.3 Cron services (T9.9)

For each job: **New → Empty Service**, same repo, then set the start command and
a cron schedule under Settings → Cron Schedule. They share the `web` service's
variables (`DATABASE_URL`, `GEOCODING_*`, `R2_*`).

| Service | Start command | Schedule |
|---|---|---|
| `cron-geocode` | `pnpm job:geocode-backfill` | `0 * * * *` |
| `cron-orphans` | `pnpm job:orphan-cleanup` | `30 3 * * *` |
| `cron-backup` | `bash scripts/backup-to-r2.sh` | `0 2 * * *` |

Cron services must exit when finished. All three do.

---

## 3. Variables (T9.4)

`DATABASE_URL` is a **reference variable**, never a pasted literal:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Railway resolves it to the private-network host (`*.railway.internal`), which
keeps database traffic off the public internet and means rotating the password
does not require editing the web service. If you paste the literal, the first
password rotation takes the site down and nobody remembers why.

The full list, and what each one does, is in `.env.example`. The ones that must
be set in production:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://<your domain>` |
| `EMAIL_SERVER` | SMTP URL for magic links |
| `EMAIL_FROM` | The From address |
| `GEOCODING_PROVIDER` | `nominatim` (free; `photon` is the keyless fallback — see §8) |
| `GEOCODING_MIN_INTERVAL_MS` | `1100` for Nominatim; `0` only for a paid provider |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Tile style URL |
| `NEXT_PUBLIC_MAP_TILES_KEY` | Tile key — **public by design**, it ships in the browser bundle. Restrict it by HTTP referrer in the provider's console |
| `R2_*` | Photo storage, if photos are enabled |
| `PUBLIC_READ` | `false` — the dashboard is login-gated. See §10 before changing it |

`AUTH_DEV_LOGIN` must never be set in production. The code refuses it when
`NODE_ENV=production`, but do not rely on that alone.

---

## 4. Deploying

Pushing to `main` deploys production; opening a PR deploys to the staging
environment (T9.6).

A deploy runs, in order:

1. Docker build.
2. **Pre-deploy: `prisma migrate deploy`.** If a migration fails, the deploy
   fails and the previous version keeps serving. This is the point of running
   migrations here rather than in the Dockerfile: a failed migration must not
   produce a running container against a half-migrated database.
3. Healthcheck on `/api/health`, which checks database connectivity.
4. Traffic switches over.

Manual deploy:

```sh
railway up --service web
```

---

## 5. Rolling back

**The app:** Railway → Deployments → the last known-good deployment → **Redeploy**.
Instant, and it does not touch the database.

**A migration:** rolling the app back does *not* roll back a migration. Prisma
has no down-migrations by design. To undo one:

1. Write a new migration that reverses it.
2. Deploy that.

If the migration destroyed data, restore from a backup (§7) into a *new*
database and copy the rows across. Do not restore over a live database while the
app is serving.

Additive-only migrations avoid this entirely: add a column, backfill it, switch
the code over, drop the old column in a later release.

---

## 6. Reaching the database and the logs

```sh
railway link                                    # pick project + environment
railway run --service db psql                   # psql on the deployed database
railway logs --service web                      # tail application logs
railway logs --service web --json | jq 'select(.level=="error")'
```

Every request logs one JSON line with a `requestId`, and every error response
carries that id in the `x-request-id` header. When a user reports a failure, ask
for that id:

```sh
railway logs --service web --json | jq 'select(.requestId=="<id>")'
```

Health:

```sh
curl -s https://<your domain>/api/health | jq
```

`status: unhealthy` with `database: unreachable` means the app cannot reach
Postgres — check that the `db` service is up and that `DATABASE_URL` still
resolves.

---

## 7. Backups and restore (T9.8)

Two independent copies:

1. **Railway's own Postgres backups** — Settings → Backups on the `db` service.
2. **`cron-backup`** — a daily `pg_dump` to R2 (`scripts/backup-to-r2.sh`).

The second exists because the first lives in the same account as the database it
protects.

### Restore drill — do this once before launch, and then annually

A backup you have never restored from is a hypothesis, not a backup.

```sh
# 1. Fetch the most recent dump
aws s3 ls s3://$R2_BUCKET/backups/ --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
aws s3 cp s3://$R2_BUCKET/backups/trees-<stamp>.dump . --endpoint-url https://...

# 2. Restore into a scratch database — never over the live one
createdb trees_restore_test
pg_restore --clean --if-exists --no-owner -d postgresql://…/trees_restore_test trees-<stamp>.dump

# 3. Check it is actually usable
psql trees_restore_test -c "SELECT PostGIS_Version();"
psql trees_restore_test -c "SELECT COUNT(*) FROM trees;"
psql trees_restore_test -c "SELECT COUNT(*) FROM trees WHERE geom IS NOT NULL;"
```

The third query is the one that matters: `geom` is a generated column, so a
restore that loses PostGIS silently loses every spatial query.

Record the date of the last successful drill here:

- Last restore drill: **never — do this before launch**

---

## 8. Rotating keys

| Key | How |
|---|---|
| `AUTH_SECRET` | Generate a new one and set it. Every session is invalidated — everyone signs in again. Do it deliberately, not on a Friday |
| Database password | Change it on the `db` service. `DATABASE_URL` follows automatically *because it is a reference variable* |
| `GEOCODING_API_KEY` | Create the new key at the provider, set it, deploy, then revoke the old one. In that order |
| `R2_*` | Create a new API token in Cloudflare with the same bucket scope, set it, deploy, revoke the old one |
| `NEXT_PUBLIC_MAP_TILES_KEY` | This is in the browser bundle and cannot be secret. Restrict it by referrer and monitor usage instead |

**Geocoding provider:** the deployment runs on Nominatim, which is free and
needs no key. Its usage policy caps requests at one per second and forbids bulk
use; `GEOCODING_MIN_INTERVAL_MS=1100` and the coordinate cache (rounded to
~11 m, so the cost scales with distinct places rather than trees) keep the app
inside that. There is no key to rotate.

If Nominatim starts returning 429 or 403, the first move is
`GEOCODING_PROVIDER=photon` — Komoot's OSM geocoder, also free and keyless, no
other change needed. Beyond that: self-host Nominatim from an Armenia extract,
or set `GEOCODING_PROVIDER=maptiler` with a key and
`GEOCODING_MIN_INTERVAL_MS=0`.

Failed lookups are never lost work: the tree is stored with
`geocode_status = FAILED` and the hourly `cron-geocode` service retries it.

---

## 9. Domain and TLS (T9.7)

1. Railway → `web` → Settings → Networking → Custom Domain.
2. In Cloudflare, add the CNAME Railway gives you.
3. **Set Cloudflare's SSL mode to Full (strict).** "Flexible" makes Cloudflare
   talk to Railway over HTTP while telling the browser it is HTTPS, and Railway
   redirects HTTP to HTTPS — an infinite redirect loop. This is the single most
   common way this setup breaks.

---

## 10. Decisions to revisit

- **`PUBLIC_READ` is `false`, deliberately.** Tree locations, including trees in
  private gardens, are visible to signed-in members only. Turning it on
  publishes every coordinate in the database to anyone with the URL — that is a
  decision about other people's property, not a configuration preference. If
  the map should be opened up, `FUZZ_PUBLIC_COORDINATES=true` is the middle
  step: signed-out viewers get coordinates rounded to ~110 m, signed-in members
  still get the real position.
- **Rate limiting** is in-process (`src/lib/rate-limit.ts`). With `numReplicas: 1`
  the limit is the limit. Raise the replica count and the effective limit
  multiplies by the number of replicas — that is when the `redis` service earns
  its place.
- **CSP** allows `'unsafe-inline'` for scripts, which is Next's hydration
  bootstrap. Tightening it needs per-request nonces; worth doing before this
  service handles anything more sensitive than tree locations.
- **Thumbnails (T6.3)** are not implemented: the map popup serves the full
  1600 px upload. Add Cloudflare Images or an R2 Worker transform when photo
  volume makes that matter.
