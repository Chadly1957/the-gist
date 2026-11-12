// Nightly sweep: geocode approved events that still have no pin.
//
// Approvals geocode on the spot, but a lookup can miss (Nominatim was
// slow, the location was vague that day, the event predates the map).
// This job retries those, a few dozen a night, one lookup per second
// per Nominatim's usage policy. It only ever ADDS coordinates; it never
// moves or clears a pin, and an event that cannot be placed stays
// list-only.
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { geocodeAndStoreEvent, sleepBetweenLookups } from "@/lib/geocode";

export const dynamic = "force-dynamic";

// Cap the night's work so the run always finishes inside its function
// timeout, even if every lookup is slow. Leftovers wait for tomorrow.
const MAX_EVENTS_PER_RUN = 30;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    new URL(req.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await basePrisma.workspace.findMany();
  const results = [];
  for (const workspace of workspaces) {
    try {
      const pending = await basePrisma.event.findMany({
        where: {
          workspaceId: workspace.id,
          status: "approved",
          location: { not: null },
          latitude: null,
        },
        orderBy: { eventDate: "asc" },
        take: MAX_EVENTS_PER_RUN,
        select: { id: true, location: true },
      });
      let pinned = 0;
      let skipped = 0;
      for (let i = 0; i < pending.length; i++) {
        if (i > 0) await sleepBetweenLookups();
        const hit = await geocodeAndStoreEvent(pending[i].id, pending[i].location, workspace.id);
        if (hit) pinned++;
        else skipped++;
      }
      results.push({ workspace: workspace.slug, checked: pending.length, pinned, skipped });
    } catch (error) {
      console.error("Event geocode sweep failed", workspace.id, error);
      results.push({ workspace: workspace.slug, error: "failed" });
    }
  }
  return NextResponse.json({ results });
}
