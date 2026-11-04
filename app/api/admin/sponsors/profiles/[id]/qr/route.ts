import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getWorkspaceUrl } from "@/lib/workspace";
import { buildSponsorQrPng } from "@/lib/sponsor-kit";
import { sponsorPlainSlug, sponsorQrTargetUrl, sponsorSlug } from "@/lib/sponsor-slug";

export const dynamic = "force-dynamic";

// Downloadable QR PNG for one sponsor (Sponsor Amp Kit): encodes the
// sponsor's canonical landing URL with the flyer UTMs baked in, so a
// scan attributes to this sponsor no matter what the form does later.
// Admin-auth only; the prisma client scopes the lookup to the workspace.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({
    where: { id: params.id },
    select: { id: true, businessName: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const appUrl = await getWorkspaceUrl();
  const target = sponsorQrTargetUrl(appUrl, sponsorSlug(profile));
  const png = await buildSponsorQrPng(target);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${sponsorPlainSlug(profile)}-qr.png"`,
      "Cache-Control": "no-store",
    },
  });
}
