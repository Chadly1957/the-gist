import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/url";
import { sendCommunityBoardConfirmation } from "@/lib/sponsor-week-email";
import { optInSponsorToNewsletter } from "@/lib/sponsor-newsletter-optin";

export const dynamic = "force-dynamic";

// Free Community Board signup: instant acceptance, immediately in rotation.
export async function POST(req: NextRequest) {
  const { businessName, contactName, email, website, description, subscribeNewsletter } = await req.json();

  const trimmedBusiness = businessName?.trim();
  const trimmedContact = contactName?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  const trimmedDescription = description?.trim();
  if (!trimmedBusiness || !trimmedContact || !normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Business name, contact name, and a valid email are required." }, { status: 400 });
  }
  let normalizedWebsite: string | null = null;
  try {
    normalizedWebsite = website ? normalizeUrl(website) : null;
  } catch {
    return NextResponse.json({ error: "That website URL doesn't look right." }, { status: 400 });
  }
  if (!normalizedWebsite) {
    return NextResponse.json({ error: "A website or link is required." }, { status: 400 });
  }
  if (!trimmedDescription) {
    return NextResponse.json({ error: "Please add a one-line description." }, { status: 400 });
  }
  if (trimmedDescription.length > 140) {
    return NextResponse.json({ error: "Keep your description to 140 characters or less." }, { status: 400 });
  }

  // One email can own several businesses: match the exact business so each
  // business keeps its own profile (and portal). Same business reusing the
  // same email reuses its profile.
  let profile = await prisma.sponsorProfile.findFirst({
    where: {
      email: normalizedEmail,
      businessName: { equals: trimmedBusiness, mode: "insensitive" },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!profile) {
    profile = await prisma.sponsorProfile.create({
      data: {
        businessName: trimmedBusiness,
        contactName: trimmedContact,
        email: normalizedEmail,
        website: normalizedWebsite,
      },
    });
  }

  const listing = await prisma.spotlightListing.create({
    data: {
      sponsorId: profile.id,
      businessName: trimmedBusiness,
      description: trimmedDescription,
      ctaUrl: normalizedWebsite,
      ctaLabel: "Visit Website",
      status: "active",
      approvedAt: new Date(),
    },
  });

  const appUrl = await getWorkspaceUrl();
  const portalUrl = `${appUrl}/sponsor/portal?token=${profile.magicToken}`;

  // Newsletter opt-in is explicit consent from the checkbox. It must never
  // fail the signup.
  if (subscribeNewsletter === true) {
    try {
      await optInSponsorToNewsletter(normalizedEmail, trimmedContact);
    } catch (err) {
      console.error("sponsor newsletter opt-in error:", err);
    }
  }

  await sendCommunityBoardConfirmation({
    to: normalizedEmail,
    contactName: profile.contactName,
    businessName: trimmedBusiness,
    portalUrl,
  });

  return NextResponse.json({ listingId: listing.id, token: profile.magicToken, portalUrl });
}
