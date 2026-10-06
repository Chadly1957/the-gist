// Week helpers for the deals engine. Ad weeks run Monday -> Sunday.

export function mondayOfWeek(d: Date = new Date()): string {
  const dt = new Date(d);
  const day = dt.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return toYMD(dt);
}

export function sundayOfWeek(d: Date = new Date()): string {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  dt.setDate(dt.getDate() + diff);
  return toYMD(dt);
}

export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse "MM/DD/YYYY ..." or ISO-ish date strings into YYYY-MM-DD. */
export function normalizeDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return undefined;
}
