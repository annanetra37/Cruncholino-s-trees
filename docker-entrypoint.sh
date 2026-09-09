#!/bin/sh
#
# Migrations run here, on container start, rather than only as the platform's
# pre-deploy hook.
#
# The hook is the tidier place for them and railway.json still declares it — but
# a hook that silently does not run leaves the app pointed at a database with no
# tables, which fails at the first request as "The table public.users does not
# exist" and looks like an application bug. Running them here as well makes the
# container correct on its own, whatever the platform did or did not do.
#
# `migrate deploy` is safe to run on every boot: it applies only what is
# missing, does nothing when the database is current, and takes an advisory lock
# so two containers starting together cannot race.
set -e

echo "Applying database migrations…"
if prisma migrate deploy --schema=./prisma/schema.prisma; then
  echo "Migrations applied."
else
  # Starting anyway would serve a broken app that looks alive to the
  # healthcheck's HTTP layer while every query fails.
  echo "Migrations failed — refusing to start. Check DATABASE_URL and the log above." >&2
  exit 1
fi

exec node server.js
