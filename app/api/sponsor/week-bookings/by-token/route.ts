import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";

export const dynamic = "force-dynamic";

// Public-safe prefill for the renewal rebook link (?rebook=token).
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 400 });
  const workspace = await getWorkspace();
  const booking = await basePrisma.sponsorWeekBooking.findFirst({
    where: { workspaceId: workspace.id, rebookToken: token, status: { in: ["paid", "completed"] } },
    select: {
      businessName: true, contactName: true, email: true, website: true,
      logoUrl: true, aboutText: true, tier: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "That link isn't valid anymore." }, { status: 404 });
  return NextResponse.json(booking);
}
