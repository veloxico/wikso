-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "emailFromAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emailFromName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emailProvider" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emailProviderConfig" TEXT NOT NULL DEFAULT '';
