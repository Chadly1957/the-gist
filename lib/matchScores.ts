import { prisma } from "@/lib/db";

let matchScoreTablePromise: Promise<void> | null = null;

/**
 * Older deployments may have Prisma generated with MatchScore in the client
 * before the production database was updated. Make the Match leaderboard table
 * idempotently available before any reads/writes so score submission does not
 * fail with a generic persistence error when the table is missing.
 */
export function ensureMatchScoreTable() {
  matchScoreTablePromise ??= (async () => {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "MatchScore" (
        "id" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "score" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MatchScore_pkey" PRIMARY KEY ("id")
      )
    `;

    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "MatchScore_date_deviceId_key"
      ON "MatchScore" ("date", "deviceId")
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "MatchScore_date_idx"
      ON "MatchScore" ("date")
    `;
  })().catch((err) => {
    matchScoreTablePromise = null;
    throw err;
  });

  return matchScoreTablePromise;
}
