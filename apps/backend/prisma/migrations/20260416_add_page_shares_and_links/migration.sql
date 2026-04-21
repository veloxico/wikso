-- Phase 1 of Wikso competitive features: guest share links + bidirectional backlinks.
-- PageShare  → anonymous read access to a page via opaque token (+ optional bcrypt password).
-- PageLink   → extracted page-to-page references, populated on page save for "Mentioned in".

-- CreateTable: PageShare
CREATE TABLE "PageShare" (
    "id"             TEXT NOT NULL,
    "pageId"         TEXT NOT NULL,
    "token"          TEXT NOT NULL,
    "createdById"    TEXT NOT NULL,
    "expiresAt"      TIMESTAMP(3),
    "passwordHash"   TEXT,
    "allowComments"  BOOLEAN NOT NULL DEFAULT false,
    "viewCount"      INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt"   TIMESTAMP(3),
    "revokedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageShare_token_key"   ON "PageShare"("token");
CREATE        INDEX "PageShare_pageId_idx"  ON "PageShare"("pageId");
CREATE        INDEX "PageShare_createdById_idx" ON "PageShare"("createdById");

-- AddForeignKey
ALTER TABLE "PageShare" ADD CONSTRAINT "PageShare_pageId_fkey"
    FOREIGN KEY ("pageId")      REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageShare" ADD CONSTRAINT "PageShare_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PageLink
CREATE TABLE "PageLink" (
    "id"         TEXT NOT NULL,
    "fromPageId" TEXT NOT NULL,
    "toPageId"   TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageLink_fromPageId_toPageId_key" ON "PageLink"("fromPageId", "toPageId");
CREATE        INDEX "PageLink_toPageId_idx"            ON "PageLink"("toPageId");
CREATE        INDEX "PageLink_fromPageId_idx"          ON "PageLink"("fromPageId");

-- AddForeignKey
ALTER TABLE "PageLink" ADD CONSTRAINT "PageLink_fromPageId_fkey"
    FOREIGN KEY ("fromPageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageLink" ADD CONSTRAINT "PageLink_toPageId_fkey"
    FOREIGN KEY ("toPageId")   REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
