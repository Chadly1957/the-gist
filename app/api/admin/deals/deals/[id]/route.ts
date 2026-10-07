import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Edit a single deal (review screen): title/price/summary/top-pick/sort/active-ish.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const body = await req.json();
  const deal = await prisma.deal.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!deal) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const str = (v: unknown, max: number) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    if (s.length > max) throw new Error(`Field exceeds ${max} characters.`);
    return s || null;
  };

  try {
    const updated = await prisma.deal.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined ? { title: str(body.title, 200) || deal.title } : {}),
        ...(body.price !== undefined ? { price: str(body.price, 60) } : {}),
        ...(body.regPrice !== undefined ? { regPrice: str(body.regPrice, 60) } : {}),
        ...(body.category !== undefined ? { category: str(body.category, 80) } : {}),
        ...(body.summary !== undefined ? { summary: str(body.summary, 2000) || "" } : {}),
        ...(body.dealUrl !== undefined ? { dealUrl: str(body.dealUrl, 500) } : {}),
        ...(body.businessName !== undefined ? { businessName: str(body.businessName, 120) } : {}),
        ...(body.isTopPick !== undefined ? { isTopPick: !!body.isTopPick } : {}),
        ...(body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))
          ? { sortOrder: Number(body.sortOrder) }
          : {}),
      },
    });
    return NextResponse.json({ deal: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const deal = await prisma.deal.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!deal) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await prisma.deal.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
