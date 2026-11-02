import { basePrisma } from "./db-base";

// Sponsor campaign packages (October 2026 restructure): one buyer-facing
// product, the 7-Issue Featured Campaign, sold per market with a both-cities
// bundle. A campaign runs 7 consecutive daily issues from a start day the
// buyer picks (November 2026: fixed Monday-Sunday weeks retired; a run is
// any 7 consecutive days, and SponsorWeek.weekStart now means "run start
// date", any weekday — historical Monday-start rows are just runs that
// started on a Monday). 2 slots per city per day in the in-article
// featured placement. The legacy weekly Presenting Sponsor tier is retired
// from sale (presenting placement is partnership-only now); its config
// stays so historical bookings, availability math for old rows, and admin
// tools keep working.
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

/** Sunday (YYYY-MM-DD) of the week containing the given date. */
export function sundayOf(dateStr: string): string {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = Sunday
  return toISODate(d);
}

/**
 * A buyer-chosen campaign start day is bookable from tomorrow through 8
 * weeks out. Tomorrow is the floor: by the time anyone books, today's
 * issue has already gone out, so a same-day start would deliver 6 issues
 * instead of the promised 7.
 */
export function isBookableStartDate(start: unknown): start is string {
  if (typeof start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
  if (toISODate(parseISODate(start)) !== start) return false; // e.g. Feb 31
  const today = toISODate(new Date());
  return start >= addDaysISO(today, 1) && start <= addDaysISO(today, 56);
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
 * Calendar weeks for DISPLAY surfaces (the admin availability strip):
 * Sunday-Saturday weeks, starting with the coming Sunday. Buyers no
 * longer pick from this list — they choose any start day and
 * isBookableStartDate + countRunTaken govern what can sell — but admin
 * still plans around calendar weeks, and this keeps that view honest.
 * The current week is included only on Sunday before the newsletter goes
 * out: once Sunday's issue is sent the week is partial. Server dates are
 * UTC (Vercel), which matches the existing week math.
 */
export async function bookableSponsorWeeks(workspaceId: string, count = 8): Promise<string[]> {
  const today = toISODate(new Date());
  const thisSunday = sundayOf(today);
  // 0 = Sunday. Only Sunday can still be a full, unsent week.
  let includeCurrent = parseISODate(today).getDay() === 0;
  if (includeCurrent) {
    const sent = await basePrisma.newsletterSend.findFirst({
      where: {
        workspaceId,
        status: "sent",
        sentAt: { gte: new Date(`${thisSunday}T00:00:00Z`) },
      },
      select: { id: true },
    });
    includeCurrent = !sent;
  }
  const start = includeCurrent ? 0 : 1;
  const weeks: string[] = [];
  for (let i = start; i < start + count; i++) weeks.push(addDaysISO(thisSunday, i * 7));
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

/**
 * Fullest day in a 7-day window starting at firstDay: for each day, count
 * the runs (holds + bookings, by their start dates) covering that day
 * plus standalone day-level usage, and return the max. A campaign can
 * only sell when every day of its run has a free slot, so the fullest
 * day is the number that decides availability.
 */
function maxTakenOverDays(runStarts: string[], dayUsage: Map<string, number>, firstDay: string): number {
  let max = 0;
  for (let o = 0; o < 7; o++) {
    const day = addDaysISO(firstDay, o);
    let taken = dayUsage.get(day) ?? 0;
    for (const s of runStarts) {
      if (s <= day && day <= addDaysISO(s, 6)) taken++;
    }
    if (taken > max) max = taken;
  }
  return max;
}

type RunCountDb = Omit<typeof basePrisma, "$transaction" | "$extends">;

/**
 * Occupancy for a buyer-chosen 7-day run: the fullest day's taken count
 * across every overlapping run (any start date) plus standalone day
 * placements. Works inside a withWeekLock transaction or standalone.
 * When converting a hold into a booking, pass excludeHoldId so the
 * buyer's own hold does not count against them.
 */
export async function countRunTaken(
  db: RunCountDb,
  workspaceId: string,
  startDate: string,
  tier: WeekTier,
  excludeHoldId?: string
): Promise<number> {
  const now = new Date();
  const from = addDaysISO(startDate, -6);
  const to = addDaysISO(startDate, 6);
  const [holds, bookings, dayRows] = await Promise.all([
    db.sponsorHold.findMany({
      where: { workspaceId, tier, expiresAt: { gt: now }, week: { weekStart: { gte: from, lte: to } } },
      select: { id: true, week: { select: { weekStart: true } } },
    }),
    db.sponsorWeekBooking.findMany({
      where: { workspaceId, tier, status: { in: OCCUPYING_STATUSES }, week: { weekStart: { gte: from, lte: to } } },
      select: { week: { select: { weekStart: true } } },
    }),
    // Standalone day-level admin placements (sponsorWeekBookingId IS
    // NULL). Projected run rows carry sponsorWeekBookingId, so they are
    // excluded here and counted once via the run bookings above.
    db.adBooking.findMany({
      where: {
        workspaceId,
        date: { gte: startDate, lte: addDaysISO(startDate, 6) },
        sponsorWeekBookingId: null,
        type: WEEK_TIERS[tier].adType,
        status: { in: ["approved", "pending_review", "pending_payment"] },
      },
      select: { date: true },
    }),
  ]);
  const runStarts = [
    ...holds.filter((h) => h.id !== excludeHoldId).map((h) => h.week.weekStart),
    ...bookings.map((b) => b.week.weekStart),
  ];
  const dayUsage = new Map<string, number>();
  for (const r of dayRows) dayUsage.set(r.date, (dayUsage.get(r.date) ?? 0) + 1);
  return maxTakenOverDays(runStarts, dayUsage, startDate);
}

export interface RunAvailability {
  tier: WeekTier;
  state: WeekState;
  taken: number;
  slots: number;
  spotsLeft: number;
}

/** Availability for one buyer-chosen run (7 days from startDate). */
export async function getRunAvailability(
  workspaceId: string,
  startDate: string,
  tier: WeekTier
): Promise<RunAvailability> {
  const taken = await countRunTaken(basePrisma as RunCountDb, workspaceId, startDate, tier);
  const slots = WEEK_TIERS[tier].slots;
  const spotsLeft = Math.max(0, slots - taken);
  const state: WeekState = taken >= slots ? "sold" : taken === slots - 1 ? "one_left" : "available";
  return { tier, state, taken, slots, spotsLeft };
}

export async function getWeeksAvailability(workspaceId: string): Promise<WeekAvailability[]> {
  const now = new Date();
  const weeks = await bookableSponsorWeeks(workspaceId);
  if (weeks.length === 0) return [];
  const firstDay = weeks[0];
  const lastDay = addDaysISO(weeks[weeks.length - 1], 6);
  // Runs can start up to 6 days before the window and still overlap it.
  const runFrom = addDaysISO(firstDay, -6);
  const runTo = addDaysISO(lastDay, 6);
  const [holds, bookings, dayRows] = await Promise.all([
    basePrisma.sponsorHold.findMany({
      where: { workspaceId, expiresAt: { gt: now }, week: { weekStart: { gte: runFrom, lte: runTo } } },
      select: { tier: true, week: { select: { weekStart: true } } },
    }),
    basePrisma.sponsorWeekBooking.findMany({
      where: { workspaceId, status: { in: OCCUPYING_STATUSES }, week: { weekStart: { gte: runFrom, lte: runTo } } },
      select: { tier: true, week: { select: { weekStart: true } } },
    }),
    basePrisma.adBooking.findMany({
      where: {
        workspaceId,
        date: { gte: firstDay, lte: lastDay },
        sponsorWeekBookingId: null,
        type: { in: ["in_article", "presenting"] },
        status: { in: ["approved", "pending_review", "pending_payment"] },
      },
      select: { date: true, type: true },
    }),
  ]);
  const runStartsByTier = new Map<WeekTier, string[]>();
  for (const r of [...holds, ...bookings]) {
    const list = runStartsByTier.get(r.tier as WeekTier) ?? [];
    list.push(r.week.weekStart);
    runStartsByTier.set(r.tier as WeekTier, list);
  }
  const dayUsageByTierDate = new Map<string, Map<string, number>>();
  for (const r of dayRows) {
    const tier = r.type === "presenting" ? "presenting" : "standard";
    let m = dayUsageByTierDate.get(tier);
    if (!m) { m = new Map(); dayUsageByTierDate.set(tier, m); }
    m.set(r.date, (m.get(r.date) ?? 0) + 1);
  }
  return weeks.map((weekStart) => ({
    weekStart,
    label: formatWeekRange(weekStart),
    tiers: (Object.keys(WEEK_TIERS) as WeekTier[]).map((tier) => {
      const taken = maxTakenOverDays(
        runStartsByTier.get(tier) ?? [],
        dayUsageByTierDate.get(tier) ?? new Map<string, number>(),
        weekStart
      );
      const slots = WEEK_TIERS[tier].slots;
      const state: WeekState = taken >= slots ? "sold" : taken === slots - 1 ? "one_left" : "available";
      return { tier, state, taken, slots };
    }),
  }));
}

/**
 * Project a paid campaign booking into 7 day-based AdBooking rows (the
 * 7 consecutive days from the run's start date)
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

/** Build the 7 consecutive-day AdBooking rows for a paid campaign booking (pure). */
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
