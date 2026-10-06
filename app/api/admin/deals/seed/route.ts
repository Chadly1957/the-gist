import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { seedRetailers } from "@/lib/deals/seed";

export const dynamic = "force-dynamic";

// One-click idempotent retailer seeding for the current workspace.
export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const result = await seedRetailers(workspace.id);
  return NextResponse.json({ workspace: workspace.id, ...result });
}
