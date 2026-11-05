import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { buildMediaKitPreview, MediaKitMissingTemplatesError } from "@/lib/media-kit";

export const dynamic = "force-dynamic";

// Media Kit preview for one sponsor (Admin > Sponsors > Profiles):
// composes the flyer and social images from the workspace templates
// and returns downscaled previews plus a note when the business-name
// fallback stood in for a missing/unloadable logo. Sends nothing.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({
    where: { id: params.id },
    select: { id: true, businessName: true, logoUrl: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const preview = await buildMediaKitPreview(profile);
    return NextResponse.json(preview);
  } catch (err) {
    if (err instanceof MediaKitMissingTemplatesError) {
      return NextResponse.json({ error: err.message, missing: err.missing }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview failed." },
      { status: 502 }
    );
  }
}
