-- Deals nurture sequence: per-subscriber touch log + opt-out flag.
ALTER TABLE "Subscriber" ADD COLUMN "dealsNurtureOptOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DealsNurtureTouch" (
    "workspaceId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "touch" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DealsNurtureTouch_pkey" PRIMARY KEY ("id", "workspaceId")
);

CREATE UNIQUE INDEX "DealsNurtureTouch_workspaceId_subscriberId_touch_key" ON "DealsNurtureTouch"("workspaceId", "subscriberId", "touch");
CREATE INDEX "DealsNurtureTouch_workspaceId_idx" ON "DealsNurtureTouch"("workspaceId");

ALTER TABLE "DealsNurtureTouch" ADD CONSTRAINT "DealsNurtureTouch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
