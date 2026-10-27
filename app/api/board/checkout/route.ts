import { NextRequest, NextResponse } from "next/server";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { BOARD_PRICE_CENTS, validateBoardPostInput } from "@/lib/board";

export const dynamic = "force-dynamic";

// POST /api/board/checkout { title, description, category, linkUrl,
// contactInfo, displayName, email }
// Creates a pending BoardPost, then a Stripe Checkout session for the flat
// $5. The webhook marks the post paid (pending_approval) on
// checkout.session.completed; an admin approval starts the 7-day run.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const validated = validateBoardPostInput(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments are not configured right now. Please try again later." }, { status: 503 });
  }

  const workspace = await getWorkspace();
  const appUrl = await getWorkspaceUrl();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const input = validated.input;

  const post = await prisma.boardPost.create({
    data: {
      workspaceId: workspace.id,
      title: input.title,
      description: input.description,
      category: input.category,
      intent: input.intent || null,
      linkUrl: input.linkUrl || null,
      contactInfo: input.contactInfo || null,
      displayName: input.displayName || null,
      email: input.email,
      status: "pending_payment",
      amountCents: BOARD_PRICE_CENTS,
    },
  });

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: BOARD_PRICE_CENTS,
            product_data: { name: `Gist Board post: ${input.title}` },
          },
          quantity: 1,
        },
      ],
      customer_email: input.email,
      success_url: `${appUrl}/board/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/board/post?cancelled=1`,
      metadata: {
        workspaceId: workspace.id,
        kind: "board_post",
        boardPostId: post.id,
        email: input.email,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  await prisma.boardPost.update({
    where: { id: post.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
