#!/usr/bin/env bash
set -euo pipefail

if [[ "${DATABASE_URL:-}" != *"127.0.0.1"* && "${DATABASE_URL:-}" != *"localhost"* ]]; then
  echo "Refusing database recovery test outside a local disposable database" >&2
  exit 1
fi

schema="libraries/nestjs-libraries/src/database/prisma/schema.prisma"
pnpm exec prisma migrate status --schema "$schema"
before="$(pnpm exec prisma migrate status --schema "$schema" 2>&1)"
pnpm exec prisma migrate reset --force --skip-generate --schema "$schema"
after="$(pnpm exec prisma migrate status --schema "$schema" 2>&1)"

grep -q "Database schema is up to date" <<<"$before"
grep -q "Database schema is up to date" <<<"$after"
echo "Disposable PostgreSQL reset and full migration replay passed"
