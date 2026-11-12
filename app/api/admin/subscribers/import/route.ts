import { getWorkspace, getWorkspaceUrl, workspaceUnique, withWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { sendExistingIssueToSubscribers } from "@/lib/send-existing-issue";

interface ImportRow {
  email: string;
  firstName?: string;
}

// Allow up to 5 minutes — the latest-issue send to new subscribers runs in
// the background after the response, same as the newsletter send routes.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscribers }: { subscribers: ImportRow[] } = await req.json();

  if (!Array.isArray(subscribers) || subscribers.length === 0) {
    return NextResponse.json({ error: "No subscribers provided." }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;

  // Validate first so the "already on the list" check is a single query.
  const validRows: ImportRow[] = [];
  for (const row of subscribers) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) { skipped++; continue; }
    validRows.push({ email, firstName: row.firstName });
  }

  // Newly created subscribers get the latest issue (below). Reactivated
  // ones don't: they may already have received it.
  const existingEmails = new Set(
    (
      await prisma.subscriber.findMany({
        where: { email: { in: validRows.map((r) => r.email) } },
        select: { email: true },
      })
    ).map((s) => s.email)
  );

  const newSubscribers: { id: string; email: string }[] = [];
  for (const row of validRows) {
    try {
      const sub = await prisma.subscriber.upsert({
        where: await workspaceUnique("email", row.email),
        update: { active: true, firstName: row.firstName || undefined },
        create: { email: row.email, firstName: row.firstName || null, active: true },
      });
      if (!existingEmails.has(row.email)) {
        newSubscribers.push({ id: sub.id, email: sub.email });
      }
      imported++;
    } catch {
      skipped++;
    }
  }

  // Send the most recent sent issue to the newly created subscribers.
  // issueSent in the response is how many are queued for the send; the
  // send itself runs in the background after the response so a large
  // import can't time out. Failures are logged server-side and never fail
  // the import. withWorkspace keeps the workspace context alive for the
  // background task (the Prisma extension resolves the workspace from it,
  // not from request headers, which are gone after the response).
  let issueSent = 0;
  if (newSubscribers.length > 0) {
    try {
      const latest = await prisma.newsletterSend.findFirst({
        where: { status: "sent" },
        orderBy: { sentAt: "desc" },
        select: { id: true, subject: true, htmlBody: true, htmlSnapshot: true },
      });
      if (latest) {
        const ws = await getWorkspace();
        const appUrl = await getWorkspaceUrl();
        // Dedupe by email (the same address can appear twice in one file).
        const seen = new Set<string>();
        const targets = newSubscribers.filter((s) => {
          if (seen.has(s.email)) return false;
          seen.add(s.email);
          return true;
        });
        issueSent = targets.length;
        void withWorkspace(ws, () =>
          sendExistingIssueToSubscribers(latest, targets, appUrl)
        )
          .then((result) => {
            if (result.ok) console.log(`[import] latest issue sent to ${result.sent} new subscribers`);
            else console.error("[import] latest-issue send failed:", result.error);
          })
          .catch((err) => console.error("[import] latest-issue send failed:", err));
      }
    } catch (err) {
      console.error("[import] latest-issue send setup failed:", err);
    }
  }

  return NextResponse.json({ imported, skipped, issueSent });
}
