// Renewing coupons: "one redemption per interval" boundaries in the workspace timezone.

export type RefreshInterval = "daily" | "weekly" | "monthly";

export function isRefreshInterval(v: unknown): v is RefreshInterval {
  return v === "daily" || v === "weekly" || v === "monthly";
}

/** Minutes offset of `timeZone` at `date` (e.g. -300 for America/Chicago CST). */
function tzOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUTC - date.getTime()) / 60000;
}

/** Current calendar date (y/m/d) in the given timezone. */
function tzDateParts(timeZone: string, date: Date): { y: number; m: number; d: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const [y, m, d] = (parts.year && parts.month && parts.day
    ? `${parts.year}-${parts.month}-${parts.day}`
    : "1970-01-01"
  )
    .split("-")
    .map(Number);
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y, m, d, weekday: weekdayMap[parts.weekday as string] ?? 0 };
}

/**
 * UTC instant of the start of the current daily/weekly/monthly interval,
 * measured in `timeZone`. Weeks start Monday.
 */
export function intervalStart(interval: RefreshInterval, timeZone: string): Date {
  const now = new Date();
  const { y, m, d, weekday } = tzDateParts(timeZone, now);
  let startY = y, startM = m, startD = d;
  if (interval === "weekly") {
    // Roll back to Monday.
    const back = (weekday + 6) % 7;
    const dt = new Date(Date.UTC(y, m - 1, d - back));
    startY = dt.getUTCFullYear();
    startM = dt.getUTCMonth() + 1;
    startD = dt.getUTCDate();
  } else if (interval === "monthly") {
    startD = 1;
  }
  // Midnight in tz -> UTC instant.
  const guess = Date.UTC(startY, startM - 1, startD, 0, 0, 0);
  const offsetMs = tzOffsetMinutes(timeZone, new Date(guess)) * 60000;
  return new Date(guess - offsetMs);
}

/** Human label for when a used-up coupon becomes available again. */
export function refreshesLabel(interval: RefreshInterval): string {
  return interval === "daily" ? "tomorrow" : interval === "weekly" ? "next week" : "next month";
}
