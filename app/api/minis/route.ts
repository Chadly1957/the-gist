import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";
import { basePrisma } from "@/lib/db-base";
import { ensureSeedMinis } from "@/lib/minis";

export const dynamic = "force-dynamic";

// GET /api/minis — active guides for this workspace (public listing fields
// only: title, question, slug, price, cover image). Used by the shop page's
// guide cards.
// Full guide content never leaves the server on this route; the buy page
// teaser and the gated portal remain the only content surfaces.
export async function GET() {
  const workspace = await getWorkspace();
  await ensureSeedMinis(workspace.id, workspace.slug);
  const minis = await basePrisma.mini.findMany({
    where: { workspaceId: workspace.id, active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, question: true, slug: true, priceCents: true, imageUrl: true },
  });
  return NextResponse.json({ minis });
}
