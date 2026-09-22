import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaces = await basePrisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, area: true, domain: true, _count: { select: { subscriberRows: true, sourceRows: true, newsletterSendRows: true } } },
  });
  return NextResponse.json({ workspaces, currentId: (await getWorkspace()).id });
}
export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const area = typeof body?.area === "string" ? body.area.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!name || name.length > 100 || !area || area.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
    return NextResponse.json({ error: "Enter a newsletter name, area, and URL slug using lowercase letters, numbers, and hyphens." }, { status: 400 });
  }
  // Give the ordinary duplicate case a clear response; the unique constraint
  // and P2002 handler below still handle concurrent creation attempts.
  if (await basePrisma.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    return NextResponse.json({ error: "That workspace URL is already in use." }, { status: 409 });
  }
  try {
    const workspace = await basePrisma.workspace.create({ data: { name, area, slug } });
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That workspace URL is already in use." }, { status: 409 });
    throw error;
  }
}
