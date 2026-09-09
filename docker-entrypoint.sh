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

echo "Applying database migrations…"

# Captured rather than streamed, so the two failures that actually happen can be
# turned into instructions instead of a Prisma error code.
if OUTPUT=$(prisma migrate deploy --schema=./prisma/schema.prisma 2>&1); then
  echo "$OUTPUT"
  echo "Migrations applied."
  exec node server.js
fi

echo "$OUTPUT" >&2
echo "" >&2
echo "======================================================================" >&2

case "$OUTPUT" in
  *'extension "postgis"'*|*'type "geography" does not exist'*)
    cat >&2 <<'MSG'
This database does not have PostGIS, and this app cannot work without it.

Railway's stock PostgreSQL template does not include PostGIS. The database has
to be deployed from the postgis/postgis image instead:

  1. New -> Empty Service -> Deploy from Docker image: postgis/postgis:16-3.4
  2. Variables: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB,
     and PGDATA=/var/lib/postgresql/data/pgdata
  3. Attach a volume mounted at /var/lib/postgresql/data
  4. Point this service's DATABASE_URL at the new database:
       DATABASE_URL=${{Postgres.DATABASE_URL}}

Full instructions, including why PGDATA needs a subdirectory, are in
docs/RUNBOOK.md section 2.1.
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
