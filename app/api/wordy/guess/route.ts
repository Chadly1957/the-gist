import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function evaluateGuess(guess: string, answer: string): ("correct" | "present" | "absent")[] {
  const n = answer.length;
  const result: ("correct" | "present" | "absent")[] = Array(n).fill("absent");
  const answerChars = answer.split("");
  const guessChars = guess.split("");

  // First pass: correct positions
  for (let i = 0; i < n; i++) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = "correct";
      answerChars[i] = "";
      guessChars[i] = "";
    }
  }

  // Second pass: present (right letter, wrong position)
  for (let i = 0; i < n; i++) {
    if (guessChars[i] !== "") {
      const idx = answerChars.indexOf(guessChars[i]);
      if (idx !== -1) {
        result[i] = "present";
        answerChars[idx] = "";
      }
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  const { date, guess } = await req.json();
  if (!date || !guess) return NextResponse.json({ error: "Missing date or guess." }, { status: 400 });

  const wordRecord = await prisma.wordyWord.findUnique({ where: { date } });
  if (!wordRecord) return NextResponse.json({ error: "No puzzle for this date." }, { status: 404 });

  const answer = wordRecord.word.toUpperCase();
  const guessUpper = String(guess).toUpperCase();

  if (guessUpper.length !== answer.length) {
    return NextResponse.json({ error: `Guess must be ${answer.length} letters.` }, { status: 400 });
  }
  if (!/^[A-Z]+$/.test(guessUpper)) {
    return NextResponse.json({ error: "Letters only." }, { status: 400 });
  }

  const result = evaluateGuess(guessUpper, answer);
  const won = result.every((r) => r === "correct");

  // gameOver is signalled when won, or when this guess is the last allowed
  // (client tracks guess count; server only knows it when asked directly)
  return NextResponse.json({
    result,
    won,
    // Reveal answer on win or when explicitly lost (client passes guessNum)
    answer: won ? answer : undefined,
  });
}
