import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["draft", "active", "archived"];

// GET /api/admin/products/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json({ product });
}

// PATCH /api/admin/products/[id] — update any editable field, incl. status.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.tagline === "string") data.tagline = body.tagline.trim() || null;
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (body.priceCents !== undefined) {
    const priceCents = Math.round(Number(body.priceCents) || 0);
    if (priceCents <= 0) return NextResponse.json({ error: "Price must be greater than zero." }, { status: 400 });
    data.priceCents = priceCents;
  }
  if (body.compareAtCents !== undefined) {
    data.compareAtCents = body.compareAtCents ? Math.round(Number(body.compareAtCents)) : null;
  }
  if (body.imageUrl !== undefined) data.imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  if (Array.isArray(body.galleryUrls)) data.galleryUrls = body.galleryUrls.filter((u) => typeof u === "string" && u).slice(0, 6);
  if (typeof body.fulfillmentNote === "string") data.fulfillmentNote = body.fulfillmentNote.trim() || null;
  if (body.quantity !== undefined) {
    if (body.quantity === null) {
      data.quantity = null;
    } else {
      const q = Math.floor(Number(body.quantity));
      if (!Number.isFinite(q) || q < 0) return NextResponse.json({ error: "Quantity must be zero or more (leave blank for unlimited)." }, { status: 400 });
      data.quantity = q;
    }
  }
  if (typeof body.requiresShipping === "boolean") data.requiresShipping = body.requiresShipping;
  if (body.stripePaymentLinkId !== undefined) {
    data.stripePaymentLinkId = typeof body.stripePaymentLinkId === "string" && body.stripePaymentLinkId.trim() ? body.stripePaymentLinkId.trim() : null;
  }
  if (typeof body.status === "string") {
    if (!VALID_STATUS.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    data.status = body.status;
  }
  // Slug is intentionally not editable after creation: shared links must not break.

  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json({ ok: true, product });
}
