import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";

export default async function PollResultsPage({ params }: { params: { pollId: string } }) {
  const poll = await db.poll.findUnique({
    where: { id: params.pollId },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!poll) notFound();

  const voteCounts: { optionId: string; _count: { id: number } }[] = await db.pollVote.groupBy({
    by: ["optionId"],
    where: { pollId: params.pollId },
    _count: { id: true },
  });

  const countMap = new Map(voteCounts.map((v) => [v.optionId, v._count.id]));
  const total = voteCounts.reduce((sum, v) => sum + v._count.id, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f4fbf7", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: 520, width: "100%", background: "#ffffff", borderRadius: 16, padding: "36px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#146763", marginBottom: 12 }}>
          Poll Results
        </div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 24, lineHeight: 1.4 }}>
          {poll.question}
        </h1>

        <div style={{ marginBottom: 24 }}>
          {poll.options.map((opt: { id: string; label: string }) => {
            const votes = countMap.get(opt.id) || 0;
            const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
            return (
              <div key={opt.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "sans-serif", fontSize: 14, fontWeight: 600, color: "#111827" }}>{opt.label}</span>
                  <span style={{ fontFamily: "sans-serif", fontSize: 13, color: "#6b7280" }}>{pct}% ({votes})</span>
                </div>
                <div style={{ height: 10, background: "#e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#146763", borderRadius: 6, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontFamily: "sans-serif", fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
          {total} {total === 1 ? "vote" : "votes"} total
        </p>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <a href="/" style={{ fontFamily: "sans-serif", fontSize: 13, color: "#146763", fontWeight: 600, textDecoration: "none" }}>
            ← Back to The Gist Decatur
          </a>
        </div>
      </div>
    </div>
  );
}
