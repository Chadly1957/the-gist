import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";

export const dynamic = "force-dynamic";

// Nurture email opt-out: sets nurtureOptOut on the profile behind the
// magic token. The token is the same unguessable portal token the
// business already uses, so no extra credential is needed.
export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 400 });
  const profile = await basePrisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Link not recognized." }, { status: 404 });
  await basePrisma.sponsorProfile.update({
    where: { id: profile.id },
    data: { nurtureOptOut: true },
  });
  return NextResponse.json({ ok: true, businessName: profile.businessName });
}
