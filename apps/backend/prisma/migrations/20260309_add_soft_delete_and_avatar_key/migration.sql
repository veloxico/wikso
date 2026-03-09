-- AlterTable: User — add missing columns
ALTER TABLE "User" ADD COLUMN "avatarStorageKey" TEXT;
ALTER TABLE "User" ADD COLUMN "locale" TEXT;
ALTER TABLE "User" ADD COLUMN "timezone" TEXT;

-- AlterTable: Page — add soft-delete columns
ALTER TABLE "Page" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Page" ADD COLUMN "deletedBy" TEXT;

-- CreateIndex: composite index for efficient soft-delete queries
CREATE INDEX "Page_spaceId_deletedAt_idx" ON "Page"("spaceId", "deletedAt");

-- CreateTable: Favorite
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Favorite_userId_pageId_key" ON "Favorite"("userId", "pageId");

ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: RecentPage
CREATE TABLE "RecentPage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecentPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecentPage_userId_pageId_key" ON "RecentPage"("userId", "pageId");

ALTER TABLE "RecentPage" ADD CONSTRAINT "RecentPage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecentPage" ADD CONSTRAINT "RecentPage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PageTemplate
CREATE TABLE "PageTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contentJson" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "icon" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "spaceId" TEXT,
    "creatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PageTemplate" ADD CONSTRAINT "PageTemplate_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageTemplate" ADD CONSTRAINT "PageTemplate_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: PageView
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageView_pageId_createdAt_idx" ON "PageView"("pageId", "createdAt");

ALTER TABLE "PageView" ADD CONSTRAINT "PageView_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
