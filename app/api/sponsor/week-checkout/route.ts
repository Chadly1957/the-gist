import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";
import { normalizeUrl } from "@/lib/url";
import { optInSponsorToNewsletter } from "@/lib/sponsor-newsletter-optin";
import {
  WEEK_TIERS,
  countTaken,
  formatWeekRange,
  isValidTier,
  mondayOf,
  upcomingSponsorWeeks,
  withWeekLock,
  type WeekTier,
} from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// Convert a valid hold into a pending week booking and start Stripe Checkout.
export async function POST(req: NextRequest) {
  const {
    holdToken,
    businessName,
    contactName,
    email,
    website,
    logoUrl,
    aboutText,
    chadWritesCopy,
    subscribeNewsletter,
    portalToken,
    returnTo,
  } = await req.json();

  if (!holdToken) return NextResponse.json({ error: "Your reservation expired. Please pick a week again." }, { status: 400 });

  const trimmedBusiness = businessName?.trim();
  const trimmedContact = contactName?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  const trimmedAbout = aboutText?.trim();
  if (!trimmedBusiness || !trimmedContact || !normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Business name, contact name, and a valid email are required." }, { status: 400 });
  }
  if (!trimmedAbout || trimmedAbout.length < 20) {
    return NextResponse.json({ error: "Tell readers a little about your business (a sentence or two)." }, { status: 400 });
  }
  let normalizedWebsite: string | null = null;
  try {
    normalizedWebsite = website ? normalizeUrl(website) : null;
  } catch {
    return NextResponse.json({ error: "That website URL doesn't look right." }, { status: 400 });
  }
  // Website is optional for paid buyers; the ad simply shows no CTA button.
  if (!logoUrl || typeof logoUrl !== "string" || !logoUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Please upload your logo first." }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments are not configured right now. Please try again later." }, { status: 503 });
  }

  const workspace = await getWorkspace();
  const workspaceId = workspace.id;

  // Portal checkouts pin the booking to the sponsor's own profile instead of
  // matching by email.
  let portalProfile: { id: string } | null = null;
  if (portalToken) {
    portalProfile = await basePrisma.sponsorProfile.findFirst({
      where: { workspaceId, magicToken: portalToken },
      select: { id: true },
    });
    if (!portalProfile) {
      return NextResponse.json({ error: "Your portal link is invalid. Please reload the portal and try again." }, { status: 401 });
    }
  }
  const backToPortal = returnTo === "portal" && portalProfile;

  // Look up the hold outside the lock; re-verify inside it.
  const hold = await basePrisma.sponsorHold.findFirst({
    where: { workspaceId, holdToken, expiresAt: { gt: new Date() } },
    include: { week: { select: { id: true, weekStart: true } } },
  });
  if (!hold || !isValidTier(hold.tier) || mondayOf(hold.week.weekStart) !== hold.week.weekStart || !upcomingSponsorWeeks().includes(hold.week.weekStart)) {
    return NextResponse.json({ error: "Your reservation expired. Please pick a week again." }, { status: 400 });
  }
  const tier = hold.tier as WeekTier;
  const amountCents = WEEK_TIERS[tier].priceCents;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const appUrl = await getWorkspaceUrl();
  const tierLabel = WEEK_TIERS[tier].label;

  // Create the Stripe session first: if the slot is gone we just abandon an
  // orphan session (it expires harmlessly); the buyer's money is never at risk.
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `${workspace.name} - ${tierLabel}`,
              description: `Week of ${formatWeekRange(hold.week.weekStart)}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: normalizedEmail,
      success_url: backToPortal
        ? `${appUrl}/sponsor/portal?token=${portalToken}&booking=success`
        : `${appUrl}/sponsor/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: backToPortal
        ? `${appUrl}/sponsor/portal?token=${portalToken}&booking=cancelled`
        : `${appUrl}/sponsor/apply?cancelled=1`,
      metadata: { workspaceId, kind: "sponsor_week", tier, weekStart: hold.week.weekStart },
    });
  } catch (err) {
    console.error("week-checkout stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  try {
    await withWeekLock(workspaceId, hold.week.weekStart, async (tx) => {
      const liveHold = await tx.sponsorHold.findFirst({
        where: { workspaceId, holdToken, expiresAt: { gt: new Date() } },
      });
      if (!liveHold) throw new Error("Hold expired during checkout.");
      const taken = await countTaken(tx, workspaceId, hold.week.id, tier, liveHold.id);
      if (taken >= WEEK_TIERS[tier].slots) throw new Error("That slot just sold.");

      let profile = portalProfile
        ? { id: portalProfile.id }
        : await tx.sponsorProfile.findUnique({
            where: { workspaceId_email: { workspaceId, email: normalizedEmail } },
          });
      if (!profile) {
        profile = await tx.sponsorProfile.create({
          data: {
            workspaceId,
            businessName: trimmedBusiness,
            contactName: trimmedContact,
            email: normalizedEmail,
            website: normalizedWebsite,
          },
        });
      }

      await tx.sponsorWeekBooking.create({
        data: {
          workspaceId,
          weekId: hold.week.id,
          sponsorId: profile.id,
          tier,
          status: "pending_payment",
          amountCents,
          stripeSessionId: session.id,
          businessName: trimmedBusiness,
          contactName: trimmedContact,
          email: normalizedEmail,
          website: normalizedWebsite,
          logoUrl,
          aboutText: trimmedAbout,
          chadWritesCopy: chadWritesCopy !== false,
        },
      });
      await tx.sponsorHold.delete({ where: { id_workspaceId: { id: liveHold.id, workspaceId } } });
    });
  } catch (err) {
    console.error("week-checkout reservation error:", err);
    // Stripe session is orphaned and will expire; try to cancel it to be tidy.
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      /* already completed or expired */
    }
    const msg = err instanceof Error && err.message === "That slot just sold."
      ? "That slot just sold. Please pick another week."
      : "Could not reserve your slot. Please try again.";
    return NextResponse.json({ error: msg }, { status: err instanceof Error && err.message === "That slot just sold." ? 409 : 500 });
  }

  // Newsletter opt-in is explicit consent from the checkbox, independent of
  // whether the Stripe payment completes. It must never fail the checkout.
  if (subscribeNewsletter === true) {
    try {
      await optInSponsorToNewsletter(normalizedEmail, trimmedContact);
    } catch (err) {
      console.error("sponsor newsletter opt-in error:", err);
    }
  }

  return NextResponse.json({ url: session.url });
}
