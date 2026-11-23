import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import {
  ensureDealsYearCatalogItem,
  getDailyTasksStatus,
  getDealsAccess,
  getRewardConfig,
  getRewardsSummary,
} from "@/lib/rewards";
import { listStorefrontItems } from "@/lib/rewards-store";

export const dynamic = "force-dynamic";

// Reader Rewards summary for one reader, identified by email — the same
// identity the rest of the reader surface uses (the /contest page mints
// referral links from an email alone; Deals access is email-keyed too).
// POST { email } -> balance, all-time earned/redeemed, recent activity,
// the redemption catalog, and the reader's current Deals access.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const workspace = await getWorkspace();

  const subscriber = await basePrisma.subscriber.findFirst({
    where: { workspaceId: workspace.id, email: normalizedEmail, active: true },
    select: { id: true, firstName: true },
  });
  if (!subscriber) {
    return NextResponse.json({ found: false });
  }

  const item = await ensureDealsYearCatalogItem(basePrisma, workspace.id);
  const [summary, dealsAccess, referralCode, config, appUrl, storefrontItems, dailyTasks] = await Promise.all([
    getRewardsSummary(basePrisma, workspace.id, subscriber.id),
    getDealsAccess(basePrisma, workspace.id, normalizedEmail),
    basePrisma.referralCode.findUnique({
      where: { subscriberId: subscriber.id },
      select: { code: true },
    }),
    getRewardConfig(basePrisma, workspace.id),
    getWorkspaceUrl(),
    listStorefrontItems(basePrisma, workspace.id, workspace.name),
    getDailyTasksStatus(basePrisma, workspace.id, subscriber.id),
  ]);

  return NextResponse.json({
    found: true,
    firstName: subscriber.firstName,
    balance: summary.balance,
    totalEarned: summary.totalEarned,
    totalRedeemed: summary.totalRedeemed,
    entries: summary.recentEntries.map((entry) => ({
      kind: entry.kind,
      points: entry.points,
      note: entry.note,
      createdAt: entry.createdAt,
    })),
    catalog: [
      {
        key: item.key,
        title: item.title,
        description: item.description,
        costPoints: item.costPoints,
        kind: item.kind,
      },
    ],
    dealsAccess: {
      hasAccess: dealsAccess.hasAccess,
      isLifetime: dealsAccess.isLifetime,
      accessUntil: dealsAccess.accessUntil,
    },
    referralCode: referralCode?.code ?? null,
    // The reader's full referral link, built exactly the way the giveaway
    // page builds it (app/api/contest/route.ts): workspace URL + /refer/<code>.
    referralLink: referralCode ? `${appUrl}/refer/${referralCode.code}` : null,
    // The live per-referral point value (Admin > Settings) so the page copy
    // can never go stale when the value changes.
    referralSignupPoints: config.referralSignupPoints,
    // Today's to-do list: the four daily earning tasks with their live
    // values and whether this reader has already earned each one today
    // (from today's ledger entries, so it always matches what was
    // actually paid). Each link carries the reader's email the same way
    // the referral link above is built, so arriving at the game or the
    // Directory identifies them for the award.
    dailyTasks: dailyTasks.map((task) => ({
      key: task.key,
      points: task.points,
      done: task.done,
      href: `${appUrl}/${task.key === "directory" ? "partners" : task.key}?email=${encodeURIComponent(normalizedEmail)}`,
    })),
    // Points-as-money storefront: everything for sale in this workspace
    // (Deals book + active products, availability already resolved) and
    // the live spend rate, so the portal can offer points off any of it
    // with no per-item setup.
    storefront: {
      pointsPerDollar: config.pointsPerDollar,
      items: storefrontItems,
    },
  });
}
