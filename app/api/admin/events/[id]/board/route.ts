import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { boardRunDays, validateBoardPostInput } from "@/lib/board";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";

// Admin event -> Community Board upgrade (free, 7 days): create a Board
// post from an event, auto-approved like a paid post once payment
// clears, but with no Stripe checkout and $0. The post is live
// immediately for one week (BOARD_RUN_DAYS * 1). Idempotent per event:
// an event already on the Board returns its existing post instead of
// stacking a duplicate.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await db.event.findUnique({
    where: { id: params.id },
    include: { sponsor: { select: { businessName: true, email: true } } },
  });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const existingPost = await prisma.boardPost.findFirst({
    where: { eventId: event.id },
    select: { id: true, title: true, expiresAt: true },
  });
  if (existingPost) {
    return NextResponse.json({ post: existingPost, already: true });
  }

  // Date/time/location first (the bits a reader needs), then the event's
  // own description, trimmed to the Board's 200-character limit.
  const [y, m, d] = String(event.eventDate).split("-").map(Number);
  const when = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = [event.startTime, event.endTime].filter(Boolean).join(" – ");
  const lead = [when, time, event.location].filter(Boolean).join(" · ");
  const description = [lead, event.description]
    .filter(Boolean)
    .join(". ")
    .slice(0, 200);

  // Receipt email: the event sponsor's when there is one, otherwise the
  // admin who clicked the button. Board posts always need an email.
  let email = event.sponsor?.email ?? "";
  if (!email) {
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: { email: true },
    });
    email = admin?.email ?? "";
  }

  const validated = validateBoardPostInput({
    title: String(event.title ?? "").slice(0, 80),
    description,
    category: "event",
    intent: "event",
    linkUrl: event.url ?? "",
    contactInfo: event.location ?? "",
    displayName: String(event.sponsor?.businessName ?? "").slice(0, 40),
    email,
    runWeeks: 1,
  });
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const input = validated.input;

  const now = new Date();
  const post = await prisma.boardPost.create({
    data: {
      title: input.title,
      description: input.description,
      category: input.category,
      intent: input.intent,
      linkUrl: input.linkUrl || null,
      contactInfo: input.contactInfo || null,
      displayName: input.displayName || null,
      email: input.email,
      status: "active",
      amountCents: 0,
      runWeeks: 1,
      paidAt: now,
      approvedAt: now,
      expiresAt: new Date(now.getTime() + boardRunDays(1) * 24 * 60 * 60 * 1000),
      eventId: event.id,
    },
  });

  return NextResponse.json({
    post: { id: post.id, title: post.title, expiresAt: post.expiresAt },
    already: false,
  });
}
