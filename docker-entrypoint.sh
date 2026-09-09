#!/bin/sh
#
# Migrations run here, on container start, rather than only as the platform's
# pre-deploy hook. A hook that silently does not run leaves the app pointed at a
# database with no tables, which surfaces as "The table public.users does not
# exist" on the first request and reads as an application bug.
#
# `migrate deploy` is safe to run on every boot: it applies only what is
# missing, does nothing when the database is current, and takes an advisory lock
# so two containers starting together cannot race.
set -e

ATTEMPTS="${MIGRATE_ATTEMPTS:-6}"
DELAY="${MIGRATE_RETRY_DELAY:-5}"

n=1
while true; do
  echo "Applying database migrations… (attempt ${n}/${ATTEMPTS})"

  # Captured rather than streamed, so the failures that actually happen can be
  # turned into instructions instead of a Prisma error code.
  if OUTPUT=$(prisma migrate deploy --schema=./prisma/schema.prisma 2>&1); then
    echo "$OUTPUT"
    echo "Migrations applied."
    exec node server.js
  fi

  # A database that is merely still booting is the one failure worth waiting
  # out: on a fresh deploy the app and the database often start together, and
  # private DNS can take a few seconds to answer. Every other failure is a
  # configuration problem that will not fix itself, so fail fast on those.
  case "$OUTPUT" in
    *P1001*|*"Can't reach database server"*)
      if [ "$n" -lt "$ATTEMPTS" ]; then
        echo "Database not reachable yet — retrying in ${DELAY}s." >&2
        n=$((n + 1))
        sleep "$DELAY"
        continue
      fi
      ;;
  esac

  break
done

echo "$OUTPUT" >&2
echo "" >&2
echo "======================================================================" >&2

case "$OUTPUT" in
  *P1001*|*"Can't reach database server"*)
    cat >&2 <<'MSG'
The database host in DATABASE_URL is not answering. The app is reaching for a
database that is not there — this is almost always DATABASE_URL still pointing
at an old or renamed service.

Check, in this order:

  1. The host in the error above. It is whatever DATABASE_URL says. Does a
     service with that exact name exist and is it deployed and green?
     A service named "postgis" has the private host "postgis.railway.internal".
     Rename the service and this host changes with it.

  2. The database name at the end of DATABASE_URL. It must match POSTGRES_DB on
     the database service. Railway's own template uses "railway"; a database
     deployed from the postgis image uses whatever POSTGRES_DB says.

  3. That DATABASE_URL is built by hand for a Docker-image database:
       postgresql://USER:PASSWORD@SERVICE.RAILWAY_PRIVATE_DOMAIN:5432/DBNAME
     ${{Postgres.DATABASE_URL}} only exists for Railway's own Postgres
     template, and resolves to nothing for a database deployed from an image.

See docs/RUNBOOK.md section 2.1.
MSG
    ;;
  *'extension "postgis"'*|*'type "geography" does not exist'*)
    cat >&2 <<'MSG'
This database does not have PostGIS, and this app cannot work without it.

Railway's stock PostgreSQL template does not include PostGIS. The database has
to be deployed from the postgis/postgis image instead:

  1. New -> Docker Image: postgis/postgis:16-3.4
     (not "Database", which is the stock template, and not "Empty Service")
  2. Name the service, e.g. "postgis".
  3. Variables: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB,
     and PGDATA=/var/lib/postgresql/data/pgdata
  4. Attach a volume mounted at /var/lib/postgresql/data
  5. On the web service, set DATABASE_URL by hand:
       postgresql://USER:PASSWORD@${{postgis.RAILWAY_PRIVATE_DOMAIN}}:5432/DBNAME

Full instructions are in docs/RUNBOOK.md section 2.1.
MSG
    ;;
  *P3009*|*'failed migrations'*)
    cat >&2 <<'MSG'
A previous migration attempt failed and left a marker behind. Prisma will not
apply anything until that marker is cleared -- this is a safety feature, not a
new problem: the failure it is protecting you from already happened.

Fix whatever caused the original failure first (scroll up: the reason is in the
log of the deploy that failed, not this one). Then clear the marker and redeploy:

  railway run --service web prisma migrate resolve --rolled-back <migration_name>

The migration name is printed above. Prisma runs each migration in a
transaction, so a failed one leaves no half-created tables behind -- clearing
the marker and redeploying is enough.
MSG
    ;;
  *)
    echo "Migrations failed. Check DATABASE_URL and the error above." >&2
    ;;
esac

echo "======================================================================" >&2
# Starting anyway would serve an app that looks alive to the healthcheck's HTTP
# layer while every query fails.
exit 1
