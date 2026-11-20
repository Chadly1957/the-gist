import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import {
  RewardsError,
  ensureDealsYearCatalogItem,
  redeemCatalogItem,
} from "@/lib/rewards";

export const dynamic = "force-dynamic";

// Redeem a catalog item with points. Phase 1 has exactly one item (a free
// year of Deals), and its grant is a clean write, so redemption fulfills
// immediately inside lib/rewards.ts: redemption row + negative ledger
// entry + the Deals purchase row land in one transaction. The buyer then
// gets the usual Deals magic-link email so they can open their book.
export async function POST(req: NextRequest) {
  const { email, itemKey } = await req.json().catch(() => ({ email: "", itemKey: "" }));
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!itemKey || typeof itemKey !== "string") {
    return NextResponse.json({ error: "An item is required." }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const workspace = await getWorkspace();

  const subscriber = await basePrisma.subscriber.findFirst({
    where: { workspaceId: workspace.id, email: normalizedEmail, active: true },
    select: { id: true },
  });
  if (!subscriber) {
    return NextResponse.json(
      { error: "We couldn't find an active subscription for that email." },
      { status: 404 }
    );
  }

  await ensureDealsYearCatalogItem(basePrisma, workspace.id);

  try {
    const result = await redeemCatalogItem(basePrisma, {
      workspaceId: workspace.id,
      subscriberId: subscriber.id,
      email: normalizedEmail,
      itemKey,
    });
    try {
      const { sendCouponBookMagicLinkEmail } = await import("@/lib/coupon-book-email");
      await sendCouponBookMagicLinkEmail({
        workspaceId: workspace.id,
        to: normalizedEmail,
        magicToken: result.magicToken,
      });
    } catch {
      // The year is granted either way; the email is a convenience copy of
      // the link the reader can also reach from the Deals page.
    }
    return NextResponse.json({
      ok: true,
      code: result.code,
      pointsSpent: result.pointsSpent,
      balanceAfter: result.balanceAfter,
      accessUntil: result.accessUntil,
    });
  } catch (error) {
    if (error instanceof RewardsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2034"
    ) {
      // Serializable conflict: a second redemption raced this one and won.
      return NextResponse.json(
        { error: "That redemption raced another one. Please refresh and try again.", code: "conflict" },
        { status: 409 }
      );
    }
    console.error("Reader Rewards redemption failed", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
