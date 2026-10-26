-- CreateTable
CREATE TABLE "BoardPost" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "linkUrl" TEXT,
    "contactInfo" TEXT,
    "displayName" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "amountCents" INTEGER NOT NULL DEFAULT 500,
    "stripeSessionId" TEXT,
    "stripePaymentIntent" TEXT,
    "paidAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardPost_stripeSessionId_key" ON "BoardPost"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardPost_id_workspaceId_key" ON "BoardPost"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "BoardPost_workspaceId_status_idx" ON "BoardPost"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "BoardPost_workspaceId_approvedAt_idx" ON "BoardPost"("workspaceId", "approvedAt");

-- AddForeignKey
ALTER TABLE "BoardPost" ADD CONSTRAINT "BoardPost_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
