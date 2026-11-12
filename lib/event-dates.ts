// Date helpers for the public events calendar. Events store plain
// YYYY-MM-DD strings, so everything is built from the parts in UTC and
// the weekday never drifts with the server's (or the reader's) timezone.

// Today's date (YYYY-MM-DD) in the workspace's timezone, matching the
// plain date strings events are stored with.
export function todayIn(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "Tuesday, November 10" from a YYYY-MM-DD string.
export function dayHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// Short chip label: "Thu 13".
export function dayChipLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// Best-effort in-day ordering: parse a leading clock time ("7:00 PM",
// "9 AM") into minutes. Anything unparseable sorts after timed events
// and keeps its original order (Array.sort is stable).
export function startMinutes(startTime: string | null): number {
  if (!startTime) return Number.MAX_SAFE_INTEGER;
  const m = startTime.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let h = parseInt(m[1], 10);
  if (h > 23) return Number.MAX_SAFE_INTEGER;
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
}
