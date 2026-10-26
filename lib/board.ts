import { prisma } from "@/lib/db";
import { BOARD_CATEGORIES } from "./board-constants";

export {
  BOARD_PRICE_CENTS,
  BOARD_RUN_DAYS,
  BOARD_CATEGORIES,
  boardCategoryLabel,
} from "./board-constants";
export type { BoardCategoryKey } from "./board-constants";

// Gist Board: community classifieds, $5 flat for a 7-day run.
// A post is live while it is approved and inside its approvedAt->expiresAt
// window, so expiry needs no cron: every read filters on the window.

export interface BoardPostInput {
  title: string;
  description: string;
  category: string;
  linkUrl: string;
  contactInfo: string;
  displayName: string;
  email: string;
}

// Shared server-side validation for the post form (the client mirrors the
// required-field rules, but this is the gate that counts).
export function validateBoardPostInput(body: unknown): { input: BoardPostInput } | { error: string } {
  const b = (body || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = str(b.title);
  const description = str(b.description);
  const category = str(b.category);
  const linkUrl = str(b.linkUrl);
  const contactInfo = str(b.contactInfo);
  const displayName = str(b.displayName);
  const email = str(b.email).toLowerCase();

  if (!title) return { error: "A title is required." };
  if (title.length > 80) return { error: "Keep the title under 80 characters." };
  if (!description) return { error: "A short description is required." };
  if (description.length > 200) return { error: "Keep the description under 200 characters." };
  if (!BOARD_CATEGORIES.some((c) => c.key === category)) return { error: "Pick a category." };
  if (!linkUrl && !contactInfo) {
    return { error: "Add a link or a way to contact you, so readers can respond." };
  }
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
    return { error: "The link must start with http:// or https://." };
  }
  if (linkUrl.length > 500) return { error: "That link is too long." };
  if (contactInfo.length > 120) return { error: "Keep the contact info under 120 characters." };
  if (displayName.length > 40) return { error: "Keep the display name under 40 characters." };
  if (!email || !email.includes("@")) return { error: "A valid email is required." };

  return { input: { title, description, category, linkUrl, contactInfo, displayName, email } };
}

export interface BoardItem {
  id: string;
  title: string;
  description: string;
  category: string;
  linkUrl: string | null;
  contactInfo: string | null;
  displayName: string | null;
  expiresAt: Date | null;
}

// Live posts for a workspace: approved and inside the 7-day window,
// newest approvals first.
export async function getActiveBoardPosts(workspaceId: string): Promise<BoardItem[]> {
  const now = new Date();
  const rows = await prisma.boardPost.findMany({
    where: {
      workspaceId,
      status: "active",
      approvedAt: { lte: now },
      expiresAt: { gt: now },
    },
    orderBy: { approvedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      linkUrl: true,
      contactInfo: true,
      displayName: true,
      expiresAt: true,
    },
  });
  return rows;
}

// Escape untrusted post text for the email HTML renderer (the web UI is
// React-escaped by default; the newsletter is string-interpolated, so it
// needs this explicitly).
export function escapeBoardHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
