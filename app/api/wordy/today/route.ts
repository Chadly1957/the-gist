import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

  const word = await prisma.wordyWord.findUnique({ where: { date: today } });
  if (!word) return NextResponse.json({ hasWord: false, date: today });

  // Puzzle number = count of all words up to and including today
  const puzzleNum = word.puzzleNum ?? (await prisma.wordyWord.count({ where: { date: { lte: today } } }));
  const maxGuesses = word.word.length + 1;

  return NextResponse.json({
    hasWord: true,
    date: today,
    wordLength: word.word.length,
    maxGuesses,
    puzzleNum,
  });
}
