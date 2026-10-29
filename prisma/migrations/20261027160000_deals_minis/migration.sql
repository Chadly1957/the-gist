-- CreateTable
CREATE TABLE "Mini" (
    "workspaceId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 500,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mini_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniPurchase" (
    "workspaceId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "miniId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "magicToken" TEXT NOT NULL,
    "upgradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiniPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mini_workspaceId_slug_key" ON "Mini"("workspaceId", "slug");
CREATE INDEX "Mini_workspaceId_idx" ON "Mini"("workspaceId");
CREATE UNIQUE INDEX "MiniPurchase_stripeSessionId_key" ON "MiniPurchase"("stripeSessionId");
CREATE UNIQUE INDEX "MiniPurchase_magicToken_key" ON "MiniPurchase"("magicToken");
CREATE INDEX "MiniPurchase_workspaceId_email_idx" ON "MiniPurchase"("workspaceId", "email");
CREATE INDEX "MiniPurchase_workspaceId_miniId_idx" ON "MiniPurchase"("workspaceId", "miniId");

-- AddForeignKey
ALTER TABLE "Mini" ADD CONSTRAINT "Mini_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MiniPurchase" ADD CONSTRAINT "MiniPurchase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MiniPurchase" ADD CONSTRAINT "MiniPurchase_miniId_fkey" FOREIGN KEY ("miniId") REFERENCES "Mini"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
