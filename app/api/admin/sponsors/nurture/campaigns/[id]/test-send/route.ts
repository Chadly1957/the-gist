import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadNurtureMailer, sendNurtureEmail } from "@/lib/sponsor-nurture-mailer";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const TEST_RECIPIENT_EMAIL = "chad@thegistdecatur.com";

// Send the current draft to Chad only, with merge tags filled from a
// sample business so he sees exactly what a business receives.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.sponsorEmailCampaign.findUnique({ where: { id: params.id } });
  if (!campaign) return NextResponse.json({ error: "Email not found." }, { status: 404 });

  const workspace = await getWorkspace();
  const { client, appUrl } = await loadNurtureMailer();
  if (!client) return NextResponse.json({ error: "Email is not configured for this workspace." }, { status: 503 });

  await sendNurtureEmail({
    client,
    workspaceName: workspace.name,
    brandColor: workspace.primaryColor || "#15803d",
    appUrl,
    recipient: {
      id: "test",
      businessName: "Sample Bakery",
      contactName: "Sam",
      email: TEST_RECIPIENT_EMAIL,
      magicToken: "test",
    },
    subject: `[TEST] ${campaign.subject || "(no subject yet)"}`,
    blocksJson: campaign.blocks,
  });
  return NextResponse.json({ ok: true, sentTo: TEST_RECIPIENT_EMAIL });
}
