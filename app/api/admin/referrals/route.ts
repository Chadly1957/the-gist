import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sprints = await db.referralSprint.findMany({
    orderBy: { createdAt: "desc" },
  });

  // For each sprint, get signup counts grouped by referralCodeId
  const sprintIds = sprints.map((s: { id: string }) => s.id);
  const allSignups = sprintIds.length
    ? await db.referralSignup.findMany({
        where: { sprintId: { in: sprintIds } },
        select: { sprintId: true, referralCodeId: true },
      })
    : [];

  // Build counts per sprint
  const countsBySprintAndCode = new Map<string, Map<string, number>>();
  for (const su of allSignups) {
    if (!countsBySprintAndCode.has(su.sprintId)) {
      countsBySprintAndCode.set(su.sprintId, new Map());
    }
    const codeMap = countsBySprintAndCode.get(su.sprintId)!;
    codeMap.set(su.referralCodeId, (codeMap.get(su.referralCodeId) ?? 0) + 1);
  }

  // Also get total signup counts (all-time, no sprint filter)
  const allTimeSignups = await db.referralSignup.findMany({
    select: { referralCodeId: true },
  });
  const allTimeCounts = new Map<string, number>();
  for (const su of allTimeSignups) {
    allTimeCounts.set(su.referralCodeId, (allTimeCounts.get(su.referralCodeId) ?? 0) + 1);
  }

  const sprintsWithStats = sprints.map((sprint: { id: string; goal: number }) => {
    const codeMap = countsBySprintAndCode.get(sprint.id) ?? new Map();
    const totalSignups = Array.from(codeMap.values()).reduce((a, b) => a + b, 0);
    const qualifiedReferrers = Array.from(codeMap.values()).filter((c) => c >= sprint.goal).length;
    return { ...sprint, totalSignups, qualifiedReferrers };
  });

  return NextResponse.json({ sprints: sprintsWithStats });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, startDate, endDate, goal, prizeDescription } = await req.json();

  if (!name || !startDate || !endDate || !goal) {
    return NextResponse.json({ error: "Name, start date, end date, and goal are required." }, { status: 400 });
  }
  if (startDate >= endDate) {
    return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
  }

  const sprint = await db.referralSprint.create({
    data: {
      name,
      startDate,
      endDate,
      goal: parseInt(String(goal)),
      prizeDescription: prizeDescription || null,
      status: "active",
    },
  });

  return NextResponse.json({ sprint });
}
