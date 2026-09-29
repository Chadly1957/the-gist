import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { getAdminSession } from "@/lib/auth";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";
import {
  WEEK_TIERS,
  isValidTier,
  withWeekLock,
  countTaken,
  buildWeekProjectionRows,
  addDaysISO,
  type WeekTier,
} from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// List all weekly package bookings (newest weeks first), with weekStart attached.
// Stripe session IDs are intentionally excluded from the response.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const bookings = await prisma.sponsorWeekBooking.findMany({
      orderBy: [{ week: { weekStart: "asc" } }, { createdAt: "asc" }],
      select: {
        id: true,
        weekId: true,
        sponsorId: true,
        tier: true,
        status: true,
        amountCents: true,
        businessName: true,
        contactName: true,
        email: true,
        website: true,
        logoUrl: true,
        aboutText: true,
        chadWritesCopy: true,
        finalAdCopy: true,
        copyFinalizedAt: true,
        rebookToken: true,
        resultsSentAt: true,
        renewalSentAt: true,
        createdAt: true,
        week: { select: { weekStart: true } },
      },
    });

    return NextResponse.json(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bookings.map((b: any) => {
        const { week, ...rest } = b;
        return { ...rest, weekStart: week.weekStart };
      })
    );
  } catch (err) {
    console.error("[admin/sponsors/week-bookings] list failed:", err);
    return NextResponse.json({ error: "Failed to load weekly bookings." }, { status: 500 });
  }
}

/**
 * Admin direct week placement (spec section 12). Books a full sponsor week
 * for any business without going through Stripe checkout:
 * - paid: money already received offline (check, cash, etc.)
 * - comp: $0 comp/house placement, marked as such in admin
 *
 * Presenting is a hard cap (1 per week); the week lock + capacity check
 * rejects a second presenting booking on any path, admin included.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = DEFAULT_WORKSPACE_ID;
  const {
    sponsorId,
    tier,
    weekStart,
    headline,
    body,
    ctaUrl,
    ctaLabel,
    imageUrl,
    website,
    isComp,
    adminNotes,
  } = await req.json();

  if (!sponsorId || !tier || !weekStart || !headline || !body || !ctaUrl) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!isValidTier(tier)) return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "weekStart must be YYYY-MM-DD (a Monday)." }, { status: 400 });
  }

  const profile = await basePrisma.sponsorProfile.findFirst({
    where: { id: sponsorId, workspaceId },
  });
  if (!profile) return NextResponse.json({ error: "Sponsor not found." }, { status: 404 });

  const comp = isComp === true;
  const status = comp ? "comped" : "paid";
  const amountCents = comp ? 0 : WEEK_TIERS[tier as WeekTier].priceCents;
  const adType = WEEK_TIERS[tier as WeekTier].adType;

  try {
    const booking = await withWeekLock(workspaceId, weekStart, async (tx) => {
      const week = await tx.sponsorWeek.upsert({
        where: { workspaceId_weekStart: { workspaceId, weekStart } },
        create: { workspaceId, weekStart },
        update: {},
        select: { id: true },
      });
      const taken = await countTaken(tx, workspaceId, week.id, tier as WeekTier);
      if (taken >= WEEK_TIERS[tier as WeekTier].slots) {
        throw new Error(
          tier === "presenting"
            ? "Presenting slot is already taken for this week. Hard cap: 1 per week, no exceptions."
            : "No slots left for this tier this week."
        );
      }
      // Hard cap across paths: a standalone day-level presenting ad on any of
      // the 5 days also blocks a presenting week (weekly bookings are already
      // counted above; this covers admin day placements).
      if (tier === "presenting") {
        const dates = [0, 1, 2, 3, 4].map((o) => addDaysISO(weekStart, o));
        const clash = await tx.adBooking.findFirst({
          where: {
            workspaceId,
            date: { in: dates },
            type: "presenting",
            status: { in: ["approved", "pending_review", "pending_payment"] },
          },
          select: { date: true },
        });
        if (clash) {
          throw new Error(
            `Presenting slot is already taken for this week. Hard cap: 1 per week, no exceptions. (day ad on ${clash.date})`
          );
        }
      }
      const created = await tx.sponsorWeekBooking.create({
        data: {
          workspaceId,
          weekId: week.id,
          sponsorId: profile.id,
          tier,
          status,
          amountCents,
          businessName: profile.businessName,
          contactName: profile.contactName,
          email: profile.email,
          website: website || profile.website || null,
          logoUrl: imageUrl || "",
          aboutText: body,
          chadWritesCopy: false,
          finalAdCopy: body,
          copyFinalizedAt: new Date(),
          paidAt: comp ? null : new Date(),
        },
        include: { week: { select: { weekStart: true } } },
      });
      // Project the 5 Mon-Fri day rows immediately. Comp rows are unpaid
      // but flagged isComp so admin can tell them apart from truly unpaid.
      const rows = buildWeekProjectionRows({
        id: created.id,
        workspaceId,
        sponsorId: profile.id,
        tier: tier as WeekTier,
        weekStart,
        businessName: profile.businessName,
        website: website || profile.website || null,
        logoUrl: imageUrl || "",
        aboutText: body,
        finalAdCopy: body,
        chadWritesCopy: false,
        isComp: comp,
      }).map((r) => ({
        ...r,
        headline,
        ctaUrl,
        ctaLabel: ctaLabel || "Learn More",
        presentingBlurb:
          adType === "presenting" ? `This issue is brought to you by ${profile.businessName}.` : null,
      }));
      await tx.adBooking.createMany({ data: rows });
      if (adminNotes) {
        await tx.adBooking.updateMany({
          where: { workspaceId, sponsorWeekBookingId: created.id },
          data: { adminNotes },
        });
      }
      return created;
    });

    return NextResponse.json({ booking });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Placement failed.";
    const conflict = message.includes("already taken") || message.includes("No slots left");
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 500 });
  }
}
