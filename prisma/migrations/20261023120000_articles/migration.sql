-- CreateTable
CREATE TABLE "Story" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'Chad Williams',
    "headerImageUrl" TEXT,
    "body" TEXT NOT NULL,
    "excerpt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Story_workspaceId_status_idx" ON "Story"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Story_workspaceId_publishedAt_idx" ON "Story"("workspaceId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Story_workspaceId_slug_key" ON "Story"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Story_id_workspaceId_key" ON "Story"("id", "workspaceId");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

