import { getWorkspaceUrl } from "@/lib/workspace";
import { workspaceUnique } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSponsorPortalEmail } from "@/lib/sponsor-email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();
  const profile = await prisma.sponsorProfile.findUnique({ where: await workspaceUnique("email", normalized) });

  if (profile) {
    const appUrl = await getWorkspaceUrl();
    const portalUrl = `${appUrl}/sponsor/portal?token=${profile.magicToken}`;
    await sendSponsorPortalEmail(normalized, profile.contactName, portalUrl);
  }

  return NextResponse.json({
    message: "If a sponsor profile exists for that email, we've sent the portal link.",
  });
}
