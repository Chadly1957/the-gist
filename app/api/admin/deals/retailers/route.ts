import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// List retailer configs for the current workspace, with latest week status.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const retailers = await prisma.retailer.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { displayName: "asc" },
    include: {
      dealWeeks: {
        where: { workspaceId: workspace.id },
        orderBy: { weekStart: "desc" },
        take: 1,
        select: { id: true, weekStart: true, status: true, _count: { select: { deals: true } } },
      },
    },
  });
  return NextResponse.json({ retailers });
}

// Update a retailer config (storeConfig JSON, affiliate template, active flag).
export async function PUT(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const { id, storeConfig, affiliateUrlTemplate, active, displayName, logoUrl } = await req.json();
  if (!id) return NextResponse.json({ error: "Retailer id required." }, { status: 400 });

  const existing = await prisma.retailer.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) return NextResponse.json({ error: "Retailer not found." }, { status: 404 });

  let parsedConfig: string | undefined;
  if (storeConfig !== undefined) {
    try {
      const obj = typeof storeConfig === "string" ? JSON.parse(storeConfig) : storeConfig;
      parsedConfig = JSON.stringify(obj);
    } catch {
      return NextResponse.json({ error: "storeConfig must be valid JSON." }, { status: 400 });
    }
  }

  const retailer = await prisma.retailer.update({
    where: { id },
    data: {
      ...(parsedConfig !== undefined ? { storeConfig: parsedConfig } : {}),
      ...(affiliateUrlTemplate !== undefined ? { affiliateUrlTemplate: affiliateUrlTemplate || null } : {}),
      ...(active !== undefined ? { active: !!active } : {}),
      ...(displayName ? { displayName: String(displayName).slice(0, 80) } : {}),
      ...(logoUrl !== undefined ? { logoUrl: String(logoUrl).trim().slice(0, 500) || null } : {}),
    },
  });
  return NextResponse.json({ retailer });
}
