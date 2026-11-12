import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { geocodeAndStoreEvent } from "@/lib/geocode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === "approved") data.approvedAt = new Date();
  }
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.eventDate !== undefined) data.eventDate = body.eventDate;
  if (body.startTime !== undefined) data.startTime = body.startTime?.trim() || null;
  if (body.endTime !== undefined) data.endTime = body.endTime?.trim() || null;
  if (body.location !== undefined) data.location = body.location?.trim() || null;
  if (body.url !== undefined) data.url = body.url?.trim() || null;
  if (body.cost !== undefined) data.cost = body.cost?.trim() || null;

  const prev = await db.event.findUnique({
    where: { id },
    select: { location: true, status: true },
  });

  const event = await db.event.update({ where: { id }, data });

  // Pin newly approved (or relocated) events on the map. This never
  // blocks or fails the approval itself: a missed lookup just leaves
  // the event list-only, and the nightly sweep retries it.
  if (event.status === "approved" && event.location) {
    const locationChanged = prev?.location !== event.location;
    if (event.latitude == null || event.longitude == null || locationChanged) {
      await geocodeAndStoreEvent(event.id, event.location, event.workspaceId, {
        force: locationChanged,
      });
    }
  }

  return NextResponse.json({ event });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.event.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
