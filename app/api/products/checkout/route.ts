import { NextRequest, NextResponse } from "next/server";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export const PRODUCT_STRIPE_KIND = "product";

// POST /api/products/checkout { productId, email }
// Creates a pending ProductOrder, then a Stripe Checkout session. The
// webhook marks the order paid on checkout.session.completed.
export async function POST(req: NextRequest) {
  const { productId, email } = await req.json().catch(() => ({}));
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments are not configured right now. Please try again later." }, { status: 503 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, status: "active" },
    select: { id: true, name: true, slug: true, priceCents: true, imageUrl: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const workspace = await getWorkspace();
  const appUrl = await getWorkspaceUrl();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const order = await prisma.productOrder.create({
    data: { productId: product.id, email: normalizedEmail, amountCents: product.priceCents, status: "pending_payment" },
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
            unit_amount: product.priceCents,
            product_data: {
              name: product.name,
              ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
            },
          },
          quantity: 1,
        },
      ],
      customer_email: normalizedEmail,
      success_url: `${appUrl}/products/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/products/${product.slug}?cancelled=1`,
      metadata: {
        workspaceId: workspace.id,
        kind: PRODUCT_STRIPE_KIND,
        productId: product.id,
        orderId: order.id,
        email: normalizedEmail,
      },
    });
  } catch (err) {
    console.error("product checkout stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  await prisma.productOrder.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
