import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace, workspaceUnique } from "@/lib/workspace";
import { awardWordyPoints, resolveReaderSubscriberId } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// Verify a claimed Wordy win against the day's stored word before any
// points ride on it. The client sends the guesses it actually played
// (each one was already scored by /api/wordy/guess as it was submitted);
// the win is real only when the final guess IS the answer, the guess
// count matches the recorded play, and the game stayed inside the
// day's guess limit (word length + 1, the same limit /api/wordy/today
// hands out). A claim that fails any of this is still recorded as a
// play, exactly as before, but earns nothing.
async function verifyWordyWin(
  date: string,
  claimedGuesses: number,
  guessWords: unknown
): Promise<boolean> {
  const wordRecord = await prisma.wordyWord.findUnique({
    where: await workspaceUnique("date", date),
  });
  if (!wordRecord) return false;
  const answer = wordRecord.word.toUpperCase();
  const maxGuesses = answer.length + 1;
  if (!Array.isArray(guessWords)) return false;
  if (guessWords.length < 1 || guessWords.length > maxGuesses) return false;
  if (guessWords.length !== claimedGuesses) return false;
  const normalized: string[] = [];
  for (const g of guessWords) {
    if (typeof g !== "string") return false;
    const w = g.toUpperCase();
    if (w.length !== answer.length || !/^[A-Z]+$/.test(w)) return false;
    normalized.push(w);
  }
  return normalized[normalized.length - 1] === answer;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { date, won, guesses, maxGuesses, wordLength, recipientId } = body ?? {};
  if (!date) return NextResponse.json({ error: "Missing date." }, { status: 400 });

  await prisma.wordyPlay.create({
    data: {
      date,
      won: Boolean(won),
      guesses: Number(guesses) || 0,
      maxGuesses: Number(maxGuesses) || 0,
      wordLength: Number(wordLength) || 0,
      recipientId: recipientId || null,
    },
  });

  // Reader Rewards: a verified win pays the day's Wordy points, once
  // per reader per day, and only when the workspace's
  // rewards_wordy_points setting is above 0 (default 0 = off). The
  // reader is resolved from the email the portal link carries or the
  // newsletter recipient id the Wordy block has always used; anonymous
  // plays are recorded above and simply earn nothing.
  let pointsAwarded = 0;
  if (won) {
    const verified = await verifyWordyWin(
      date,
      Number(guesses) || 0,
      body?.guessWords
    ).catch(() => false);
    if (verified) {
      const workspace = await getWorkspace();
      const subscriberId = await resolveReaderSubscriberId(
        basePrisma,
        workspace.id,
        {
          email: typeof body?.email === "string" ? body.email : null,
          recipientId: typeof recipientId === "string" ? recipientId : null,
        }
      );
      if (subscriberId) {
        pointsAwarded = await awardWordyPoints(basePrisma, {
          workspaceId: workspace.id,
          subscriberId,
          date,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, pointsAwarded });
}
