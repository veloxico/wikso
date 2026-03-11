/*
  Warnings:

  - A unique constraint covering the columns `[spaceId,userId]` on the table `SpacePermission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[spaceId,groupId]` on the table `SpacePermission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PagePermission" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "SpacePermission" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpacePermission_spaceId_userId_key" ON "SpacePermission"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpacePermission_spaceId_groupId_key" ON "SpacePermission"("spaceId", "groupId");

-- AddForeignKey
ALTER TABLE "SpacePermission" ADD CONSTRAINT "SpacePermission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagePermission" ADD CONSTRAINT "PagePermission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
