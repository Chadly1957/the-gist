import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { sponsorSlug } from "@/lib/sponsor-slug";
import { STARRED_LIVE_STATUSES, STARRED_MAX_SPOTS } from "@/lib/starred-board";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [spotlights, bookings, profiles, kitSends, starredRows] = await Promise.all([
      prisma.spotlightListing.findMany({
        orderBy: { createdAt: "desc" },
        include: { sponsor: { select: { businessName: true, contactName: true, email: true, magicToken: true } } },
      }),
      prisma.adBooking.findMany({
        orderBy: { date: "asc" },
        include: { sponsor: { select: { businessName: true, contactName: true, email: true } } },
      }),
      prisma.sponsorProfile.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, businessName: true, contactName: true, email: true, phone: true, website: true, magicToken: true, active: true, notes: true, createdAt: true },
      }),
      // Amp Kit: kit sends newest first, so the first row seen per
      // sponsor is their most recent kit.
      prisma.sponsorKitSend.findMany({
        orderBy: { sentAt: "desc" },
        select: { sponsorId: true, sentAt: true },
      }),
      // Starred Community Board: live subscriptions per listing, plus the
      // workspace count for the "Starred n/5" counter.
      prisma.starredBoardSubscription.findMany({
        where: { status: { in: [...STARRED_LIVE_STATUSES] } },
        select: { id: true, spotlightId: true, status: true, startedAt: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
      }),
    ]);

    const appUrl = await getWorkspaceUrl();

    const lastKitBySponsor = new Map<string, string>();
    for (const row of kitSends) {
      if (!lastKitBySponsor.has(row.sponsorId)) {
        lastKitBySponsor.set(row.sponsorId, row.sentAt.toISOString());
      }
    }

    const starredBySpotlight = new Map<string, {
      id: string; status: string; startedAt: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean;
    }>();
    for (const row of starredRows) {
      if (!starredBySpotlight.has(row.spotlightId)) {
        starredBySpotlight.set(row.spotlightId, {
          id: row.id,
          status: row.status,
          startedAt: row.startedAt ? row.startedAt.toISOString() : null,
          currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        });
      }
    }

    const workspace = await getWorkspace();

    return NextResponse.json({
      workspaceName: workspace.name,
      workspaceArea: workspace.area,
      spotlights: spotlights.map((s) => ({ ...s, starred: starredBySpotlight.get(s.id) ?? null })),
      starredCount: starredRows.length,
      starredMax: STARRED_MAX_SPOTS,
      bookings,
      profiles: profiles.map((p) => ({
        ...p,
        portalUrl: `${appUrl}/sponsor/portal?token=${p.magicToken}`,
        joinUrl: `${appUrl}/join/${sponsorSlug(p)}`,
        lastKitSentAt: lastKitBySponsor.get(p.id) ?? null,
      })),
    });
  } catch (err) {
    console.error("[admin/sponsors] GET failed:", err);
    return NextResponse.json({ spotlights: [], bookings: [], profiles: [], error: "Database error — run prisma db push if you just added a schema field." }, { status: 500 });
  }
}
