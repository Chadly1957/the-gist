import { getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { sendExistingIssueToSubscribers } from "@/lib/send-existing-issue";

export const maxDuration = 300;

// POST /api/admin/newsletter/send-latest — send the workspace's most recent
// sent issue to exactly the email addresses given. Only active subscribers
// in this workspace receive it, and anyone who already received that issue
// is skipped, so re-running it with the same list is safe. This covers
// lists imported before the import route started auto-sending the latest
// issue (e.g. the 13 Meta leads from 2026-11-12).
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emails }: { emails?: string[] } = await req.json();
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "No email addresses provided." }, { status: 400 });
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const e of emails) {
    const clean = typeof e === "string" ? e.trim().toLowerCase() : "";
    if (clean.includes("@") && !seen.has(clean)) {
      seen.add(clean);
      normalized.push(clean);
    }
  }
  if (normalized.length === 0) {
    return NextResponse.json({ error: "No valid email addresses provided." }, { status: 400 });
  }

  const latest = await prisma.newsletterSend.findFirst({
    where: { status: "sent" },
    orderBy: { sentAt: "desc" },
    select: { id: true, subject: true, htmlBody: true, htmlSnapshot: true },
  });
  if (!latest) {
    return NextResponse.json({ error: "No sent issue yet for this workspace." }, { status: 404 });
  }

  // Only active subscribers in this workspace, and only those who haven't
  // already received this issue.
  const subscribers = await prisma.subscriber.findMany({
    where: { email: { in: normalized }, active: true },
    select: { id: true, email: true },
  });
  const alreadySent = new Set(
    (
      await prisma.newsletterRecipient.findMany({
        where: { newsletterSendId: latest.id },
        select: { email: true },
      })
    ).map((r) => r.email)
  );
  const targets = subscribers.filter((s) => !alreadySent.has(s.email));
  const skipped = normalized.length - targets.length;

  if (targets.length === 0) {
    return NextResponse.json({ sent: 0, skipped, message: "Everyone on that list already received the latest issue." });
  }

  const appUrl = await getWorkspaceUrl();
  const result = await sendExistingIssueToSubscribers(latest, targets, appUrl);
  if (!result.ok) {
    return NextResponse.json({ error: `Send failed: ${result.error}` }, { status: 502 });
  }

  return NextResponse.json({ sent: result.sent, skipped });
}
