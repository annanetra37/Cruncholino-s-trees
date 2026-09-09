#!/usr/bin/env bash
#
# T9.8 — a second backup, off Railway.
#
# Railway takes its own Postgres backups, and they are the first thing to reach
# for. This exists because they live in the same account as the thing they are
# backing up: an account problem, a deleted project or a billing lapse takes
# both. A copy in R2 does not have that failure mode.
#
# Run as a Railway cron service (see docs/RUNBOOK.md), daily.
#
# Required: DATABASE_URL, R2_* variables, and `aws` + `pg_dump` on PATH.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
: "${R2_BACKUP_BUCKET:=${R2_BUCKET:?R2_BUCKET is required}}"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILE="trees-${STAMP}.dump"
LOCAL="/tmp/${FILE}"

echo "Dumping database…"
# Custom format: pg_restore can then restore selectively, and it compresses.
pg_dump --format=custom --no-owner --no-privileges --file="${LOCAL}" "${DATABASE_URL}"

SIZE="$(stat -c %s "${LOCAL}")"
if [ "${SIZE}" -lt 1024 ]; then
  echo "Dump is only ${SIZE} bytes — refusing to upload a backup that is almost certainly empty." >&2
  exit 1
fi
echo "Dump is $((SIZE / 1024)) KiB."

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION=auto
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "Uploading to r2://${R2_BACKUP_BUCKET}/backups/${FILE}…"
aws s3 cp "${LOCAL}" "s3://${R2_BACKUP_BUCKET}/backups/${FILE}" --endpoint-url "${ENDPOINT}"

rm -f "${LOCAL}"

# Prune old dumps. Deliberately after a successful upload, never before: the
# point of retention is to keep the last N good backups, not to make room.
CUTOFF="$(date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)"
aws s3 ls "s3://${R2_BACKUP_BUCKET}/backups/" --endpoint-url "${ENDPOINT}" |
  awk '{print $1, $4}' |
  while read -r day name; do
    [ -z "${name}" ] && continue
    if [[ "${day}" < "${CUTOFF}" ]]; then
      echo "Pruning ${name} (${day})"
      aws s3 rm "s3://${R2_BACKUP_BUCKET}/backups/${name}" --endpoint-url "${ENDPOINT}"
    fi
  done

echo "Backup complete: ${FILE}"
echo "Restore with:  pg_restore --clean --if-exists --no-owner -d \"\$DATABASE_URL\" ${FILE}"
echo
echo "A backup you have never restored from is a hypothesis. See docs/RUNBOOK.md."
