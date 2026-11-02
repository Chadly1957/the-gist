import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import {
  isNurtureAudience,
  nurtureAudienceCounts,
  parseBlocks,
} from "@/lib/sponsor-nurture";

export const dynamic = "force-dynamic";

interface NurtureCampaignStats {
  opens: number;
  openRate: number;
  clicks: number;
  clickers: number;
  clickRate: number;
}

function shape(c: {
  id: string; templateId: string | null; name: string; subject: string; blocks: string;
  audience: string; status: string; sentAt: Date | null; recipientCount: number;
  failedCount: number; updatedAt: Date;
}, stats: NurtureCampaignStats | null = null) {
  return {
    id: c.id,
    templateId: c.templateId,
    name: c.name,
    subject: c.subject,
    blocks: parseBlocks(c.blocks),
    audience: c.audience,
    status: c.status,
    sentAt: c.sentAt?.toISOString() ?? null,
    recipientCount: c.recipientCount,
    failedCount: c.failedCount,
    updatedAt: c.updatedAt.toISOString(),
    stats,
  };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getWorkspace();
  const [campaigns, counts] = await Promise.all([
    prisma.sponsorEmailCampaign.findMany({ orderBy: { updatedAt: "desc" } }),
    nurtureAudienceCounts(workspace.id),
  ]);
  // Per-campaign open/click stats from the per-recipient tracking rows.
  // Audiences are small (dozens of businesses), so plain aggregation in
  // JS is fine and keeps the math obvious. Rates are vs delivered mail
  // (recipients minus failures). Pixel opens are a soft signal; clicks
  // are exact.
  const sentIds = campaigns.filter((c) => c.status === "sent").map((c) => c.id);
  const statsByCampaign = new Map<string, NurtureCampaignStats>();
  if (sentIds.length > 0) {
    const rows = await prisma.sponsorNurtureSend.findMany({
      where: { campaignId: { in: sentIds } },
      select: { campaignId: true, openCount: true, clickCount: true },
    });
    const raw = new Map<string, { opens: number; clicks: number; clickers: number }>();
    for (const r of rows) {
      const acc = raw.get(r.campaignId) ?? { opens: 0, clicks: 0, clickers: 0 };
      if (r.openCount > 0) acc.opens++;
      if (r.clickCount > 0) acc.clickers++;
      acc.clicks += r.clickCount;
      raw.set(r.campaignId, acc);
    }
    for (const c of campaigns) {
      if (c.status !== "sent") continue;
      const delivered = Math.max(0, c.recipientCount - c.failedCount);
      const acc = raw.get(c.id) ?? { opens: 0, clicks: 0, clickers: 0 };
      statsByCampaign.set(c.id, {
        opens: acc.opens,
        openRate: delivered > 0 ? acc.opens / delivered : 0,
        clicks: acc.clicks,
        clickers: acc.clickers,
        clickRate: delivered > 0 ? acc.clickers / delivered : 0,
      });
    }
  }
  return NextResponse.json({
    campaigns: campaigns.map((c) => shape(c, statsByCampaign.get(c.id) ?? null)),
    counts,
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, subject, blocks, audience, templateId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Email name is required." }, { status: 400 });
  const created = await prisma.sponsorEmailCampaign.create({
    data: {
      name: name.trim(),
      subject: typeof subject === "string" ? subject : "",
      blocks: JSON.stringify(parseBlocks(JSON.stringify(Array.isArray(blocks) ? blocks : []))),
      audience: isNurtureAudience(audience) ? audience : "free",
      templateId: typeof templateId === "string" ? templateId : null,
    },
  });
  return NextResponse.json({ campaign: shape(created) });
}
