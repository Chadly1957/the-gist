import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";

// POST /api/events/submit — public event creation, same fields as the
// sponsor portal form. Unlike sponsor events (auto-approved for known
// businesses), public submissions land as "pending" for admin review in
// /admin/events before they can run in the newsletter calendar.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const title = str(body.title, 120);
  const eventDate = str(body.eventDate, 10);
  const description = str(body.description, 500) || null;
  const startTime = str(body.startTime, 100) || null;
  const endTime = str(body.endTime, 100) || null;
  const location = str(body.location, 200) || null;
  const cost = str(body.cost, 100) || null;
  const url = str(body.url, 500) || null;

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return NextResponse.json({ error: "Title and a valid date are required." }, { status: 400 });
  }
  if (url && !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "The link must start with http:// or https://." }, { status: 400 });
  }

  const workspace = await getWorkspace();
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      title,
      description,
      eventDate,
      startTime,
      endTime,
      location,
      url,
      cost,
      status: "pending",
      sponsorId: null,
    },
  });

  return NextResponse.json({ event: { id: event.id, title: event.title } });
}
