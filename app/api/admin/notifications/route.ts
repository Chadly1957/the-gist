import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/notifications — everything in this workspace that needs
// Chad's attention, computed from existing tables (no notification rows to
// maintain). The badge counts only actionable items; anything that can be
// cleared clears when the underlying item is handled.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getWorkspace();
  const wid = workspace.id;

  const [boardPosts, spotlights, bookings, orders, recentProfiles] = await Promise.all([
    prisma.boardPost.findMany({
      where: { workspaceId: wid, status: "pending_approval" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.spotlightListing.findMany({
      where: { workspaceId: wid, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, businessName: true, createdAt: true },
    }),
    prisma.adBooking.findMany({
      where: { workspaceId: wid, status: "pending_review" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, sponsor: { select: { businessName: true } }, createdAt: true },
    }),
    prisma.productOrder.findMany({
      where: { workspaceId: wid, status: "paid", fulfilledAt: null },
      orderBy: { paidAt: "desc" },
      take: 5,
      select: {
        id: true,
        email: true,
        paidAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.sponsorProfile.findMany({
      where: {
        workspaceId: wid,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, businessName: true, createdAt: true },
    }),
  ]);

  const [boardPending, sponsorPending, ordersUnfulfilled] = await Promise.all([
    prisma.boardPost.count({ where: { workspaceId: wid, status: "pending_approval" } }),
    Promise.all([
      prisma.spotlightListing.count({ where: { workspaceId: wid, status: "pending" } }),
      prisma.adBooking.count({ where: { workspaceId: wid, status: "pending_review" } }),
    ]).then(([a, b]) => a + b),
    prisma.productOrder.count({ where: { workspaceId: wid, status: "paid", fulfilledAt: null } }),
  ]);

  return NextResponse.json({
    boardPending,
    boardItems: boardPosts,
    sponsorPending,
    sponsorItems: [
      ...spotlights.map((s) => ({ id: s.id, label: `${s.businessName} — listing`, createdAt: s.createdAt })),
      ...bookings.map((b) => ({ id: b.id, label: `${b.sponsor.businessName} — ${b.type} ad`, createdAt: b.createdAt })),
    ]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5),
    ordersUnfulfilled,
    orderItems: orders.map((o) => ({
      id: o.id,
      label: `${o.product.name} — ${o.email}`,
      createdAt: o.paidAt,
    })),
    recentProfiles,
    total: boardPending + sponsorPending + ordersUnfulfilled,
  });
}
