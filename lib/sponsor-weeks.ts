import { basePrisma } from "./db-base";

// Sponsor campaign packages (October 2026 restructure): one buyer-facing
// product, the 7-Issue Featured Campaign, sold per market with a both-cities
// bundle. A campaign runs Monday-Sunday (7 consecutive daily issues) in the
// in-article featured placement, 2 slots per city per week. The legacy
// weekly Presenting Sponsor tier is retired from sale (presenting placement
// is partnership-only now); its config stays so historical bookings,
// availability math for old rows, and admin tools keep working.
export const WEEK_TIERS = {
  presenting: { priceCents: 15000, slots: 1, label: "Presenting Sponsor", adType: "presenting", sellable: false },
  standard: { priceCents: 15000, slots: 2, label: "7-Issue Featured Campaign", adType: "in_article", sellable: true },
} as const;
export type WeekTier = keyof typeof WEEK_TIERS;

// Campaign price by workspace slug. Any other workspace falls back to the
// Decatur price until it gets its own market pricing.
export const CAMPAIGN_PRICE_CENTS_BY_SLUG: Record<string, number> = {
  decatur: 15000,
  effingham: 9900,
};
export function campaignPriceCents(workspaceSlug: string): number {
  return CAMPAIGN_PRICE_CENTS_BY_SLUG[workspaceSlug] ?? WEEK_TIERS.standard.priceCents;
}

// Both-cities bundle: one checkout covering the same week in both markets.
// The discount vs buying separately (150 + 99 = 249) is split across the two
// bookings proportionally so per-city revenue stays honest and sums exactly.
export const CAMPAIGN_BUNDLE_PRICE_CENTS = 22900;
export const CAMPAIGN_BUNDLE_SLUGS = ["decatur", "effingham"] as const;
export function bundleShareCents(workspaceSlug: string): number {
  const total = CAMPAIGN_BUNDLE_SLUGS.reduce((sum, slug) => sum + campaignPriceCents(slug), 0);
  const idx = CAMPAIGN_BUNDLE_SLUGS.indexOf(workspaceSlug as (typeof CAMPAIGN_BUNDLE_SLUGS)[number]);
  if (idx < 0) return CAMPAIGN_BUNDLE_PRICE_CENTS;
  if (idx === CAMPAIGN_BUNDLE_SLUGS.length - 1) {
    // Last market takes the remainder so shares always sum to the bundle price.
    return CAMPAIGN_BUNDLE_PRICE_CENTS - CAMPAIGN_BUNDLE_SLUGS.slice(0, -1).reduce((sum, slug) => sum + bundleShareCents(slug), 0);
  }
  return Math.round((CAMPAIGN_BUNDLE_PRICE_CENTS * campaignPriceCents(workspaceSlug)) / total);
}

export const HOLD_MINUTES = 10;
// Bookings that occupy a slot: the buyer is mid-checkout, has paid, or the
// slot was filled by an admin comp/house placement.
const OCCUPYING_STATUSES = ["pending_payment", "paid", "comped"];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysISO(dateStr: string, n: number): string {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Monday (YYYY-MM-DD) of the week containing the given date. */
export function mondayOf(dateStr: string): string {
  const d = parseISODate(dateStr);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

/** Next 8 sponsor weeks, always starting with the coming Monday (full weeks only). */
export function upcomingSponsorWeeks(count = 8): string[] {
  const today = new Date();
  const thisMonday = mondayOf(toISODate(today));
  const weeks: string[] = [];
  for (let i = 1; i <= count; i++) weeks.push(addDaysISO(thisMonday, i * 7));
  return weeks;
}

/**
 * Weeks a buyer may book right now, for the admin and public flows. The
 * current week is included only on Monday before the newsletter goes out:
 * once Monday's issue is sent the week is partial and booking starts with
 * next Monday. Server dates are UTC (Vercel), which matches the existing
 * week math; the newsletter sends on weekday mornings, so the boundary
 * cases (e.g. Sunday night UTC = the coming week, fully unsent) behave
 * correctly.
 */
export async function bookableSponsorWeeks(workspaceId: string, count = 8): Promise<string[]> {
  const today = toISODate(new Date());
  const thisMonday = mondayOf(today);
  // 1 = Monday. Only Monday can still be a full, unsent week.
  let includeCurrent = parseISODate(today).getDay() === 1;
  if (includeCurrent) {
    const sent = await basePrisma.newsletterSend.findFirst({
      where: {
        workspaceId,
        status: "sent",
        sentAt: { gte: new Date(`${thisMonday}T00:00:00Z`) },
      },
      select: { id: true },
    });
    includeCurrent = !sent;
  }
  const start = includeCurrent ? 0 : 1;
  const weeks: string[] = [];
  for (let i = start; i < start + count; i++) weeks.push(addDaysISO(thisMonday, i * 7));
  return weeks;
}

export function isValidTier(tier: string): tier is WeekTier {
  return tier === "presenting" || tier === "standard";
}

/** Tiers a buyer may purchase right now (legacy tiers validate but do not sell). */
export function isSellableTier(tier: string): tier is WeekTier {
  return isValidTier(tier) && WEEK_TIERS[tier].sellable;
}

export function formatWeekRange(weekStart: string): string {
  const fmt = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${fmt(weekStart)} - ${fmt(addDaysISO(weekStart, 6))}`;
}

export type WeekState = "available" | "one_left" | "sold";

export interface TierAvailability {
  tier: WeekTier;
  state: WeekState;
  taken: number;
  slots: number;
}

export interface WeekAvailability {
  weekStart: string;
  label: string;
  tiers: TierAvailability[];
}

/**
 * Run fn inside a transaction holding a row lock on the SponsorWeek row,
 * creating the row if needed. This makes hold creation and hold->booking
 * conversion atomic: two buyers can never take the same slot.
 */
export async function withWeekLock<T>(
  workspaceId: string,
  weekStart: string,
  fn: (tx: Omit<typeof basePrisma, "$transaction" | "$extends">) => Promise<T>
): Promise<T> {
  return basePrisma.$transaction(async (tx) => {
    // Upsert is atomic: no race between concurrent transactions, and unlike
    // a caught create-conflict it never leaves the transaction aborted.
    const week = await tx.sponsorWeek.upsert({
      where: { workspaceId_weekStart: { workspaceId, weekStart } },
      create: { workspaceId, weekStart },
      update: {},
      select: { id: true },
    });
    await tx.$queryRaw`SELECT id FROM "SponsorWeek" WHERE id = ${week.id} FOR UPDATE`;
    return fn(tx as Omit<typeof basePrisma, "$transaction" | "$extends">);
  });
}

/** Count occupying holds + bookings for a tier inside a locked transaction. */
export async function countTaken(
  tx: { sponsorHold: { count(a: unknown): Promise<number> }; sponsorWeekBooking: { count(a: unknown): Promise<number> } },
  workspaceId: string,
  weekId: string,
  tier: WeekTier,
  excludeHoldId?: string
): Promise<number> {
  const now = new Date();
  const holdWhere: Record<string, unknown> = { workspaceId, weekId, tier, expiresAt: { gt: now } };
  // When converting a hold into a booking, the buyer's own hold must not
  // count against capacity (it would make a 1-slot tier look full).
  if (excludeHoldId) holdWhere.id = { not: excludeHoldId };
  const [holds, bookings] = await Promise.all([
    tx.sponsorHold.count({ where: holdWhere }),
    tx.sponsorWeekBooking.count({ where: { workspaceId, weekId, tier, status: { in: OCCUPYING_STATUSES } } }),
  ]);
  return holds + bookings;
}

export async function getWeeksAvailability(workspaceId: string): Promise<WeekAvailability[]> {
  const now = new Date();
  const weeks = await bookableSponsorWeeks(workspaceId);
  // All issue dates across the upcoming weeks (campaigns run Mon-Sun).
  const issueDates = weeks.flatMap((w) => [0, 1, 2, 3, 4, 5, 6].map((o) => addDaysISO(w, o)));
  const [holds, bookings, dayRows] = await Promise.all([
    basePrisma.sponsorHold.findMany({
      where: { workspaceId, week: { weekStart: { in: weeks } }, expiresAt: { gt: now } },
      select: { tier: true, week: { select: { weekStart: true } } },
    }),
    basePrisma.sponsorWeekBooking.findMany({
      where: { workspaceId, week: { weekStart: { in: weeks } }, status: { in: OCCUPYING_STATUSES } },
      select: { tier: true, week: { select: { weekStart: true } } },
    }),
    // Standalone day-level admin placements (sponsorWeekBookingId IS NULL).
    // Projected week rows carry sponsorWeekBookingId, so they are excluded
    // here and counted once via the weekly bookings above.
    basePrisma.adBooking.findMany({
      where: {
        workspaceId,
        date: { in: issueDates },
        sponsorWeekBookingId: null,
        type: { in: ["in_article", "presenting"] },
        status: { in: ["approved", "pending_review", "pending_payment"] },
      },
      select: { date: true, type: true },
    }),
  ]);
  const takenByWeekTier = new Map<string, number>();
  for (const r of [...holds, ...bookings]) {
    const key = `${r.week.weekStart}:${r.tier}`;
    takenByWeekTier.set(key, (takenByWeekTier.get(key) ?? 0) + 1);
  }
  // A campaign package needs one free slot on EVERY day Mon-Sun.
  // Fold day-level fills in as: weeklyTaken + max over the week's days of
  // standalone day usage, so a single-day admin fill shows real scarcity.
  const dayUsageByDate = new Map<string, Map<string, number>>();
  for (const r of dayRows) {
    const tier = r.type === "presenting" ? "presenting" : "standard";
    let m = dayUsageByDate.get(r.date);
    if (!m) { m = new Map(); dayUsageByDate.set(r.date, m); }
    m.set(tier, (m.get(tier) ?? 0) + 1);
  }
  return weeks.map((weekStart) => ({
    weekStart,
    label: formatWeekRange(weekStart),
    tiers: (Object.keys(WEEK_TIERS) as WeekTier[]).map((tier) => {
      const weeklyTaken = takenByWeekTier.get(`${weekStart}:${tier}`) ?? 0;
      let maxDay = 0;
      for (let o = 0; o < 7; o++) {
        const m = dayUsageByDate.get(addDaysISO(weekStart, o));
        if (m) maxDay = Math.max(maxDay, m.get(tier) ?? 0);
      }
      const taken = weeklyTaken + maxDay;
      const slots = WEEK_TIERS[tier].slots;
      const state: WeekState = taken >= slots ? "sold" : taken === slots - 1 ? "one_left" : "available";
      return { tier, state, taken, slots };
    }),
  }));
}

/**
 * Project a paid campaign booking into 7 day-based AdBooking rows (Mon-Sun)
 * so the existing send pipeline, analytics, and portal keep working
 * unchanged. Copy handling: buyer's own copy goes live immediately; when
 * Chad writes the copy the rows wait in pending_review until he finalizes
 * them.
 */
export interface WeekBookingProjectionInput {
  id: string;
  workspaceId: string;
  sponsorId: string;
  tier: WeekTier;
  weekStart: string;
  businessName: string;
  website: string | null;
  logoUrl: string;
  aboutText: string;
  finalAdCopy: string | null;
  chadWritesCopy: boolean;
  // $0 comp/house placement: projected rows are unpaid but marked comp.
  isComp?: boolean;
}

/** Build the 7 Mon-Sun AdBooking rows for a paid campaign booking (pure). */
export function buildWeekProjectionRows(booking: WeekBookingProjectionInput) {
  const adType = WEEK_TIERS[booking.tier].adType;
  const copy = booking.finalAdCopy ?? booking.aboutText;
  const approved = !booking.chadWritesCopy;
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => ({
    workspaceId: booking.workspaceId,
    sponsorId: booking.sponsorId,
    type: adType,
    date: addDaysISO(booking.weekStart, offset),
    status: approved ? "approved" : "pending_review",
    isPaid: !booking.isComp,
    isComp: booking.isComp ?? false,
    headline: booking.businessName,
    body: copy,
    // Website is optional for paid buyers; the template omits the CTA button
    // when there is no URL rather than linking nowhere.
    ctaUrl: booking.website ?? "",
    ctaLabel: "Learn More",
    imageUrl: booking.logoUrl,
    presentingBlurb:
      adType === "presenting" ? `This issue is brought to you by ${booking.businessName}.` : null,
    sponsorWeekBookingId: booking.id,
    approvedAt: approved ? new Date() : null,
  }));
}

export async function projectWeekBooking(booking: WeekBookingProjectionInput): Promise<void> {
  await basePrisma.adBooking.createMany({ data: buildWeekProjectionRows(booking) });
}

/**
 * Presenting slot is a HARD cap: exactly 1 per newsletter issue, no
 * exceptions, on every path including admin. Returns true when a presenting
 * ad may be placed for the given date.
 */
export async function presentingSlotFree(workspaceId: string, date: string): Promise<boolean> {
  const existing = await basePrisma.adBooking.findFirst({
    where: { workspaceId, date, type: "presenting", status: { in: ["approved", "pending_review", "pending_payment"] } },
    select: { id: true },
  });
  return !existing;
}
