-- CreateTable
CREATE TABLE "PresentingPartnership" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "workspaceIds" TEXT[] NOT NULL DEFAULT '{}',
    "monthlyAmountCents" INTEGER NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "logoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresentingPartnership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresentingPartnership_stripeSubscriptionId_key" ON "PresentingPartnership"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "PresentingPartnership_status_idx" ON "PresentingPartnership"("status");

-- CreateIndex
CREATE INDEX "PresentingPartnership_email_idx" ON "PresentingPartnership"("email");

-- CreateIndex
CREATE INDEX "PresentingPartnership_stripeCustomerId_idx" ON "PresentingPartnership"("stripeCustomerId");
