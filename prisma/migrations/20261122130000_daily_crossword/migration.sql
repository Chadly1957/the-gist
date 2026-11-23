-- Daily Crossword (2026-11-22): a 5x5 mini generated from the word/clue
-- bank in lib/crossword-bank.ts. CrosswordPuzzle is deliberately GLOBAL
-- (no workspaceId): both cities play the identical puzzle each day, keyed
-- by date alone. CrosswordPlay records one completion per reader per day
-- per workspace; its (workspaceId, date, subscriberId) unique index is
-- the once-a-day guard for the Reader Rewards points hook. Additive only:
-- two new tables plus indexes and one foreign key; no existing table is
-- touched.

-- CreateTable
CREATE TABLE "CrosswordPuzzle" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "grid" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrosswordPuzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrosswordPlay" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "subscriberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrosswordPlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrosswordPuzzle_date_key" ON "CrosswordPuzzle"("date");

-- CreateIndex
CREATE INDEX "CrosswordPuzzle_date_idx" ON "CrosswordPuzzle"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CrosswordPlay_workspaceId_date_subscriberId_key" ON "CrosswordPlay"("workspaceId", "date", "subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "CrosswordPlay_id_workspaceId_key" ON "CrosswordPlay"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "CrosswordPlay_date_idx" ON "CrosswordPlay"("date");

-- CreateIndex
CREATE INDEX "CrosswordPlay_workspaceId_idx" ON "CrosswordPlay"("workspaceId");

-- AddForeignKey
ALTER TABLE "CrosswordPlay" ADD CONSTRAINT "CrosswordPlay_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
