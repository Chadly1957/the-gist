import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSponsorPortalLinksEmail } from "@/lib/sponsor-email";

export const dynamic = "force-dynamic";

// Email-first gate for the sponsor page: is this business already in the
// system? Returning businesses get their sponsor portal link(s) emailed
// (one per business under the email, same helper as /resend-portal) and
// never see a signup form, so nurture-email traffic can't create
// duplicate profiles or duplicate listings. New emails fall through to
// the free signup form. Business names are public (they are listed on
// /partners), so returning them to the page is safe; portal access still
// requires the emailed token link.
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string" || !email.trim().includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();

  await getWorkspace(); // resolves the workspace so prisma scopes to it
  const profiles = await prisma.sponsorProfile.findMany({
    where: { email: { equals: normalized, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { businessName: true, contactName: true, magicToken: true },
  });

  if (profiles.length === 0) {
    return NextResponse.json({ found: false });
  }

  const appUrl = await getWorkspaceUrl();
  let emailed = true;
  try {
    await sendSponsorPortalLinksEmail(
      normalized,
      profiles[0].contactName,
      profiles.map((p) => ({
        businessName: p.businessName,
        portalUrl: `${appUrl}/sponsor/portal?token=${p.magicToken}`,
      }))
    );
  } catch (err) {
    emailed = false;
    console.error("sponsor lookup portal email failed:", err);
  }

  return NextResponse.json({
    found: true,
    emailed,
    businesses: profiles.map((p) => p.businessName),
  });
}
