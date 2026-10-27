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

// What the poster picked on the "What would you like to share?" step. The
// intent is recorded on the post and preselects the category plus tailored
// form hints, but it never changes the placement itself: every post is
// still the same $5, 7-day Board run.
export const BOARD_INTENTS = [
  {
    key: "event",
    label: "Promote an event",
    blurb: "Bring more attention to your upcoming event",
    category: "event",
    titlePlaceholder: "Event name",
    descriptionPlaceholder: "Date, time, place, and what readers should expect.",
  },
  {
    key: "deal",
    label: "Share a special deal",
    blurb: "Help readers discover your promotion",
    category: "for_sale",
    titlePlaceholder: "Deal headline (e.g. 20% off all plants Saturday)",
    descriptionPlaceholder: "What readers get, when it ends, and any code or fine print.",
  },
  {
    key: "job",
    label: "Post a local job",
    blurb: "Reach people looking for new opportunities",
    category: "job",
    titlePlaceholder: "Job title",
    descriptionPlaceholder: "Pay range if you have one, hours, and how to apply.",
  },
  {
    key: "celebration",
    label: "Celebrate someone",
    blurb: "Birthdays, anniversaries, graduations and more",
    category: "announcement",
    titlePlaceholder: "Who are you celebrating?",
    descriptionPlaceholder: "The occasion and a line or two about them.",
  },
  {
    key: "classified",
    label: "Buy, sell or announce",
    blurb: "A general classified listing",
    category: "announcement",
    titlePlaceholder: "What are you listing?",
    descriptionPlaceholder: "Condition, price if there is one, and how to reach you.",
  },
] as const;

export type BoardIntentKey = (typeof BOARD_INTENTS)[number]["key"];

export function boardIntentForKey(key: string | null | undefined) {
  return BOARD_INTENTS.find((i) => i.key === key);
}

export function boardIntentLabel(key: string | null | undefined): string | null {
  return boardIntentForKey(key)?.label ?? null;
}
