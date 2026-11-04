import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { sponsorSlug } from "@/lib/sponsor-slug";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [spotlights, bookings, profiles, kitSends] = await Promise.all([
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
    ]);

    const appUrl = await getWorkspaceUrl();

    const lastKitBySponsor = new Map<string, string>();
    for (const row of kitSends) {
      if (!lastKitBySponsor.has(row.sponsorId)) {
        lastKitBySponsor.set(row.sponsorId, row.sentAt.toISOString());
      }
    }

    const workspace = await getWorkspace();

    return NextResponse.json({
      workspaceName: workspace.name,
      workspaceArea: workspace.area,
      spotlights,
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
