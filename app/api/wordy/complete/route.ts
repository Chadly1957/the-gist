import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { date, won, guesses, maxGuesses, wordLength, recipientId, sponsorViewed } = await req.json();
  if (!date) return NextResponse.json({ error: "Missing date." }, { status: 400 });

  await prisma.wordyPlay.create({
    data: {
      date,
      won: Boolean(won),
      guesses: Number(guesses) || 0,
      maxGuesses: Number(maxGuesses) || 0,
      wordLength: Number(wordLength) || 0,
      recipientId: recipientId || null,
      sponsorViewed: Boolean(sponsorViewed),
    },
  });

  return NextResponse.json({ ok: true });
}
