# Deployment runbook

Everything an on-call person needs for this service, on one page: how to deploy,
how to roll back, how to reach the database, how to read logs, and how to rotate
a key.

---

## 1. What is deployed

Railway project, one per environment (`staging` and `production`), each with:

| Service        | What it is                  | Notes                                                                     |
| -------------- | --------------------------- | ------------------------------------------------------------------------- |
| `web`          | The Next.js app             | Built from `Dockerfile`, configured by `railway.json`                     |
| `db`           | PostgreSQL 16 + PostGIS     | `postgis/postgis:16-3.4`, persistent volume at `/var/lib/postgresql/data` |
| `cron-geocode` | `pnpm job:geocode-backfill` | Hourly. Retries failed address lookups                                    |
| `cron-orphans` | `pnpm job:orphan-cleanup`   | Daily. Deletes unreferenced R2 objects                                    |
| `cron-backup`  | `scripts/backup-to-r2.sh`   | Daily. `pg_dump` to R2, on top of Railway's own backups                   |
| `redis`        | _not deployed_              | Only needed when a second `web` replica arrives — see §9                  |

---

## 2. First-time setup

### 2.1 The database (T9.2)

Railway's stock Postgres template **does not include PostGIS**, and this app
does not work without it. Deploy the database from the Docker image instead:

1. **New → Docker Image**, and enter `postgis/postgis:16-3.4`.
   Not "Database" (that is the stock template, without PostGIS) and not
   "Empty Service" (that has no image to run).
2. Rename the service to `postgis` — Settings → Service Name. The name is not
   cosmetic: it is how the web service refers to it in step 5.
3. Variables on the `postgis` service:
   ```
   POSTGRES_USER=trees
   POSTGRES_PASSWORD=<generate a strong one>
   POSTGRES_DB=trees
   PGDATA=/var/lib/postgresql/data/pgdata
   ```
   `PGDATA` pointing at a subdirectory matters: the image refuses to initialise
   into a volume root that already contains `lost+found`.
4. Attach a **volume** mounted at `/var/lib/postgresql/data`. Without it the
   database is wiped on every redeploy.
5. On the **web** service, set `DATABASE_URL` by hand:

   ```
   DATABASE_URL=postgresql://trees:<the same password>@${{postgis.RAILWAY_PRIVATE_DOMAIN}}:5432/trees
   ```

   **`${{Postgres.DATABASE_URL}}` does not work here.** Railway composes that
   variable only for databases created from its own template; one deployed from
   a Docker image exposes no such thing, and referencing it yields an empty
   value and a container that cannot start. `RAILWAY_PRIVATE_DOMAIN` is
   provided for every service, and using it keeps the traffic on the private
   network exactly as the template variable would have.

   The `postgis` in the reference is the service name from step 2. Rename the
   service and this reference has to change with it.

6. Confirm the extension is there:
   ```sh
   railway run --service postgis psql -U trees -d trees -c "SELECT PostGIS_Version();"
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

| Service        | Start command                  | Schedule     |
| -------------- | ------------------------------ | ------------ |
| `cron-geocode` | `pnpm job:geocode-backfill`    | `0 * * * *`  |
| `cron-orphans` | `pnpm job:orphan-cleanup`      | `30 3 * * *` |
| `cron-backup`  | `bash scripts/backup-to-r2.sh` | `0 2 * * *`  |

Cron services must exit when finished. All three do.

---

## 3. Variables (T9.4)

Set these on the **`web`** service. Copy-paste ready; the four marked **fill in**
are the only ones that need a value from you.

```
DATABASE_URL=postgresql://trees:<password>@${{postgis.RAILWAY_PRIVATE_DOMAIN}}:5432/trees
AUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
AUTH_TRUST_HOST=true
AUTH_SECRET=<fill in: openssl rand -base64 32>

EMAIL_SERVER=<fill in: smtp://user:password@smtp.example.org:587>
EMAIL_FROM=trees@<your domain>

GEOCODING_PROVIDER=nominatim
GEOCODING_USER_AGENT=cruncholino-trees/0.1 (+https://<your domain>)
GEOCODING_TIMEOUT_MS=3000
GEOCODING_MIN_INTERVAL_MS=1100

# No map key needed: leave NEXT_PUBLIC_MAP_STYLE_URL and
# NEXT_PUBLIC_MAP_TILES_KEY unset and the basemap uses OpenStreetMap.
NEXT_PUBLIC_MAP_DEFAULT_CENTER=44.5152,40.1872
NEXT_PUBLIC_MAP_DEFAULT_ZOOM=11

PUBLIC_READ=false
FUZZ_PUBLIC_COORDINATES=false
MODERATION_ENABLED=false
DUPLICATE_RADIUS_M=5
MAX_GEOJSON_FEATURES=5000
MAX_PAGE_SIZE=200
RATE_LIMIT_WRITES_PER_MINUTE=30
LOG_LEVEL=info
```

Deliberately **not** set:

- `PORT` — Railway assigns it and the container reads it. Setting it by hand is
  how you get a healthcheck that never passes.
- `NODE_ENV` — the Dockerfile sets `production`.
- `AUTH_DEV_LOGIN` — must never exist in production. The code refuses it when
  `NODE_ENV=production`; do not rely on that alone.
- `R2_*` — optional. Without them the app runs and photo upload reports itself
  as unavailable, rather than failing when a contributor tries to use it.

### Why these particular forms

**`DATABASE_URL` points at the private network, not a public host.**
`${{postgis.RAILWAY_PRIVATE_DOMAIN}}` resolves to a `*.railway.internal`
address, so database traffic never leaves Railway's network and the database
needs no public egress at all.

The password is unavoidably written into this string, because a database
deployed from a Docker image publishes no composed `DATABASE_URL` to reference
— that convenience exists only for Railway's own template, which cannot be used
here because it has no PostGIS. The consequence to remember: rotating
`POSTGRES_PASSWORD` means editing `DATABASE_URL` on the web service in the same
change, or the app cannot connect.

**`AUTH_URL` uses Railway's own domain variable.** `${{RAILWAY_PUBLIC_DOMAIN}}`
tracks the service's real domain, so a preview environment or a domain change
does not silently break sign-in. Swap it for your custom domain once you have
one — Auth.js compares the callback origin against this value, and a mismatch
sends every sign-in attempt back to `/signin` with no explanation.

**`EMAIL_SERVER` is not optional here.** The dashboard is login-gated and the
only production sign-in method is the magic link, so without SMTP nobody —
including you — can get in. Any provider with a free tier works; the value is a
standard SMTP URL. Set `EMAIL_FROM` to an address on a domain that provider is
allowed to send for, or the mail will be silently dropped as spam.

**`GEOCODING_USER_AGENT` must identify you truthfully.** Nominatim's usage
policy requires it and blocks requests without one. Put a real contact URL in
it.

**The `NEXT_PUBLIC_*` variables are read at build time, not run time.** They are
inlined into the browser bundle by `next build`, which is why the Dockerfile
declares them as build args. Two consequences: changing one needs a rebuild
rather than a restart (a Railway redeploy does rebuild, so this is automatic),
and `NEXT_PUBLIC_MAP_TILES_KEY`, _if you set one_, is **public by design** — it
ships in the JavaScript every visitor downloads. Restrict it by HTTP referrer in
the tile provider's console and watch the usage; that is the control, not
secrecy.

This is exactly why the basemap does not need a key by default. A build-time
variable that is wrong cannot be corrected by editing it in Railway — it takes a
rebuild — and until then MapLibre draws an empty background with no error a
contributor can act on. Leave both map variables unset and the app uses
OpenStreetMap's tiles directly; set a style URL that fails to load and the app
probes it once on first load and falls back to OpenStreetMap anyway.

The full list of variables the app understands, with defaults, is in
`.env.example`.

## 3a. First run

Nothing to do. The container runs `prisma migrate deploy` on start
(`docker-entrypoint.sh`), and the species list ships as a migration, so a fresh
deployment against an empty database creates its own tables and reference data.

Migrations also stay declared as the platform's pre-deploy hook, which is the
tidier place for them. Running them in the entrypoint as well is deliberate: a
hook that silently does not run leaves the app pointed at a database with no
tables, and that surfaces as "The table `public.users` does not exist" on the
first sign-in — an application bug, apparently, rather than a deployment that
never migrated.

If migrations fail the container refuses to start, rather than serving an app
whose every query fails while the healthcheck's HTTP layer looks alive.

Demo trees and demo accounts are still a separate, opt-in step, and belong
nowhere near production:

```sh
pnpm db:seed          # local development only: 30 demo trees and two accounts
```

### Make yourself an admin

With `OPERATOR_ROLE=ADMIN` the password account is an admin already and there
is nothing to do. Otherwise the first person to sign in is a CONTRIBUTOR like
everyone else — there is no bootstrap admin, because an account that exists
before anyone has authenticated is an account nobody has authenticated as. Sign
in through the app first, then:

```sh
railway run --service web pnpm set-role you@example.org ADMIN
```

It refuses an email that has never signed in, which is the point: it promotes a
real account rather than inventing one.

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

## 4a. When a deploy is refused for vulnerable dependencies

Railway scans `pnpm-lock.yaml` before building and **refuses to deploy** a
project with known-vulnerable packages. The message names the package, the
severity and the version to upgrade to.

This is not a Railway problem to work around — it is the correct answer to a
real advisory. Fix it in the repository:

```sh
pnpm audit --audit-level high        # what CI checks, and what Railway checks
pnpm audit --json | jq '.advisories[] | {module_name, severity, patched_versions}'
```

Then bump the named package, run `pnpm install`, and verify before pushing:

```sh
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e
```

The end-to-end suite matters here more than usual: a security patch can arrive
inside a major version bump — MapLibre 6 dropped its default export, for
instance — and typecheck alone will not tell you the map still renders.

For a transitive dependency no direct bump reaches, pin it with a `pnpm.overrides`
entry in `package.json`. There are four such pins today (`@auth/core`,
`postcss`, `sharp`, `deepmerge-ts`); each can be dropped once the package that
pulls it in ships a fixed range of its own.

CI runs the same audit and fails on high or critical, so this should be caught
in the pull request rather than at deploy time.

## 4a. Getting in without a mail server

The magic link needs working SMTP. Setting `OPERATOR_EMAIL` and
`OPERATOR_PASSWORD` adds a password form to the sign-in page that does not:

```
OPERATOR_EMAIL=you@example.org
OPERATOR_PASSWORD=trees2026
OPERATOR_ROLE=ADMIN
```

The password can be as simple as you want; the only rule is that it is not
empty. What makes a short password survivable here is the rate limit, not its
length — see below — so keep that in place rather than reaching for a longer
password.

The account is created on first successful sign-in with whatever
`OPERATOR_ROLE` says, so `ADMIN` here saves a separate `set-role` step. Both
variables must be set or neither — half-configured reads as "I set this up"
while the account silently does not exist, so the app refuses to start and says
which one is missing.

Ten failed attempts per address per minute are rate limited, and every
attempt — successful or not — is logged:

```sh
railway logs --service web --json | jq 'select(.message | startswith("operator sign-in"))'
```

### What it is not

One shared login. It does not replace the magic link, and it should not be
handed round:

- Every tree recorded through it has the same contributor, so "added by" stops
  meaning anything.
- One password shared among several people cannot be revoked for one of them.
- There is no per-person audit trail in `tree_revisions`.

Set up SMTP when there is more than one person recording trees, give everyone
their own account, and keep this as the way back in when mail breaks. Rotate it
when someone who knew it stops needing it, and unset both variables to remove
the account's ability to sign in entirely.

## 3b. Migration failures

The container refuses to start if migrations fail, and prints instructions for
the two failures that actually happen. Both are worth recognising:

**`permission denied to create extension "postgis"`** — the database is a stock
PostgreSQL without PostGIS, and this app cannot work on one. Deploy the database
from the `postgis/postgis` image (§2.1) and point `DATABASE_URL` at it. On a new
deployment there is no data to migrate; on an existing one, `pg_dump` first.

**`P3009: migrate found failed migrations`** — an earlier attempt failed and
left a marker. Prisma then refuses to apply anything, which is a safety feature
rather than a second problem: the failure it protects you from already happened,
and its reason is in the log of the deploy that failed, not the current one.

Fix the original cause first, then clear the marker:

```sh
railway run --service web prisma migrate resolve --rolled-back 20260101000000_init
```

Prisma runs each migration in a transaction, so a failed one leaves no
half-created tables behind — clearing the marker and redeploying is enough. Do
not reach for `--applied`: that tells Prisma the migration succeeded, and the
schema it describes will be missing forever.

## 4b. "Sign-in failed (Configuration)"

This is Auth.js's label for _any_ failure inside a sign-in provider, and it is
misleading: nine times in ten it means the app could not reach the SMTP server,
not that the configuration is malformed. Retrying achieves nothing.

The real cause is only in the server log. It is logged through the structured
logger, so:

```sh
railway logs --service web --json | jq 'select(.message=="auth error")'
```

Common causes, in the order worth checking:

| What the log says                                 | What it means                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Connection timeout`, `ECONNREFUSED`, `ENOTFOUND` | `EMAIL_SERVER` points at a host that isn't answering — most often the placeholder `smtp.example.org` was never replaced         |
| `Invalid login`, `535`, `Authentication failed`   | Wrong username or key. With Resend the username is the literal word `resend`, not an email address; the password is the API key |
| `Missing credentials`                             | The URL is malformed — check it is `smtp://user:password@host:port` with no spaces around it                                    |
| `MissingAdapter` / `MissingAdapterMethods`        | A genuine configuration problem: the database adapter is not wired up                                                           |

To confirm the settings independently of the app, from any machine:

```sh
DEBUG=1 node -e "
  const t = require('nodemailer').createTransport(process.env.EMAIL_SERVER);
  t.verify().then(() => console.log('SMTP OK')).catch((e) => console.error('SMTP failed:', e.message));
"
```

`verify()` opens a connection and authenticates without sending anything, which
separates "credentials are wrong" from "the mail was sent and went to spam".

## 5. Rolling back

**The app:** Railway → Deployments → the last known-good deployment → **Redeploy**.
Instant, and it does not touch the database.

**A migration:** rolling the app back does _not_ roll back a migration. Prisma
has no down-migrations by design. To undo one:

1. Write a new migration that reverses it.
2. Deploy that.

If the migration destroyed data, restore from a backup (§7) into a _new_
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

| Key                         | How                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`               | Generate a new one and set it. Every session is invalidated — everyone signs in again. Do it deliberately, not on a Friday |
| Database password           | Change it on the `db` service. `DATABASE_URL` follows automatically _because it is a reference variable_                   |
| `GEOCODING_API_KEY`         | Create the new key at the provider, set it, deploy, then revoke the old one. In that order                                 |
| `R2_*`                      | Create a new API token in Cloudflare with the same bucket scope, set it, deploy, revoke the old one                        |
| `NEXT_PUBLIC_MAP_TILES_KEY` | This is in the browser bundle and cannot be secret. Restrict it by referrer and monitor usage instead                      |

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
