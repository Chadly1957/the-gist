import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(
  req: NextRequest,
  { params }: { params: { pollId: string; optionId: string } }
) {
  const { pollId, optionId } = params;
  const recipientId = req.nextUrl.searchParams.get("r") || null;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  const [poll, option] = await Promise.all([
    db.poll.findUnique({ where: { id: pollId } }),
    db.pollOption.findUnique({ where: { id: optionId } }),
  ]);

  if (!poll || !option || option.pollId !== pollId) {
    return NextResponse.redirect(`${appUrl}/poll/${pollId}/results`);
  }

  try {
    await db.pollVote.create({ data: { pollId, optionId, recipientId } });
  } catch {
    // Unique constraint: subscriber already voted — still redirect to results
  }

  return NextResponse.redirect(`${appUrl}/poll/${pollId}/results`);
}
