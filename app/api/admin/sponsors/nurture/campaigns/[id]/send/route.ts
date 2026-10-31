import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { isNurtureAudience, resolveNurtureRecipients, type NurtureAudience } from "@/lib/sponsor-nurture";
import { loadNurtureMailer, sendNurtureEmail } from "@/lib/sponsor-nurture-mailer";

export const dynamic = "force-dynamic";

// Send a draft campaign to its whole audience segment. One email per
// business profile; failures are counted, never fatal mid-send.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.sponsorEmailCampaign.findUnique({ where: { id: params.id } });
  if (!campaign) return NextResponse.json({ error: "Email not found." }, { status: 404 });
  if (campaign.status === "sent") return NextResponse.json({ error: "This email was already sent. Duplicate it to send again." }, { status: 409 });
  if (campaign.status === "sending") return NextResponse.json({ error: "This email is already sending." }, { status: 409 });
  if (!campaign.subject.trim()) return NextResponse.json({ error: "Add a subject line before sending." }, { status: 400 });

  const workspace = await getWorkspace();
  const audience: NurtureAudience = isNurtureAudience(campaign.audience) ? campaign.audience : "free";
  const recipients = await resolveNurtureRecipients(workspace.id, audience);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "That audience has no businesses to email right now." }, { status: 400 });
  }

  const { client, appUrl } = await loadNurtureMailer();
  if (!client) return NextResponse.json({ error: "Email is not configured for this workspace." }, { status: 503 });

  await prisma.sponsorEmailCampaign.update({ where: { id: campaign.id }, data: { status: "sending" } });

  let failed = 0;
  for (const recipient of recipients) {
    try {
      await sendNurtureEmail({
        client,
        workspaceName: workspace.name,
        brandColor: workspace.primaryColor || "#15803d",
        appUrl,
        recipient,
        subject: campaign.subject,
        blocksJson: campaign.blocks,
      });
    } catch (err) {
      failed++;
      console.error(`Nurture send failed for ${recipient.email}:`, err);
    }
  }

  const updated = await prisma.sponsorEmailCampaign.update({
    where: { id: campaign.id },
    data: { status: "sent", sentAt: new Date(), recipientCount: recipients.length, failedCount: failed },
  });
  return NextResponse.json({ ok: true, recipientCount: updated.recipientCount, failedCount: updated.failedCount });
}
