import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await db.event.findMany({
    orderBy: { eventDate: "asc" },
    include: { sponsor: { select: { businessName: true, contactName: true, email: true } } },
  });

  // Which events are already on the Community Board (free admin upgrade):
  // lets the admin view show "On the Board" instead of offering the
  // upgrade twice. Board posts carry eventId for exactly this lookup.
  const boardPosts = await prisma.boardPost.findMany({
    where: { eventId: { in: events.map((e: { id: string }) => e.id) } },
    select: { id: true, eventId: true },
  });
  const boardByEvent = new Map(boardPosts.map((p) => [p.eventId, p.id]));

  return NextResponse.json({
    events: events.map((e: { id: string }) => ({
      ...e,
      boardPostId: boardByEvent.get(e.id) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description, eventDate, startTime, endTime, location, url, cost } = await req.json();

  if (!title?.trim() || !eventDate) {
    return NextResponse.json({ error: "Title and date are required." }, { status: 400 });
  }

  const event = await db.event.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      eventDate,
      startTime: startTime?.trim() || null,
      endTime: endTime?.trim() || null,
      location: location?.trim() || null,
      url: url?.trim() || null,
      cost: cost?.trim() || null,
      status: "approved",
      approvedAt: new Date(),
    },
  });

  return NextResponse.json({ event });
}
