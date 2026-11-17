import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { STARRED_LIVE_STATUSES, STARRED_MAX_SPOTS, STARRED_PRICE_CENTS } from "@/lib/starred-board";

export const dynamic = "force-dynamic";

// Public availability for Starred Community Board spots in this city:
// how many of the 5 are taken. No auth; the landing page and the signup
// add-on fetch it to render the "n of 5 left" badge and to hide the offer
// when sold out. A failure on the caller side must never block the page.
export async function GET(_req: NextRequest) {
  const workspace = await getWorkspace();
  const taken = await prisma.starredBoardSubscription.count({
    where: { status: { in: [...STARRED_LIVE_STATUSES] } },
  });
  const spotsLeft = Math.max(0, STARRED_MAX_SPOTS - taken);
  return NextResponse.json({
    spotsTotal: STARRED_MAX_SPOTS,
    spotsTaken: taken,
    spotsLeft,
    state: spotsLeft === 0 ? "sold" : spotsLeft === 1 ? "one_left" : "available",
    priceCents: STARRED_PRICE_CENTS,
    workspaceId: workspace.id,
  });
}
