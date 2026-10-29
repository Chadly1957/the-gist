import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { ensureSeedMinis, miniTeaser } from "@/lib/minis";

export const dynamic = "force-dynamic";

// Public teaser for one guide. Returns the title, the question, option
// names, and block counts only. Full guide content never leaves the server
// on this route.
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const workspace = await getWorkspace();
  await ensureSeedMinis(workspace.id, workspace.slug);
  const mini = await basePrisma.mini.findFirst({
    where: { workspaceId: workspace.id, slug: params.slug, active: true },
    select: { title: true, question: true, content: true },
  });
  if (!mini) {
    return NextResponse.json({ error: "That guide is not available." }, { status: 404 });
  }
  return NextResponse.json({ teaser: miniTeaser(mini) });
}
