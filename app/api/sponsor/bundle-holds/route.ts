import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import {
  CAMPAIGN_BUNDLE_SLUGS,
  HOLD_MINUTES,
  WEEK_TIERS,
  countRunTaken,
  isBookableStartDate,
  withWeekLock,
} from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// Reserve the campaign slot for the same 7-day run in BOTH bundle markets.
// All-or-nothing: if either city is full, no hold is kept.
export async function POST(req: NextRequest) {
  const { weekStart } = await req.json();
  if (!isBookableStartDate(weekStart)) {
    return NextResponse.json({ error: "Pick a valid start day." }, { status: 400 });
  }

  const workspaces = await basePrisma.workspace.findMany({
    where: { slug: { in: [...CAMPAIGN_BUNDLE_SLUGS] } },
  });
  if (workspaces.length !== CAMPAIGN_BUNDLE_SLUGS.length) {
    return NextResponse.json({ error: "Bundle is not available right now." }, { status: 503 });
  }
  const ordered = CAMPAIGN_BUNDLE_SLUGS.map((slug) => workspaces.find((w) => w.slug === slug)!);

  const tier = "standard" as const;
  const created: { workspaceId: string; holdId: string; holdToken: string }[] = [];
  let expiresAt: Date | null = null;
  try {
    for (const ws of ordered) {
      const hold = await withWeekLock(ws.id, weekStart, async (tx) => {
        const week = await tx.sponsorWeek.findUniqueOrThrow({
          where: { workspaceId_weekStart: { workspaceId: ws.id, weekStart } },
          select: { id: true },
        });
        const taken = await countRunTaken(tx, ws.id, weekStart, tier);
        if (taken >= WEEK_TIERS[tier].slots) return null;
        return tx.sponsorHold.create({
          data: {
            workspaceId: ws.id,
            weekId: week.id,
            tier,
            expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
          },
          select: { id: true, holdToken: true, expiresAt: true },
        });
      });
      if (!hold) {
        // Roll back the holds already created so the bundle never half-books.
        if (created.length > 0) {
          await basePrisma.sponsorHold.deleteMany({ where: { id: { in: created.map((c) => c.holdId) } } });
        }
        return NextResponse.json(
          { error: `${ws.area} just filled for those dates. Please pick another start day.` },
          { status: 409 }
        );
      }
      created.push({ workspaceId: ws.id, holdId: hold.id, holdToken: hold.holdToken });
      expiresAt = hold.expiresAt;
    }
  } catch (err) {
    console.error("bundle-holds error:", err);
    if (created.length > 0) {
      await basePrisma.sponsorHold.deleteMany({ where: { id: { in: created.map((c) => c.holdId) } } });
    }
    return NextResponse.json({ error: "Could not reserve those dates. Please try again." }, { status: 500 });
  }

  const holds: Record<string, string> = {};
  ordered.forEach((ws, i) => {
    holds[ws.slug] = created[i].holdToken;
  });
  return NextResponse.json({ holds, expiresAt: expiresAt?.toISOString() });
}

// Release bundle holds early (buyer backs out).
export async function DELETE(req: NextRequest) {
  const { holdTokens } = await req.json();
  if (!Array.isArray(holdTokens) || holdTokens.length === 0) {
    return NextResponse.json({ error: "Hold tokens required." }, { status: 400 });
  }
  await basePrisma.sponsorHold.deleteMany({ where: { holdToken: { in: holdTokens.filter((t) => typeof t === "string") } } });
  return NextResponse.json({ released: true });
}
