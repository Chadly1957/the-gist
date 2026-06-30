import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
  const where = month ? { date: { startsWith: month } } : {};

  const words = await prisma.wordyWord.findMany({
    where,
    orderBy: { date: "asc" },
  });

  // Attach puzzle numbers (count of all words on or before each date)
  const allDates = await prisma.wordyWord.findMany({ select: { date: true }, orderBy: { date: "asc" } });
  const dateIndexMap = new Map(allDates.map((w, i) => [w.date, i + 1]));

  return NextResponse.json({
    words: words.map((w) => ({ ...w, puzzleNum: w.puzzleNum ?? dateIndexMap.get(w.date) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, word, puzzleNum } = await req.json();
  if (!date || !word) return NextResponse.json({ error: "Date and word are required." }, { status: 400 });

  const wordUpper = String(word).toUpperCase().replace(/[^A-Z]/g, "");
  if (wordUpper.length < 3 || wordUpper.length > 8) {
    return NextResponse.json({ error: "Word must be 3–8 letters." }, { status: 400 });
  }

  const result = await prisma.wordyWord.upsert({
    where: { date },
    create: { date, word: wordUpper, puzzleNum: puzzleNum ?? null },
    update: { word: wordUpper, puzzleNum: puzzleNum ?? null },
  });

  return NextResponse.json({ word: result });
}
