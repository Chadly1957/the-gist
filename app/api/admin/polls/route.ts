import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const polls = await db.poll.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
    },
  });

  const pollIds = polls.map((p: { id: string }) => p.id);

  const voteCounts: { optionId: string; _count: { id: number } }[] = pollIds.length
    ? await db.pollVote.groupBy({
        by: ["optionId"],
        where: { pollId: { in: pollIds } },
        _count: { id: true },
      })
    : [];

  const voteMap = new Map(voteCounts.map((v) => [v.optionId, v._count.id]));

  const newsletterSends = polls
    .filter((p: { newsletterSendId: string | null }) => p.newsletterSendId)
    .map((p: { newsletterSendId: string }) => p.newsletterSendId);

  const sends = newsletterSends.length
    ? await prisma.newsletterSend.findMany({
        where: { id: { in: newsletterSends } },
        select: { id: true, subject: true, sentAt: true },
      })
    : [];
  const sendMap = new Map(sends.map((s: { id: string; subject: string; sentAt: Date | null }) => [s.id, s]));

  const result = polls.map((p: { id: string; question: string; newsletterSendId: string | null; createdAt: Date; options: { id: string; label: string }[] }) => {
    const total = p.options.reduce((sum: number, o: { id: string }) => sum + (voteMap.get(o.id) || 0), 0);
    return {
      id: p.id,
      question: p.question,
      createdAt: p.createdAt,
      newsletterSend: p.newsletterSendId ? sendMap.get(p.newsletterSendId) ?? null : null,
      totalVotes: total,
      options: p.options.map((o: { id: string; label: string }) => ({
        id: o.id,
        label: o.label,
        votes: voteMap.get(o.id) || 0,
        pct: total > 0 ? Math.round(((voteMap.get(o.id) || 0) / total) * 100) : 0,
      })),
    };
  });

  return NextResponse.json({ polls: result });
}
