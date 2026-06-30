import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns the answer only when the player has exhausted all guesses.
// Honour system — no server-side guess tracking for this casual game.
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Missing date." }, { status: 400 });

  const word = await prisma.wordyWord.findUnique({ where: { date } });
  if (!word) return NextResponse.json({ error: "No puzzle for this date." }, { status: 404 });

  return NextResponse.json({ answer: word.word.toUpperCase() });
}
