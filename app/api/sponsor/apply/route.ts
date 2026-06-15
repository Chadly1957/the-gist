import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { businessName, contactName, email, phone, website } = await req.json();

  if (!businessName || !contactName || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Business name, contact name, and valid email are required." }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  const existing = await prisma.sponsorProfile.findUnique({ where: { email: normalized } });
  if (existing) {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    return NextResponse.json({
      message: "A profile already exists for this email.",
      portalUrl: `${appUrl}/sponsor/portal?token=${existing.magicToken}`,
    });
  }

  const profile = await prisma.sponsorProfile.create({
    data: {
      businessName: businessName.trim(),
      contactName: contactName.trim(),
      email: normalized,
      phone: phone?.trim() || null,
      website: website?.trim() || null,
    },
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return NextResponse.json({
    message: "Profile created!",
    portalUrl: `${appUrl}/sponsor/portal?token=${profile.magicToken}`,
  });
}
