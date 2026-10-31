import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBlocks } from "@/lib/sponsor-nurture";

export const dynamic = "force-dynamic";

function shape(t: { id: string; name: string; subject: string; blocks: string; updatedAt: Date }) {
  return { id: t.id, name: t.name, subject: t.subject, blocks: parseBlocks(t.blocks), updatedAt: t.updatedAt.toISOString() };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, subject, blocks } = await req.json();
  const existing = await prisma.sponsorEmailTemplate.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  const updated = await prisma.sponsorEmailTemplate.update({
    where: { id: params.id },
    data: {
      ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
      ...(typeof subject === "string" ? { subject } : {}),
      ...(Array.isArray(blocks) ? { blocks: JSON.stringify(parseBlocks(JSON.stringify(blocks))) } : {}),
    },
  });
  return NextResponse.json({ template: shape(updated) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.sponsorEmailTemplate.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
