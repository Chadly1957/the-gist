-- A/B test event log for the /join landing page (view + signup per variant).
CREATE TABLE "JoinTestEvent" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JoinTestEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JoinTestEvent_workspaceId_variant_event_idx" ON "JoinTestEvent"("workspaceId", "variant", "event");
CREATE INDEX "JoinTestEvent_createdAt_idx" ON "JoinTestEvent"("createdAt");

ALTER TABLE "JoinTestEvent" ADD CONSTRAINT "JoinTestEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
