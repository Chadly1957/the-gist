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

function shape(c: {
  id: string; templateId: string | null; name: string; subject: string; blocks: string;
  audience: string; status: string; sentAt: Date | null; recipientCount: number;
  failedCount: number; updatedAt: Date;
}) {
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
  return NextResponse.json({ campaigns: campaigns.map(shape), counts });
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
