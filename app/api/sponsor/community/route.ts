import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/url";
import { sendCommunityBoardConfirmation } from "@/lib/sponsor-week-email";
import { optInSponsorToNewsletter } from "@/lib/sponsor-newsletter-optin";
import { isPartnerCategory } from "@/lib/partner-categories";

export const dynamic = "force-dynamic";

// Free Community Board signup: instant acceptance, immediately in rotation.
export async function POST(req: NextRequest) {
  const { businessName, contactName, email, website, description, subscribeNewsletter, category } = await req.json();

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
  if (trimmedDescription.length > 300) {
    return NextResponse.json({ error: "Keep your description to 300 characters or less." }, { status: 400 });
  }
  // Directory category: optional at the API, required by the signup form.
  // Anything unrecognized is stored as null rather than rejected, so an old
  // client can never lose a signup over it.
  const validCategory = isPartnerCategory(category) ? category : null;

  // One submit creates/updates the PROFILE (single source of truth for
  // the business's public info) and the listing together. A returning
  // business re-submitting the form updates the profile's
  // description/category too, so the portal and directory always show
  // what the business last typed.
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
        description: trimmedDescription,
        category: validCategory,
      },
    });
  } else {
    profile = await prisma.sponsorProfile.update({
      where: { id: profile.id },
      data: { description: trimmedDescription, category: validCategory },
    });
  }

  // A returning business re-submitting the form (same email + business)
  // reuses its existing listing instead of stacking a duplicate in the
  // directory. The confirmation email below still goes out, so they get a
  // fresh portal link either way. The listing keeps a snapshot of the
  // profile fields (legacy columns, see schema), updated here so it
  // never drifts from the profile.
  const existingListing = await prisma.spotlightListing.findFirst({
    where: { sponsorId: profile.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const listingData = {
    businessName: profile.businessName,
    description: trimmedDescription,
    ctaUrl: normalizedWebsite,
    category: validCategory,
  };
  const listing =
    existingListing
      ? await prisma.spotlightListing.update({ where: { id: existingListing.id }, data: listingData })
      : await prisma.spotlightListing.create({
          data: {
            sponsorId: profile.id,
            ...listingData,
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
