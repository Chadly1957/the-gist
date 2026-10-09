import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { refreshAllRetailers } from "@/lib/deals/refresh";
import { sendWeeklyDigest } from "@/lib/deals/digest";

export const dynamic = "force-dynamic";
// Refresh + publish + send can take a while across all retailers.
export const maxDuration = 300;

// One-call Friday morning run: refresh all automated retailers, publish the
// fresh draft weeks, then send the weekly digest to opted-in buyers.
// Secured by bearer secret (WEEKLY_RUN_SECRET): the scheduled agent can't
// hold an admin session. Body: { secret*, workspaceSlug*: "decatur" | "effingham" }
export async function POST(req: NextRequest) {
  const configured = process.env.WEEKLY_RUN_SECRET;
  if (!configured) {
    return NextResponse.json({ error: "Weekly run not configured" }, { status: 500 });
  }
  const body = (await req.json().catch(() => null)) as {
    secret?: string;
    workspaceSlug?: string;
  } | null;
  if (!body || body.secret !== configured) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!body.workspaceSlug) {
    return NextResponse.json({ error: "Body needs workspaceSlug." }, { status: 400 });
  }
  const workspace = await basePrisma.workspace.findUnique({
    where: { slug: body.workspaceSlug },
  });
  if (!workspace) {
    return NextResponse.json(
      { error: `Workspace "${body.workspaceSlug}" not found.` },
      { status: 400 }
    );
  }

  // 1. Refresh all automated retailers into draft weeks.
  const refresh = await refreshAllRetailers(workspace.id);

  // 2. Publish the fresh draft weeks from this run.
  const published: string[] = [];
  for (const o of refresh) {
    if (!o.ok || !o.weekStart) continue;
    const retailer = await basePrisma.retailer.findFirst({
      where: { workspaceId: workspace.id, slug: o.retailerSlug },
      select: { id: true },
    });
    if (!retailer) continue;
    const week = await basePrisma.dealWeek.findFirst({
      where: {
        workspaceId: workspace.id,
        retailerId: retailer.id,
        weekStart: o.weekStart,
      },
      select: { id: true, status: true },
    });
    if (week && week.status === "draft") {
      await basePrisma.dealWeek.update({
        where: { id: week.id },
        data: { status: "published", publishedAt: new Date() },
      });
      published.push(o.retailerSlug);
    }
  }

  // 3. Send the digest to opted-in buyers.
  const digest = await sendWeeklyDigest(workspace.id);

  return NextResponse.json({
    ok: true,
    workspace: body.workspaceSlug,
    refresh,
    published,
    digest,
  });
}
