-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "GlobalRole" ADD VALUE 'EDITOR' BEFORE 'VIEWER';

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "invitedBy" TEXT;

-- AlterTable: Webhook
ALTER TABLE "Webhook" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "siteName" TEXT NOT NULL DEFAULT 'Wikso',
    "siteDescription" TEXT NOT NULL DEFAULT '',
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedEmailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 6,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 10080,
    "maxAttachmentSizeMb" INTEGER NOT NULL DEFAULT 25,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton settings row
INSERT INTO "SystemSettings" ("id", "updatedAt") VALUES ('singleton', NOW())
ON CONFLICT ("id") DO NOTHING;
