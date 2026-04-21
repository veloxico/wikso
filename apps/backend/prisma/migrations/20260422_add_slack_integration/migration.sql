-- CreateTable
CREATE TABLE "SlackWorkspace" (
    "id" TEXT NOT NULL,
    "slackTeamId" TEXT NOT NULL,
    "slackTeamName" TEXT NOT NULL,
    "botAccessToken" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "connectedByUserId" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackChannelSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slackChannelId" TEXT NOT NULL,
    "slackChannelName" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "eventTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackChannelSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlackWorkspace_slackTeamId_key" ON "SlackWorkspace"("slackTeamId");

-- CreateIndex
CREATE INDEX "SlackChannelSubscription_spaceId_idx" ON "SlackChannelSubscription"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackChannelSubscription_workspaceId_slackChannelId_spaceId_key" ON "SlackChannelSubscription"("workspaceId", "slackChannelId", "spaceId");

-- AddForeignKey
ALTER TABLE "SlackChannelSubscription" ADD CONSTRAINT "SlackChannelSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "SlackWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackChannelSubscription" ADD CONSTRAINT "SlackChannelSubscription_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
