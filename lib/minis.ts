import { basePrisma } from "@/lib/db-base";

// Deals Mini: $5 one-off guides. Internal name "Mini" only; customer-facing
// copy always uses the guide title (e.g. "Date Night Guide"), never "Mini".
export const MINI_PRICE_CENTS = 500;
// Option B upgrade math (Chad, 2026-10-27): flat $5 off, no stacking. Any
// Mini owner without Deals pays $10 to upgrade, no matter how many Minis
// they own. There is no free-upgrade case.
export const UPGRADE_PRICE_CENTS = 1000;
export const MINI_STRIPE_KIND = "deals_mini";
export const MINI_UPGRADE_STRIPE_KIND = "coupon_book_upgrade";

export type MiniBlock =
  | {
      type: "option";
      name: string;
      description: string;
      whyItFits?: string;
      link?: string;
      dealRef?: string;
    }
  | { type: "idea"; text: string }
  | { type: "tip"; text: string };

export interface MiniAccessProfile {
  hasDeals: boolean;
  ownedMiniIds: string[];
  ownedMiniSlugs: string[];
  upgradePriceCents: number | null;
}

// Server-side only: the access profile for (email, workspace). Gating
// decisions must always go through this, never through client state.
export async function getMiniAccessProfile(
  workspaceId: string,
  email: string,
): Promise<MiniAccessProfile> {
  const normalized = email.trim().toLowerCase();
  const deals = await basePrisma.couponBookPurchase.findFirst({
    where: { workspaceId, email: normalized, active: true },
    select: { id: true },
  });
  const purchases = await basePrisma.miniPurchase.findMany({
    where: { workspaceId, email: normalized },
    select: { miniId: true, mini: { select: { slug: true } } },
  });
  const hasDeals = !!deals;
  const ownedMiniIds = [...new Set(purchases.map((p) => p.miniId))];
  const ownedMiniSlugs = [...new Set(purchases.map((p) => p.mini.slug))];
  return {
    hasDeals,
    ownedMiniIds,
    ownedMiniSlugs,
    upgradePriceCents:
      !hasDeals && ownedMiniIds.length > 0 ? UPGRADE_PRICE_CENTS : null,
  };
}

// Teaser only: option names and block counts. Descriptions, links, deal
// refs, idea text, and tip text are guide content and must never leak onto
// a public page.
export function miniTeaser(mini: {
  title: string;
  question: string;
  content: unknown;
}) {
  const blocks = (Array.isArray(mini.content) ? mini.content : []) as Array<
    Record<string, unknown>
  >;
  const options = blocks.filter((b) => b?.type === "option");
  const ideas = blocks.filter((b) => b?.type === "idea");
  const tips = blocks.filter((b) => b?.type === "tip");
  return {
    title: mini.title,
    question: mini.question,
    optionNames: options
      .map((o) => o.name)
      .filter((n): n is string => typeof n === "string"),
    optionCount: options.length,
    ideaCount: ideas.length,
    tipCount: tips.length,
  };
}

// Test guide content (placeholder, proves the plumbing; not final editorial).
// Deliberately generic: no specific business is named, so nothing unverified
// is ever asserted as a recommendation.
const DATE_NIGHT_CONTENT: MiniBlock[] = [
  {
    type: "option",
    name: "Downtown dinner and a walk",
    description:
      "Pick a sit-down spot downtown, then walk the main strip while you decide on dessert.",
    whyItFits: "Easy to plan, easy to bail on if the night runs long.",
  },
  {
    type: "option",
    name: "Casual tacos and live music",
    description:
      "Keep it low-key: counter-service food, then wherever music is playing that night.",
    whyItFits: "Good when you want the night to feel fun without feeling formal.",
  },
  {
    type: "option",
    name: "A quiet night in, upgraded",
    description:
      "Cook one thing together that feels a little special, then a movie you both actually pick.",
    whyItFits: "Cheapest option on the list, and sometimes the one you remember.",
  },
  {
    type: "idea",
    text: "Set a start time, not just a day. Vague plans are how date night becomes couch night.",
  },
  {
    type: "idea",
    text: "Take turns picking: one person picks dinner, the other picks what happens after.",
  },
  {
    type: "idea",
    text: "If a place needs a reservation on weekends, book it before the week starts, not the day of.",
  },
  {
    type: "tip",
    text: "Test content: this guide is a placeholder proving the Mini plumbing. Real options, places, and deals land here as Minis are written.",
  },
];

// Phase 1 seeding: the test guide is ensured on first request (read-first,
// so steady state costs one SELECT). Only the Decatur workspace gets the
// test guide; other workspaces get Minis when one is written for them.
export async function ensureSeedMinis(
  workspaceId: string,
  workspaceSlug: string,
): Promise<void> {
  if (workspaceSlug !== "decatur") return;
  const existing = await basePrisma.mini.findFirst({
    where: { workspaceId, slug: "date-night-guide" },
    select: { id: true },
  });
  if (existing) return;
  await basePrisma.mini.create({
    data: {
      workspaceId,
      slug: "date-night-guide",
      title: "Date Night Guide",
      question: "Where should we go for date night?",
      content: DATE_NIGHT_CONTENT,
      priceCents: MINI_PRICE_CENTS,
      active: true,
    },
  });
}
