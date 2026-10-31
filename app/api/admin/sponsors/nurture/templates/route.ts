import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBlocks } from "@/lib/sponsor-nurture";

export const dynamic = "force-dynamic";

function shape(t: { id: string; name: string; subject: string; blocks: string; updatedAt: Date }) {
  return { id: t.id, name: t.name, subject: t.subject, blocks: parseBlocks(t.blocks), updatedAt: t.updatedAt.toISOString() };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await prisma.sponsorEmailTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ templates: templates.map(shape) });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, subject, blocks } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Template name is required." }, { status: 400 });
  const created = await prisma.sponsorEmailTemplate.create({
    data: {
      name: name.trim(),
      subject: typeof subject === "string" ? subject : "",
      blocks: JSON.stringify(parseBlocks(JSON.stringify(Array.isArray(blocks) ? blocks : []))),
    },
  });
  return NextResponse.json({ template: shape(created) });
}
