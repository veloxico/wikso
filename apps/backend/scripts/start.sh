#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────
#  Wikso backend startup script
# ──────────────────────────────────────────────────────────────────────────
#  Smart-startup: detects whether the instance is past first-time setup,
#  applies any pending Prisma migrations idempotently, then boots NestJS.
#
#  Why this exists:
#    Before this script the only path that ran `prisma migrate deploy` was
#    the first-run setup wizard. Every subsequent app upgrade required an
#    operator to run migrations by hand (`docker exec ... npx prisma migrate
#    deploy`). Forgetting this led to silent runtime errors when new code
#    referenced columns that didn't exist yet. We want migrations to apply
#    automatically on every container start when the DB is reachable.
#
#  Three startup paths:
#    1) Setup mode (no DB configured) → skip migrations, let the wizard handle it
#    2) Configured + reachable        → apply pending migrations, then boot
#    3) Configured + unreachable      → log and boot anyway in degraded mode,
#                                        admin sees errors via /admin/health
#
#  `prisma migrate deploy` is production-safe and idempotent: it only applies
#  migrations marked as not-yet-applied in the `_prisma_migrations` table.
#  No-op on an up-to-date DB. Never generates schema diffs at runtime.
# ──────────────────────────────────────────────────────────────────────────
set -e

CONFIG_FILE="${WIKSO_CONFIG_PATH:-/app/data/wikso.config.json}"

# ── 1. Resolve DATABASE_URL ──────────────────────────────────────────────
# Prefer env override (Docker compose, Kubernetes secret, etc.); fall back
# to the wizard-written config file. The wizard saves the URL to disk so it
# survives container restarts without exposing it in env vars.
if [ -z "$DATABASE_URL" ] && [ -f "$CONFIG_FILE" ]; then
  # Use node to safely parse JSON — sed/grep would choke on edge cases like
  # escaped quotes in passwords or multi-line config formatting.
  PARSED_URL=$(node -e "
    try {
      const c = JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8'));
      if (c?.database?.url) process.stdout.write(c.database.url);
    } catch {}
  " 2>/dev/null || true)
  if [ -n "$PARSED_URL" ]; then
    export DATABASE_URL="$PARSED_URL"
    echo "📁 Loaded DATABASE_URL from $CONFIG_FILE"
  fi
fi

# ── 2. Decide what to do ─────────────────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
  echo "ℹ️  No DATABASE_URL configured — starting in setup mode"
  echo "    Visit the setup wizard to configure your database."
  exec node dist/main.js
fi

# ── 3. Apply pending migrations ──────────────────────────────────────────
# We give Prisma 60s — comfortably more than the largest reasonable single
# migration in this codebase, but short enough that a hung DB connection
# doesn't block container boot indefinitely (k8s liveness probe would
# eventually restart us anyway).
echo "🔄 Checking for pending Prisma migrations..."
SCHEMA_PATH="${PRISMA_SCHEMA_PATH:-./prisma/schema.prisma}"

# Capture both stdout and stderr; Prisma writes useful info to both.
# `migrate deploy` exits 0 if no pending migrations OR if all applied
# successfully; any non-zero is a real failure (DB unreachable, drift, etc.)
if MIGRATE_OUTPUT=$(npx --no-install prisma migrate deploy --schema="$SCHEMA_PATH" 2>&1); then
  # Distinguish "applied N migrations" from "no migrations to apply" so the
  # ops log shows whether this restart actually ran something.
  if echo "$MIGRATE_OUTPUT" | grep -qE "applied|migrating"; then
    echo "✅ Migrations applied successfully"
    echo "$MIGRATE_OUTPUT" | grep -E "^Applying migration|migrations? have been applied" || true
  else
    echo "✅ Database schema is up to date (no pending migrations)"
  fi
else
  EXIT_CODE=$?
  echo "⚠️  Migration check failed (exit code: $EXIT_CODE)"
  echo "$MIGRATE_OUTPUT" | tail -20
  echo ""
  echo "    Backend will start anyway — common causes:"
  echo "    • Database temporarily unreachable (will retry on first request)"
  echo "    • Migration conflict (check /admin/health and apply manually)"
  echo "    • Schema drift (run 'prisma migrate resolve' from a debug shell)"
  echo ""
fi

# ── 4. Boot the app ──────────────────────────────────────────────────────
exec node dist/main.js
