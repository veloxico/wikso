-- Add the missing index on AiConfig.isActive declared in schema.prisma
-- (`@@index([isActive])`) but never emitted by an earlier migration.
-- The registry's hot path (AiProviderRegistry.getActiveConfig) does
-- `findFirst({ where: { isActive: true } })` on every cache miss; the
-- table is small, but consistency between schema and DB matters and
-- `prisma migrate diff` would otherwise keep flagging drift.
CREATE INDEX IF NOT EXISTS "AiConfig_isActive_idx" ON "AiConfig"("isActive");
