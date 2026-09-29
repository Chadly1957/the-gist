import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getAdminSession } from "@/lib/auth";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";

export const dynamic = "force-dynamic";

/**
 * Per-issue standard-slot override (spec section 12). The "2 Standard slots
 * per newsletter" limit is a soft cap: admin can raise maxInArticle for a
 * given date to run extra standard slots (house fills or overbooking).
 * The send pipeline reads this first and falls back to the in_article_count
 * setting. Filling slots with house/free content needs no override: house
 * ads are ordinary in_article rows.
 */

// List overrides for a date range (for the admin scheduling UI).
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = DEFAULT_WORKSPACE_ID;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "0000-00-00";
  const to = searchParams.get("to") ?? "9999-99-99";

  const configs = await basePrisma.sponsorDayConfig.findMany({
    where: { workspaceId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ configs });
}

// Set (or clear) the override for one date. maxInArticle < 2 clears it.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = DEFAULT_WORKSPACE_ID;
  const { date, maxInArticle } = await req.json();

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }
  const n = parseInt(maxInArticle, 10);
  if (Number.isNaN(n) || n < 0 || n > 10) {
    return NextResponse.json({ error: "maxInArticle must be 0-10." }, { status: 400 });
  }

  if (n < 2) {
    await basePrisma.sponsorDayConfig.deleteMany({ where: { workspaceId, date } });
    return NextResponse.json({ cleared: true });
  }

  const config = await basePrisma.sponsorDayConfig.upsert({
    where: { workspaceId_date: { workspaceId, date } },
    create: { workspaceId, date, maxInArticle: n },
    update: { maxInArticle: n },
  });
  return NextResponse.json({ config });
}
