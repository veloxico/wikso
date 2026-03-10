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

# Production stage
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY patches ./patches
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install ALL deps (including prisma CLI for migrations)
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/backend/prisma ./apps/backend/prisma

# Generate Prisma client in production stage
RUN pnpm --filter @wikso/backend exec prisma generate

# Copy compiled backend from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

WORKDIR /app/apps/backend

EXPOSE 3000 1234
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
