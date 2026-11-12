#!/usr/bin/env bash
# Runs the database tests against a plain Postgres (no Docker needed).
# Usage: PGURL=postgresql://postgres@127.0.0.1:5432 scripts/test-db-local.sh
set -euo pipefail
PGURL="${PGURL:-postgresql://postgres@127.0.0.1:5432}"
DB=flexit_test
psql "$PGURL/postgres" -qc "drop database if exists $DB" -c "create database $DB"
psql "$PGURL/$DB" -q -v ON_ERROR_STOP=1 -f tests/db/shim.sql
for f in supabase/migrations/*.sql; do psql "$PGURL/$DB" -q -v ON_ERROR_STOP=1 -f "$f"; done
DATABASE_URL="$PGURL/$DB" pnpm exec vitest run tests/db
