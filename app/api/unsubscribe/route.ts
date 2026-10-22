import { getWorkspace, workspaceUnique } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

async function deactivateSubscriber(email: string, recipientId?: string | null) {
  if (recipientId) {
    await prisma.newsletterRecipient
      .update({ where: { id: recipientId }, data: { unsubscribedAt: new Date() } })
      .catch(() => {});
  }

  const where = await workspaceUnique("email", email);
  const subscriber = await prisma.subscriber.findUnique({ where });
  if (!subscriber || !subscriber.active) return;

  await prisma.subscriber.update({ where, data: { active: false } });
}

// RFC 8058 one-click unsubscribe: mail clients (Gmail, Yahoo, Apple Mail)
// POST an application/x-www-form-urlencoded body ("List-Unsubscribe=One-Click")
// to the URL in the List-Unsubscribe header, which carries the recipient id
// and email in its query string. This path is unauthenticated, so it only
// deactivates when the recipient id resolves to a real NewsletterRecipient
// in this workspace whose email matches the supplied email. Every response
// is 200 either way, so nothing about subscriber existence ever leaks and
// the mail client never sees an error.
async function handleOneClick(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    let email = normalizeEmail(params.get("email"));
    let recipientId = params.get("r") || params.get("recipientId");

    // Some clients put the fields in the form body instead of the query
    // string; accept them there too. Gmail's body is only the
    // "List-Unsubscribe=One-Click" marker, which carries no fields.
    try {
      const form = await req.formData();
      if (!email) email = normalizeEmail(form.get("email"));
      if (!recipientId) {
        const value = form.get("r") || form.get("recipientId");
        if (typeof value === "string" && value) recipientId = value;
      }
    } catch {
      // Body was empty or not form data — the query string is enough.
    }

    if (email && recipientId) {
      const workspace = await getWorkspace();
      const recipient = await prisma.newsletterRecipient
        .findUnique({ where: { id: recipientId } })
        .catch(() => null);
      if (
        recipient &&
        recipient.workspaceId === workspace.id &&
        normalizeEmail(recipient.email) === email
      ) {
        await deactivateSubscriber(email, recipientId);
      }
    }
  } catch {
    // One-click must never error back at the mail client.
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return handleOneClick(req);
  }

  // JSON path: the /unsubscribe page's own button.
  try {
    const { email, recipientId } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    await deactivateSubscriber(normalized, recipientId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
