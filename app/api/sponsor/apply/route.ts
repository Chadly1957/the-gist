import { getWorkspaceUrl } from "@/lib/workspace";
import { workspaceUnique } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/url";
import { sendSponsorPortalEmail } from "@/lib/sponsor-email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { businessName, contactName, email, phone, website } = await req.json();

  if (!businessName || !contactName || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Business name, contact name, and valid email are required." }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  const existing = await prisma.sponsorProfile.findUnique({ where: await workspaceUnique("email", normalized) });
  if (existing) {
    const appUrl = await getWorkspaceUrl();
    const portalUrl = `${appUrl}/sponsor/portal?token=${existing.magicToken}`;
    await sendSponsorPortalEmail(normalized, existing.contactName, portalUrl);
    return NextResponse.json({
      message: "A profile already exists for this email. We've emailed you your portal link.",
      portalUrl,
    });
  }

  const profile = await prisma.sponsorProfile.create({
    data: {
      businessName: businessName.trim(),
      contactName: contactName.trim(),
      email: normalized,
      phone: phone?.trim() || null,
      website: website ? normalizeUrl(website) : null,
    },
  });

  const appUrl = await getWorkspaceUrl();
  const portalUrl = `${appUrl}/sponsor/portal?token=${profile.magicToken}`;
  await sendSponsorPortalEmail(normalized, profile.contactName, portalUrl);

  return NextResponse.json({
    message: "Profile created! We've also emailed you your portal link.",
    portalUrl,
  });
}
