import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Powers the /join landing page: real per-workspace subscriber count plus
// the latest sent issue's stories, parsed from its HTML snapshot. Everything
// is workspace-scoped automatically by the prisma extension.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function allMatches(re: RegExp, html: string): string[] {
  const out: string[] = [];
  const rx = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) out.push(m[1]);
  return out;
}

function extractStories(html: string, limit = 5): { title: string; desc: string }[] {
  const titles = allMatches(/class="article-title"[^>]*>([\s\S]*?)<\//g, html).map(clean);
  const descs = allMatches(/class="article-desc"[^>]*>([\s\S]*?)<\//g, html).map(clean);
  const stories: { title: string; desc: string }[] = [];
  for (let i = 0; i < Math.min(limit, titles.length); i++) {
    if (titles[i]) stories.push({ title: titles[i], desc: descs[i] || "" });
  }
  return stories;
}

// Game links in the email look like "Play Decatur Wordy →"
function extractGames(html: string): string[] {
  const games: string[] = [];
  for (const g of allMatches(/Play\s+([^<→]{2,50}?)\s*→/g, html).map(clean)) {
    if (games.indexOf(g) === -1) games.push(g);
    if (games.length >= 3) break;
  }
  return games;
}

export async function GET() {
  const [count, send] = await Promise.all([
    prisma.subscriber.count({ where: { active: true } }),
    prisma.newsletterSend.findFirst({
      where: { status: "sent", htmlSnapshot: { not: null } },
      orderBy: { sentAt: "desc" },
      select: { subject: true, sentAt: true, recipientCount: true, htmlSnapshot: true },
    }),
  ]);

  // Round down to nearest 10 so "660+" is always honest
  const rounded = Math.floor(count / 10) * 10;

  return NextResponse.json({
    count,
    rounded,
    latestIssue: send?.htmlSnapshot
      ? {
          subject: send.subject,
          sentAt: send.sentAt,
          recipientCount: send.recipientCount,
          stories: extractStories(send.htmlSnapshot),
          games: extractGames(send.htmlSnapshot),
        }
      : null,
  });
}
