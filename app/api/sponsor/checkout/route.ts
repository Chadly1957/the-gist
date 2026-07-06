import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const PLACEMENT_NAMES: Record<string, string> = {
  in_article: "Standard Ad",
  presenting: "Presenting Sponsorship",
  wordy: "Decatur Wordy Sponsorship",
};

const DEFAULT_PRICES_CENTS: Record<string, number> = {
  in_article: 1500,
  presenting: 2500,
  wordy: 2000,
};

const PRICE_SETTING_KEYS: Record<string, string> = {
  in_article: "stripe_price_in_article_cents",
  presenting: "stripe_price_presenting_cents",
  wordy: "stripe_price_wordy_cents",
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function POST(req: NextRequest) {
  const {
    token,
    bookingType,
    dates,
    headline,
    body,
    ctaUrl,
    ctaLabel,
    imageUrl,
    presentingBlurb,
  } = await req.json();

  if (!token) return NextResponse.json({ error: "Token required." }, { status: 401 });
  if (!bookingType || !dates?.length || !headline || !ctaUrl) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  // Load price from settings (fall back to defaults)
  const allSettings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r: { key: string; value: string }) => [r.key, r.value])
  );
  const settingKey = PRICE_SETTING_KEYS[bookingType];
  const priceCents = settingKey && allSettings[settingKey]
    ? parseInt(allSettings[settingKey], 10)
    : (DEFAULT_PRICES_CENTS[bookingType] ?? 1500);

  // Check availability for all requested dates
  const takenStatuses = ["pending_review", "approved", "pending_payment"];
  for (const date of dates) {
    if (bookingType === "wordy") {
      const existing = await db.wordyBooking.findFirst({
        where: { date, status: { in: takenStatuses } },
      });
      if (existing) {
        return NextResponse.json(
          { error: `${date} is already booked for a Wordy sponsorship.` },
          { status: 409 }
        );
      }
    } else {
      const existing = await prisma.adBooking.findMany({
        where: { date, type: bookingType, status: { in: takenStatuses } },
      });
      const limit = bookingType === "in_article" ? 2 : 1;
      if (existing.length >= limit) {
        return NextResponse.json(
          { error: `${date} is already fully booked for this placement type.` },
          { status: 409 }
        );
      }
    }
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const placementName = PLACEMENT_NAMES[bookingType] ?? bookingType;

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: (dates as string[]).map((date) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: `${placementName} — ${formatDate(date)}`,
          description: `The Gist Decatur newsletter placement on ${formatDate(date)}`,
        },
        unit_amount: priceCents,
      },
      quantity: 1,
    })),
    mode: "payment",
    success_url: `${appUrl}/sponsor/portal?token=${token}&booking=success`,
    cancel_url: `${appUrl}/sponsor/portal?token=${token}&booking=cancelled`,
    customer_email: profile.email,
    metadata: {
      bookingModel: bookingType === "wordy" ? "wordy" : "ad",
      token,
    },
  });

  // Create bookings with pending_payment status so dates are reserved
  for (const date of dates as string[]) {
    if (bookingType === "wordy") {
      await db.wordyBooking.create({
        data: {
          sponsorId: profile.id,
          date,
          headline: headline.trim(),
          body: body?.trim() || "",
          ctaUrl: ctaUrl.trim(),
          ctaLabel: ctaLabel?.trim() || "Learn More",
          imageUrl: imageUrl?.trim() || null,
          status: "pending_payment",
          stripeSessionId: session.id,
        },
      });
    } else {
      await prisma.adBooking.create({
        data: {
          sponsorId: profile.id,
          type: bookingType,
          date,
          headline: headline.trim(),
          body: body?.trim() || "",
          ctaUrl: ctaUrl.trim(),
          ctaLabel: ctaLabel?.trim() || "Learn More",
          imageUrl: imageUrl?.trim() || null,
          presentingBlurb: presentingBlurb?.trim() || null,
          status: "pending_payment",
          stripeSessionId: session.id,
        },
      });
    }
  }

  return NextResponse.json({ url: session.url });
}
