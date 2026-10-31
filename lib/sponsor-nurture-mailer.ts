import { prisma } from "./db";
import { getEmailClient } from "./email";
import { getWorkspace, getWorkspaceUrl } from "./workspace";
import { renderNurtureEmail, renderNurtureSubject } from "./sponsor-nurture-render";
import { parseBlocks, type NurtureRecipient } from "./sponsor-nurture-shared";

// Shared sending plumbing for the nurture routes: resolves the workspace
// email client the same way the sponsor portal emails do.

export async function loadNurtureMailer() {
  const workspace = await getWorkspace();
  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const client = await getEmailClient(settings);
  const appUrl = await getWorkspaceUrl();
  return { workspace, client, appUrl };
}

export async function sendNurtureEmail(args: {
  client: NonNullable<Awaited<ReturnType<typeof loadNurtureMailer>>["client"]>;
  workspaceName: string;
  brandColor: string;
  appUrl: string;
  recipient: NurtureRecipient;
  subject: string;
  blocksJson: string;
}): Promise<void> {
  const html = renderNurtureEmail(parseBlocks(args.blocksJson), {
    businessName: args.recipient.businessName,
    contactName: args.recipient.contactName,
    workspaceName: args.workspaceName,
    brandColor: args.brandColor,
    appUrl: args.appUrl,
    portalUrl: `${args.appUrl}/sponsor/portal?token=${args.recipient.magicToken}`,
    unsubscribeUrl: `${args.appUrl}/sponsor/nurture-unsubscribe?token=${args.recipient.magicToken}`,
  });
  await args.client.sendEmail({
    to: args.recipient.email,
    subject: renderNurtureSubject(args.subject, args.recipient),
    htmlBody: html,
  });
}
