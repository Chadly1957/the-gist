import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";

export const dynamic = "force-dynamic";

// Ingest a vision-extracted Kirby Foods IGA week as a DRAFT DealWeek.
// Secured by bearer secret (KIRBY_INGEST_SECRET): the weekly cron agent can't
// hold an admin session, so it authenticates with this shared secret instead.
// Draft-only — Chad reviews and publishes from the deals admin.
// Body: { secret, weekStart*, weekEnd*, deals*: [{title*, price?, size?, summary?, category?}] }
export async function POST(req: NextRequest) {
  const configured = process.env.KIRBY_INGEST_SECRET;
  if (!configured) {
    return NextResponse.json({ error: "Ingest not configured" }, { status: 500 });
  }
  const body = (await req.json().catch(() => null)) as {
    secret?: string;
    weekStart?: string;
    weekEnd?: string;
    deals?: { title?: string; price?: string; size?: string; summary?: string; category?: string }[];
  } | null;
  if (!body || body.secret !== configured) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !body.weekStart ||
    !body.weekEnd ||
    !Array.isArray(body.deals) ||
    body.deals.length === 0 ||
    body.deals.some((d) => !d || !d.title)
  ) {
    return NextResponse.json(
      { error: "Body needs weekStart, weekEnd, and deals[] with titles." },
      { status: 400 }
    );
  }

  const workspace = await basePrisma.workspace.findUnique({ where: { slug: "effingham" } });
  if (!workspace) return NextResponse.json({ error: "Effingham workspace not found" }, { status: 500 });
  const retailer = await basePrisma.retailer.findUnique({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: "kirby-foods" } },
  });
  if (!retailer) {
    return NextResponse.json(
      { error: "kirby-foods retailer missing; run Seed retailers first." },
      { status: 400 }
    );
  }

  const existing = await basePrisma.dealWeek.findFirst({
    where: { workspaceId: workspace.id, retailerId: retailer.id, weekStart: body.weekStart },
  });
  if (existing) {
    return NextResponse.json({ created: false, weekId: existing.id, note: "Week already ingested." });
  }

  const adUrl = "https://www.kirbyfoods.com/weekly-ads/6/Kirby Foods Effingham";
  const week = await basePrisma.dealWeek.create({
    data: {
      workspaceId: workspace.id,
      retailerId: retailer.id,
      weekStart: body.weekStart,
      weekEnd: body.weekEnd,
      sourceUrl: adUrl,
      status: "draft",
    },
  });
  await basePrisma.deal.createMany({
    data: body.deals.map((d, i) => ({
      workspaceId: workspace.id,
      dealWeekId: week.id,
      title: d.title as string,
      price: d.price || null,
      category: d.category || null,
      summary: [d.size || "", d.summary || ""].filter(Boolean).join(" ").trim(),
      dealUrl: adUrl,
      validFrom: body.weekStart as string,
      validTo: body.weekEnd as string,
      sortOrder: i,
    })),
  });
  return NextResponse.json({ created: true, weekId: week.id, dealCount: body.deals.length });
}
