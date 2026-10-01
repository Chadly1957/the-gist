import { getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSponsorPortalLinksEmail } from "@/lib/sponsor-email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();
  // One email can own several businesses: send every portal link.
  const profiles = await prisma.sponsorProfile.findMany({
    where: { email: normalized },
    orderBy: { createdAt: "asc" },
  });

  // Always return success — don't reveal whether an email exists
  if (profiles.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = await getWorkspaceUrl();
  await sendSponsorPortalLinksEmail(
    normalized,
    profiles[0].contactName,
    profiles.map((p) => ({
      businessName: p.businessName,
      portalUrl: `${appUrl}/sponsor/portal?token=${p.magicToken}`,
    }))
  );

  return NextResponse.json({ ok: true });
}
