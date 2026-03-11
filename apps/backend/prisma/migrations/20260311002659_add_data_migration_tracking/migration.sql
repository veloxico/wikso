-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "appVersion" TEXT NOT NULL DEFAULT '0.0.0';

-- CreateTable
CREATE TABLE "DataMigration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batch" INTEGER NOT NULL DEFAULT 1,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataMigration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataMigration_name_key" ON "DataMigration"("name");
