import { basePrisma } from "@/lib/db-base";
import { withWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { runDealsNurture } from "@/lib/deals-nurture";

export const dynamic = "force-dynamic";

// Hourly: walk new subscribers through the post-signup Deals nurture
// sequence (touches at 2h / 24h / 72h / day 5) until they buy the book,
// opt out of deal reminders, or unsubscribe.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    new URL(req.url).searchParams.get("secret");
  if (!secret || provided !== secret)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaces = await basePrisma.workspace.findMany();
  const results = [];
  for (const workspace of workspaces) {
    try {
      const result = await withWorkspace(workspace, () => runDealsNurture());
      results.push({ workspace: workspace.slug, status: 200, ...result });
    } catch (error) {
      console.error("Deals nurture failed", workspace.id, error);
      results.push({ workspace: workspace.slug, status: 500 });
    }
  }
  return NextResponse.json(
    { results },
    { status: results.some((r) => r.status === 500) ? 500 : 200 }
  );
}
