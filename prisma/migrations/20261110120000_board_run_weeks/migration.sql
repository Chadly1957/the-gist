-- Board posts can run 1 to 4 weeks at $5 per week; existing posts keep
-- the classic single-week run.
ALTER TABLE "BoardPost" ADD COLUMN "runWeeks" INTEGER NOT NULL DEFAULT 1;
