import { getWorkspace, getWorkspaceUrl, workspaceUnique, withWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/welcome-email";

interface ImportRow {
  email: string;
  firstName?: string;
}

// Allow up to 5 minutes: the welcome-email send to new subscribers runs in
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

  // Newly created subscribers get the welcome email (below). Reactivated
  // ones don't: they have been on the list before.
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

  // Send the clean welcome email to the newly created subscribers (the
  // same one public signups get). It used to be a re-send of the most
  // recent issue; a full newsletter is the wrong first contact, since it
  // can land in Promotions or spam and the reader never sees an issue.
  // welcomeSent in the response is how many are queued for the send; the
  // send itself runs in the background after the response so a large
  // import can't time out. Failures are logged server-side and never fail
  // the import. withWorkspace keeps the workspace context alive for the
  // background task (the Prisma extension resolves the workspace from it,
  // not from request headers, which are gone after the response).
  let welcomeSent = 0;
  if (newSubscribers.length > 0) {
    try {
      const ws = await getWorkspace();
      const appUrl = await getWorkspaceUrl();
      // Dedupe by email (the same address can appear twice in one file).
      const seen = new Set<string>();
      const targets = newSubscribers.filter((s) => {
        if (seen.has(s.email)) return false;
        seen.add(s.email);
        return true;
      });
      welcomeSent = targets.length;
      void withWorkspace(ws, async () => {
        let sent = 0;
        for (const target of targets) {
          try {
            await sendWelcomeEmail(target, appUrl);
            sent++;
          } catch (err) {
            console.error("[import] welcome email failed for a subscriber:", err);
          }
        }
        console.log(`[import] welcome email sent to ${sent} new subscribers`);
      }).catch((err) => console.error("[import] welcome-email send failed:", err));
    } catch (err) {
      console.error("[import] welcome-email send setup failed:", err);
    }
  }

  return NextResponse.json({ imported, skipped, welcomeSent });
}
