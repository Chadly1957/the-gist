// Pure, client-safe pieces of the sponsor nurture feature: block types,
// parsing, the starter layout, merge tags, and audience metadata. The
// server-only audience resolution lives in lib/sponsor-nurture.ts.

export type NurtureBlockType = "heading" | "text" | "image" | "button" | "divider";

export interface NurtureBlock {
  id: string;
  type: NurtureBlockType;
  /** heading / text body */
  text?: string;
  /** image source URL */
  url?: string;
  /** image alt text */
  alt?: string;
  /** image click-through / button target */
  linkUrl?: string;
  /** button label */
  label?: string;
}

const BLOCK_TYPES: NurtureBlockType[] = ["heading", "text", "image", "button", "divider"];

export function parseBlocks(json: string): NurtureBlock[] {
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((b) => b && typeof b === "object" && BLOCK_TYPES.includes(b.type))
      .map((b, i) => ({
        id: typeof b.id === "string" && b.id ? b.id : `block-${i}-${Math.random().toString(36).slice(2, 8)}`,
        type: b.type as NurtureBlockType,
        text: typeof b.text === "string" ? b.text : undefined,
        url: typeof b.url === "string" ? b.url : undefined,
        alt: typeof b.alt === "string" ? b.alt : undefined,
        linkUrl: typeof b.linkUrl === "string" ? b.linkUrl : undefined,
        label: typeof b.label === "string" ? b.label : undefined,
      }));
  } catch {
    return [];
  }
}

export function newBlock(type: NurtureBlockType): NurtureBlock {
  const id = `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  switch (type) {
    case "heading":
      return { id, type, text: "" };
    case "text":
      return { id, type, text: "" };
    case "image":
      return { id, type, url: "", alt: "", linkUrl: "" };
    case "button":
      return { id, type, label: "", linkUrl: "" };
    case "divider":
      return { id, type };
  }
}

export function starterBlocks(): NurtureBlock[] {
  return [
    { id: "starter-heading", type: "heading", text: "A quick hello from The Gist" },
    {
      id: "starter-text",
      type: "text",
      text: "Hi {{contactName}},\n\n{{businessName}} has a free listing in The Gist's Business Directory, and local readers browse it every week. This is where we share what's working for listed businesses and the simplest ways to get more from your free listing.",
    },
    { id: "starter-button", type: "button", label: "See sponsorship options", linkUrl: "/sponsor" },
    {
      id: "starter-text-2",
      type: "text",
      text: "Want guaranteed placement instead of the rotating spotlight? A 7-Issue Featured Campaign puts your message in seven straight daily issues. Reply to this email and Chad will walk you through it.",
    },
  ];
}

export function applyMergeTags(
  text: string,
  recipient: { businessName: string; contactName: string }
): string {
  return text
    .replaceAll("{{businessName}}", recipient.businessName)
    .replaceAll("{{contactName}}", recipient.contactName);
}

export const NURTURE_AUDIENCES = ["free", "all", "past"] as const;
export type NurtureAudience = (typeof NURTURE_AUDIENCES)[number];
export const NURTURE_AUDIENCE_LABELS: Record<NurtureAudience, string> = {
  free: "Free businesses (listed, never paid)",
  all: "All businesses",
  past: "Past advertisers",
};
export function isNurtureAudience(v: unknown): v is NurtureAudience {
  return v === "free" || v === "all" || v === "past";
}

export interface NurtureRecipient {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  magicToken: string;
}
