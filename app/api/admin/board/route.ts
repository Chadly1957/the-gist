import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { BOARD_RUN_DAYS } from "@/lib/board";

export const dynamic = "force-dynamic";

// GET /api/admin/board — this workspace's board posts, newest first.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getWorkspace();
  const posts = await prisma.boardPost.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      linkUrl: true,
      contactInfo: true,
      displayName: true,
      email: true,
      status: true,
      amountCents: true,
      paidAt: true,
      approvedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ posts });
}

// PATCH /api/admin/board { id, action: "approve" | "reject" }
// Approve starts the 7-day run now. Reject refunds the $5 (when a payment
// intent is on file) and marks the post rejected; a failed refund still
// rejects but reports it so it can be refunded manually in Stripe.
export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getWorkspace();
  const { id, action } = await req.json().catch(() => ({}));
  if (!id || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Post id and a valid action are required." }, { status: 400 });
  }
  const post = await prisma.boardPost.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (action === "approve") {
    if (post.status !== "pending_approval") {
      return NextResponse.json({ error: "Only posts awaiting approval can be approved." }, { status: 400 });
    }
    const approvedAt = new Date();
    const expiresAt = new Date(approvedAt.getTime() + BOARD_RUN_DAYS * 24 * 60 * 60 * 1000);
    const updated = await prisma.boardPost.update({
      where: { id: post.id },
      data: { status: "active", approvedAt, expiresAt },
    });
    return NextResponse.json({ post: updated });
  }

  if (post.status !== "pending_approval" && post.status !== "active") {
    return NextResponse.json({ error: "Only awaiting or active posts can be rejected." }, { status: 400 });
  }
  let refunded = false;
  let refundError: string | null = null;
  if (post.stripePaymentIntent && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.refunds.create({ payment_intent: post.stripePaymentIntent });
      refunded = true;
    } catch (e) {
      refundError = e instanceof Error ? e.message : "Refund failed.";
    }
  }
  const updated = await prisma.boardPost.update({
    where: { id: post.id },
    data: { status: "rejected" },
  });
  return NextResponse.json({ post: updated, refunded, refundError });
}
