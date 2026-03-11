-- Simplify GlobalRole: ADMIN/EDITOR/VIEWER -> ADMIN/USER
-- EDITOR and VIEWER both become USER (space-level roles handle granular permissions)

-- Convert all EDITOR users to VIEWER first (consolidate)
UPDATE "User" SET "role" = 'VIEWER' WHERE "role" = 'EDITOR';

-- Rename VIEWER to USER
ALTER TYPE "GlobalRole" RENAME VALUE 'VIEWER' TO 'USER';

-- Update default
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'::"GlobalRole";
