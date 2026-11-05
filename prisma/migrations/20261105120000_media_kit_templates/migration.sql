-- Media Kit Builder templates: one flyer template and one social
-- template per workspace. Each row is a background image URL plus the
-- QR and logo zones (relative 0-1 coordinates, stored as JSON) drawn on
-- it in the admin zone editor. Additive only; no existing table is
-- touched.

CREATE TABLE "MediaKitTemplate" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "qrZone" JSONB NOT NULL,
    "logoZone" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MediaKitTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MediaKitTemplate_id_workspaceId_key" ON "MediaKitTemplate"("id", "workspaceId");
CREATE UNIQUE INDEX "MediaKitTemplate_workspaceId_kind_key" ON "MediaKitTemplate"("workspaceId", "kind");
CREATE INDEX "MediaKitTemplate_workspaceId_idx" ON "MediaKitTemplate"("workspaceId");
ALTER TABLE "MediaKitTemplate" ADD CONSTRAINT "MediaKitTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
