FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy root workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY patches ./patches
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN pnpm install --frozen-lockfile

# Copy shared package source
COPY packages/shared ./packages/shared
COPY apps/backend/prisma ./apps/backend/prisma
RUN pnpm --filter @wikso/backend exec prisma generate

# Copy backend source
COPY apps/backend/tsconfig*.json apps/backend/nest-cli.json ./apps/backend/
COPY apps/backend/src ./apps/backend/src
RUN pnpm --filter @wikso/backend run build

# Prune to prod deps only (keep prisma for migrations)
RUN pnpm install --frozen-lockfile --prod
RUN pnpm --filter @wikso/backend exec prisma generate

# Production stage
FROM node:20-alpine

# Install CLI tools for subscription-based AI features
RUN npm install -g @anthropic-ai/claude-code@2.1.56 2>/dev/null || true
RUN npm install -g @openai/codex@latest 2>/dev/null || true
RUN apk add --no-cache python3 make g++ && \
    npm install -g @google/gemini-cli 2>/dev/null || true && \
    apk del make g++ 2>/dev/null || true
# Fix BusyBox env not supporting -S flag for gemini CLI — use shell wrapper
RUN if [ -f /usr/local/bin/gemini ]; then \
      mv /usr/local/bin/gemini /usr/local/bin/gemini-real && \
      printf '#!/bin/sh\nexec /usr/local/bin/node --no-warnings=DEP0040 /usr/local/bin/gemini-real "$@"\n' > /usr/local/bin/gemini && \
      chmod +x /usr/local/bin/gemini; \
    fi

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
# Smart-startup script: applies pending Prisma migrations on every container
# boot when the DB is reachable, then launches NestJS. Replaces the old
# wizard-only migration flow so app upgrades pick up new migrations
# automatically without operator intervention.
COPY apps/backend/scripts/start.sh ./apps/backend/scripts/start.sh
RUN chmod +x ./apps/backend/scripts/start.sh

WORKDIR /app/apps/backend

# Create config dirs for CLI tools
RUN mkdir -p /root/.gemini /root/.claude

EXPOSE 3000 1234
# Smart entrypoint:
#   1. If DATABASE_URL is configured (env or /app/data/wikso.config.json):
#      run `prisma migrate deploy` (idempotent — no-op if up-to-date).
#   2. If not configured: skip migrations, start in setup-wizard mode.
#   3. If migrations fail: log the error and start anyway (degraded mode);
#      operator can investigate via /admin/health and shell access.
# The setup wizard still triggers an explicit migration on first config so
# the new admin can land on a usable instance without restarting the container.
CMD ["sh", "scripts/start.sh"]
