import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import { couponBookAccessWhere } from "@/lib/coupon-book";
import type { Block, GuideSpotlightItem } from "@/lib/template-renderer";

// Deals Mini: $5 one-off guides. Internal name "Mini" only; customer-facing
// copy always uses the guide title (e.g. "Date Night Guide"), never "Mini".
export const MINI_PRICE_CENTS = 500;
// Option B upgrade math (Chad, 2026-10-27): flat $5 off, no stacking. Any
// Mini owner without Deals pays this to upgrade, no matter how many Minis
// they own. There is no free-upgrade case. Since the annual switch
// (2026-10-29) this is the FIRST-YEAR price of the $15/year book: the $5
// guide credit is a $5-off-once Stripe coupon on the upgrade checkout, and
// renewals bill the full $15.
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
      // Group label for the guide view's filter chips (e.g. "Splurge",
      // "Rainy-Night Friendly"). Optional; untagged options always show
      // under "All" and never get a chip of their own.
      tag?: string;
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
    where: { workspaceId, email: normalized, active: true, ...couponBookAccessWhere() },
    select: { id: true },
  });
  const purchases = await basePrisma.miniPurchase.findMany({
    where: { workspaceId, email: normalized },
    select: { miniId: true, mini: { select: { slug: true } } },
  });
  const hasDeals = !!deals;
  const ownedMiniIds = Array.from(new Set(purchases.map((p) => p.miniId)));
  const ownedMiniSlugs = Array.from(new Set(purchases.map((p) => p.mini.slug)));
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
  imageUrl?: string | null;
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
    imageUrl: mini.imageUrl ?? null,
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
    tag: "Casual",
  },
  {
    type: "option",
    name: "Casual tacos and live music",
    description:
      "Keep it low-key: counter-service food, then wherever music is playing that night.",
    whyItFits: "Good when you want the night to feel fun without feeling formal.",
    tag: "Late Night",
  },
  {
    type: "option",
    name: "A quiet night in, upgraded",
    description:
      "Cook one thing together that feels a little special, then a movie you both actually pick.",
    whyItFits: "Cheapest option on the list, and sometimes the one you remember.",
    tag: "Budget",
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

// --- Phase 2: admin editing helpers ---------------------------------------
// Shared by the admin Mini create/update routes so the editor and the API
// can never disagree about what a valid guide looks like. Sanitizes into
// the exact MiniBlock shape Phase 1 renders; returns an error string for
// anything an admin should fix rather than silently dropping content.
export const MINI_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function sanitizeMiniBlocks(input: unknown): { blocks?: MiniBlock[]; error?: string } {
  if (!Array.isArray(input)) return { error: "Guide content must be a list of blocks." };
  if (input.length > 60) return { error: "That guide has too many blocks (60 max)." };
  const blocks: MiniBlock[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { error: "Guide content has an invalid block." };
    const b = raw as Record<string, unknown>;
    if (b.type === "option") {
      const name = cleanText(b.name, 120);
      const description = cleanText(b.description, 600);
      if (!name) return { error: "Every option needs a name." };
      if (!description) return { error: `Option "${name}" needs a short description.` };
      const block: Extract<MiniBlock, { type: "option" }> = { type: "option", name, description };
      const whyItFits = cleanText(b.whyItFits, 300);
      if (whyItFits) block.whyItFits = whyItFits;
      const dealRef = cleanText(b.dealRef, 200);
      if (dealRef) block.dealRef = dealRef;
      const tag = cleanText(b.tag, 40);
      if (tag) block.tag = tag;
      const link = cleanText(b.link, 2048);
      if (link) {
        try {
          const url = new URL(link);
          if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("scheme");
        } catch {
          return { error: `Option "${name}" has a link that is not a valid http(s) URL.` };
        }
        block.link = link;
      }
      blocks.push(block);
    } else if (b.type === "idea" || b.type === "tip") {
      const text = cleanText(b.text, 400);
      if (!text) return { error: `Every ${b.type} needs text.` };
      blocks.push({ type: b.type, text });
    } else {
      return { error: "Guide content has a block of an unknown type." };
    }
  }
  const optionCount = blocks.filter((b) => b.type === "option").length;
  if (optionCount > 20) return { error: "A guide can have at most 20 options." };
  return { blocks };
}

export function countMiniOptions(blocks: MiniBlock[]): number {
  return blocks.filter((b) => b.type === "option").length;
}

// Cover image URL for a guide, cleaned the same way option links are in
// sanitizeMiniBlocks: empty/missing clears to null; a non-empty value must
// be a valid http(s) URL. Shared by the admin create/update routes.
export function cleanMiniImageUrl(value: unknown): { imageUrl?: string | null; error?: string } {
  if (value === undefined) return {};
  if (value === null) return { imageUrl: null };
  if (typeof value !== "string") return { error: "Cover image must be an image URL." };
  const trimmed = value.trim().slice(0, 2048);
  if (!trimmed) return { imageUrl: null };
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("scheme");
  } catch {
    return { error: "Cover image is not a valid http(s) URL." };
  }
  return { imageUrl: trimmed };
}

// --- Newsletter guide_spotlight resolver -----------------------------------
// Resolve the guides selected in a template's guide_spotlight blocks into
// render-ready items, keyed by Mini id. Only ACTIVE Minis in the current
// workspace resolve; a missing or inactive selection is simply absent from
// the map and its block renders empty. Wrapped so a data problem can never
// block a send: on any error the blocks just render empty. Mirrors
// resolveProductSpotlightItems in lib/products.ts.
export async function resolveGuideSpotlightItems(
  blocks: Block[],
  appUrl: string
): Promise<Map<string, GuideSpotlightItem>> {
  const items = new Map<string, GuideSpotlightItem>();
  const ids = Array.from(
    new Set(
      blocks
        .filter((b) => b.type === "guide_spotlight")
        .map((b) => String(b.content.miniId || ""))
        .filter(Boolean)
    )
  );
  if (ids.length === 0) return items;
  try {
    const workspace = await getWorkspace();
    const minis = await basePrisma.mini.findMany({
      where: { id: { in: ids }, workspaceId: workspace.id, active: true },
      select: { id: true, title: true, question: true, slug: true, priceCents: true, imageUrl: true },
    });
    for (const m of minis) {
      items.set(m.id, {
        title: m.title,
        question: m.question,
        priceCents: m.priceCents,
        imageUrl: m.imageUrl,
        url: `${appUrl}/minis/${m.slug}`,
      });
    }
  } catch {
    // Mini lookup unavailable: guide blocks render empty.
    return new Map();
  }
  return items;
}
