import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { getDayDiscount, applyDiscount } from "@/lib/discount";

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

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + n);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
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
  const basePriceCents = settingKey && allSettings[settingKey]
    ? parseInt(allSettings[settingKey], 10)
    : (DEFAULT_PRICES_CENTS[bookingType] ?? 1500);

  const takenStatuses = ["pending_review", "approved", "pending_payment"];
  const inArticleLimit = 2;

  // Resolve conflicts: auto-substitute unavailable dates with next available after the window
  const requestedDates: string[] = [...dates].sort();
  const confirmedDates: string[] = [];
  const substitutions: Array<{ original: string; replacement: string }> = [];
  const lastRequested = requestedDates[requestedDates.length - 1];
  let searchAnchor = lastRequested;

  for (const date of requestedDates) {
    if (bookingType === "wordy") {
      const existing = await db.wordyBooking.findFirst({
        where: { date, status: { in: takenStatuses } },
      });
      if (!existing) {
        confirmedDates.push(date);
        continue;
      }
    } else {
      const existing = await prisma.adBooking.findMany({
        where: { date, type: bookingType, status: { in: takenStatuses } },
      });
      const limit = bookingType === "in_article" ? inArticleLimit : 1;
      if (existing.length < limit) {
        confirmedDates.push(date);
        continue;
      }
    }

    // Conflict — find next available after the window
    let offset = 1;
    while (true) {
      const candidate = addDays(searchAnchor, offset);
      const alreadyChosen =
        confirmedDates.includes(candidate) || substitutions.some((s) => s.replacement === candidate);

      if (!alreadyChosen) {
        let available = false;
        if (bookingType === "wordy") {
          const ex = await db.wordyBooking.findFirst({ where: { date: candidate, status: { in: takenStatuses } } });
          available = !ex;
        } else {
          const ex = await prisma.adBooking.findMany({
            where: { date: candidate, type: bookingType, status: { in: takenStatuses } },
          });
          const limit = bookingType === "in_article" ? inArticleLimit : 1;
          available = ex.length < limit;
        }

        if (available) {
          substitutions.push({ original: date, replacement: candidate });
          confirmedDates.push(candidate);
          if (candidate > searchAnchor) searchAnchor = candidate;
          break;
        }
      }

      offset++;
      if (offset > 365) break; // safety valve
    }
  }

  const totalDays = confirmedDates.length;
  const discountPct = bookingType === "wordy" ? 0 : getDayDiscount(totalDays);
  const unitPriceCents = bookingType === "wordy" ? basePriceCents : applyDiscount(basePriceCents, totalDays);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const placementName = PLACEMENT_NAMES[bookingType] ?? bookingType;

  const discountLabel = discountPct > 0 ? ` (${discountPct}% multi-day discount)` : "";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: confirmedDates.map((date) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: `${placementName} — ${formatDate(date)}${discountLabel}`,
          description: `The Gist Decatur newsletter placement on ${formatDate(date)}`,
        },
        unit_amount: unitPriceCents,
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
  for (const date of confirmedDates) {
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
          discountPct,
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

  return NextResponse.json({ url: session.url, substitutions, discountPct });
}
