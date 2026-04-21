-- CreateTable
CREATE TABLE "PageWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageWatch_userId_pageId_key" ON "PageWatch"("userId", "pageId");

-- CreateIndex
CREATE INDEX "PageWatch_pageId_idx" ON "PageWatch"("pageId");

-- CreateIndex
CREATE INDEX "PageWatch_userId_idx" ON "PageWatch"("userId");

-- AddForeignKey
ALTER TABLE "PageWatch" ADD CONSTRAINT "PageWatch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageWatch" ADD CONSTRAINT "PageWatch_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "Page"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing page author auto-watches their own pages.
INSERT INTO "PageWatch" ("id", "userId", "pageId", "createdAt")
SELECT
  gen_random_uuid()::TEXT,
  p."authorId",
  p."id",
  CURRENT_TIMESTAMP
FROM "Page" p
WHERE p."deletedAt" IS NULL
ON CONFLICT ("userId", "pageId") DO NOTHING;
