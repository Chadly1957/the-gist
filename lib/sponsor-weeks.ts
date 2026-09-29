import { basePrisma } from "./db-base";

// Week-based sponsor packages: one presenting slot and two standard slots
// per calendar week (Monday-Friday).
export const WEEK_TIERS = {
  presenting: { priceCents: 15000, slots: 1, label: "Presenting Sponsor", adType: "presenting" },
  standard: { priceCents: 7500, slots: 2, label: "Standard Sponsor", adType: "in_article" },
} as const;
export type WeekTier = keyof typeof WEEK_TIERS;

export const HOLD_MINUTES = 10;
// Bookings that occupy a slot: the buyer is mid-checkout or has paid.
const OCCUPYING_STATUSES = ["pending_payment", "paid"];

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

export function isValidTier(tier: string): tier is WeekTier {
  return tier === "presenting" || tier === "standard";
}

export function formatWeekRange(weekStart: string): string {
  const fmt = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${fmt(weekStart)} - ${fmt(addDaysISO(weekStart, 4))}`;
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
  const weeks = upcomingSponsorWeeks();
  const [holds, bookings] = await Promise.all([
    basePrisma.sponsorHold.findMany({
      where: { workspaceId, week: { weekStart: { in: weeks } }, expiresAt: { gt: now } },
      select: { tier: true, week: { select: { weekStart: true } } },
    }),
    basePrisma.sponsorWeekBooking.findMany({
      where: { workspaceId, week: { weekStart: { in: weeks } }, status: { in: OCCUPYING_STATUSES } },
      select: { tier: true, week: { select: { weekStart: true } } },
    }),
  ]);
  const takenByWeekTier = new Map<string, number>();
  for (const r of [...holds, ...bookings]) {
    const key = `${r.week.weekStart}:${r.tier}`;
    takenByWeekTier.set(key, (takenByWeekTier.get(key) ?? 0) + 1);
  }
  return weeks.map((weekStart) => ({
    weekStart,
    label: formatWeekRange(weekStart),
    tiers: (Object.keys(WEEK_TIERS) as WeekTier[]).map((tier) => {
      const taken = takenByWeekTier.get(`${weekStart}:${tier}`) ?? 0;
      const slots = WEEK_TIERS[tier].slots;
      const state: WeekState = taken >= slots ? "sold" : taken === slots - 1 ? "one_left" : "available";
      return { tier, state, taken, slots };
    }),
  }));
}

/**
 * Project a paid week booking into 5 day-based AdBooking rows (Mon-Fri) so
 * the existing send pipeline, analytics, and portal keep working unchanged.
 * Copy handling: buyer's own copy goes live immediately; when Chad writes the
 * copy the rows wait in pending_review until he finalizes them.
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
}

/** Build the 5 Mon-Fri AdBooking rows for a paid week booking (pure). */
export function buildWeekProjectionRows(booking: WeekBookingProjectionInput) {
  const adType = WEEK_TIERS[booking.tier].adType;
  const copy = booking.finalAdCopy ?? booking.aboutText;
  const approved = !booking.chadWritesCopy;
  return [0, 1, 2, 3, 4].map((offset) => ({
    workspaceId: booking.workspaceId,
    sponsorId: booking.sponsorId,
    type: adType,
    date: addDaysISO(booking.weekStart, offset),
    status: approved ? "approved" : "pending_review",
    isPaid: true,
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
