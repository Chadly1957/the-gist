import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { ensureSeedMinis, getMiniAccessProfile, miniTeaser } from "@/lib/minis";

export const dynamic = "force-dynamic";

// Email gate for one guide. Returns the visitor's state and the guide teaser
// only. It never returns guide content and never returns a portal token:
// owners get their portal link by email (see /api/minis/magic-link).
export async function POST(req: NextRequest) {
  const { email, slug } = await req.json();
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "A guide is required." }, { status: 400 });
  }

  const workspace = await getWorkspace();
  await ensureSeedMinis(workspace.id, workspace.slug);
  const mini = await basePrisma.mini.findFirst({
    where: { workspaceId: workspace.id, slug, active: true },
    select: { title: true, question: true, content: true },
  });
  if (!mini) {
    return NextResponse.json({ error: "That guide is not available." }, { status: 404 });
  }

  const profile = await getMiniAccessProfile(workspace.id, normalizedEmail);
  const state = profile.hasDeals
    ? "deals_owner"
    : profile.ownedMiniSlugs.includes(slug)
      ? "owns_this"
      : profile.ownedMiniIds.length > 0
        ? "owns_other"
        : "new";

  return NextResponse.json({
    state,
    teaser: miniTeaser(mini),
    upgradePriceCents: profile.upgradePriceCents,
  });
}
