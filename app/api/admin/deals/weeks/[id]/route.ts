import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// One week with its deals, for the review screen.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const week = await prisma.dealWeek.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: {
      retailer: { select: { displayName: true, slug: true, pipeline: true } },
      deals: { orderBy: [{ sortOrder: "asc" }] },
    },
  });
  if (!week) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ week });
}

// Publish / unpublish a week. Body: { status: "published" | "draft" }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const { status } = await req.json();
  if (status !== "published" && status !== "draft") {
    return NextResponse.json({ error: "status must be published or draft." }, { status: 400 });
  }
  const week = await prisma.dealWeek.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
  if (!week) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const updated = await prisma.dealWeek.update({
    where: { id: params.id },
    data: {
      status,
      publishedAt: status === "published" ? new Date() : null,
    },
  });
  return NextResponse.json({ week: updated });
}
