import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isNurtureAudience, parseBlocks } from "@/lib/sponsor-nurture";

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaign = await prisma.sponsorEmailCampaign.findUnique({ where: { id: params.id } });
  if (!campaign) return NextResponse.json({ error: "Email not found." }, { status: 404 });
  return NextResponse.json({ campaign: shape(campaign) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.sponsorEmailCampaign.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Email not found." }, { status: 404 });
  if (existing.status === "sent") {
    return NextResponse.json({ error: "Sent emails can't be edited. Duplicate it to send a new version." }, { status: 409 });
  }
  const { name, subject, blocks, audience } = await req.json();
  const updated = await prisma.sponsorEmailCampaign.update({
    where: { id: params.id },
    data: {
      ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
      ...(typeof subject === "string" ? { subject } : {}),
      ...(Array.isArray(blocks) ? { blocks: JSON.stringify(parseBlocks(JSON.stringify(blocks))) } : {}),
      ...(isNurtureAudience(audience) ? { audience } : {}),
    },
  });
  return NextResponse.json({ campaign: shape(updated) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.sponsorEmailCampaign.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
