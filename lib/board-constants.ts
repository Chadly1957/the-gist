// Client-safe Gist Board constants (no database imports here, so form
// pages can import these without bundling Prisma into browser code).
// Server code in lib/board.ts re-exports these.

export const BOARD_PRICE_CENTS = 500;
export const BOARD_RUN_DAYS = 7;

export const BOARD_CATEGORIES = [
  { key: "for_sale", label: "For Sale" },
  { key: "job", label: "Job" },
  { key: "event", label: "Event" },
  { key: "announcement", label: "Announcement" },
  { key: "service", label: "Service" },
  { key: "wanted", label: "Wanted" },
] as const;

export type BoardCategoryKey = (typeof BOARD_CATEGORIES)[number]["key"];

export function boardCategoryLabel(key: string): string {
  return BOARD_CATEGORIES.find((c) => c.key === key)?.label ?? "Announcement";
}
