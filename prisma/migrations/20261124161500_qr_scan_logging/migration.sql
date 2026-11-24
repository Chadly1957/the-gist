-- QR scan logging (2026-11-24, Chad's call): log each visit that arrives via
-- the two printed QR codes (Dinner Club flyer, homepage banner), matched on
-- pathname + exact UTM triple in middleware and recorded by /api/qr-scan.
-- One row per page open; no dedupe (no IP is stored, so nothing to dedupe
-- on). No IPs, no personal data, ever. Additive only: one new table plus
-- indexes and its foreign key; no existing table is touched.
-- CreateTable
CREATE TABLE "QrScan" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "utmSource" TEXT NOT NULL,
    "utmMedium" TEXT NOT NULL,
    "utmCampaign" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QrScan_workspaceId_code_createdAt_idx" ON "QrScan"("workspaceId", "code", "createdAt");
CREATE INDEX "QrScan_workspaceId_idx" ON "QrScan"("workspaceId");

-- AddForeignKey
ALTER TABLE "QrScan" ADD CONSTRAINT "QrScan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
