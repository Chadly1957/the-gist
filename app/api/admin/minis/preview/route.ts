import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import { getPublishedDigestData } from "@/lib/deals/digest";
import { getGasPrices } from "@/lib/deals/gas";
import { ensureSeedMinis } from "@/lib/minis";

export const dynamic = "force-dynamic";

// Admin-only owner-view data for /deals?preview=<guide slug>.
//
// This is the ONLY source of full guide content for the portal preview, and
// it is admin-gated twice: the middleware 401s every /api/admin/* request
// without a valid admin session, and this handler re-checks the session
// itself, the same pattern as every other /api/admin route. The ?preview=
// URL parameter on /deals unlocks nothing by itself: the portal page asks
// this endpoint, and a non-admin just gets the 401 and the normal buy view.
//
// The payload mirrors /api/coupons/book for a full Deals owner (all active
// guides, full content) minus everything per-buyer: no purchase is read or
// created, no magic token is issued, and coupon QR codes are never minted
// (they encode a real buyer's token), so the coupons list is empty and the
// portal shows its standard empty state for that one section.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  await ensureSeedMinis(workspace.id, workspace.slug);

  const guideSelect = { id: true, slug: true, title: true, question: true, content: true, imageUrl: true } as const;
  const minis = await basePrisma.mini.findMany({
    where: { workspaceId: workspace.id, active: true },
    orderBy: { createdAt: "asc" },
    select: guideSelect,
  });

  // The guide named by the link is included even while it is still inactive,
  // so a draft can be previewed in the portal before it goes on sale. Real
  // buyers never see inactive guides; this widening exists only inside this
  // admin-gated response.
  const guideSlug = new URL(req.url).searchParams.get("guide");
  if (guideSlug && !minis.some((m) => m.slug === guideSlug)) {
    const draft = await basePrisma.mini.findFirst({
      where: { workspaceId: workspace.id, slug: guideSlug },
      select: guideSelect,
    });
    if (draft) minis.push(draft);
  }

  const digestData = await getPublishedDigestData(workspace.id);
  const gas = await getGasPrices(workspace.id);
  const settingRows = await basePrisma.setting.findMany({ where: { workspaceId: workspace.id } });
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    email: "",
    dealsLogoUrl: workspace.dealsLogoUrl,
    dealsEmailHeaderUrl: workspace.dealsEmailHeaderUrl,
    gas,
    coupons: [],
    deals: {
      topPicks: digestData.topPicks,
      retailers: digestData.retailers,
      weekLabel: digestData.weekLabel,
    },
    minis,
    access: {
      hasDeals: true,
      ownedMiniSlugs: minis.map((m) => m.slug),
      upgradePriceCents: null,
    },
    referrals: {
      rakuten: settings["deals_referral_rakuten"] || "",
      ibotta: settings["deals_referral_ibotta"] || "",
      note: settings["deals_referral_note"] || "",
    },
  });
}
