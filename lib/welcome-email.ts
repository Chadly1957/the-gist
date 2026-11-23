import { prisma } from "@/lib/db";
import { getEmailClient } from "@/lib/email";
import { getWorkspace } from "@/lib/workspace";

export interface WelcomeEmailContent {
  subject: string;
  textBody: string;
  htmlBody: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The first email a new subscriber ever gets from us. It used to be a
// re-send of the latest newsletter issue, which is a heavy, link-filled
// email for a first contact: if it landed in Promotions or spam, the
// reader might never see a first issue at all. This is the opposite: a
// short, plain note from Chad with no images, no newsletter content, and
// one link (the homepage). Its whole job is to start a real conversation
// and to get tomorrow's issue into the main inbox.
//
// Pure + exported so the copy is unit-testable without a database.
export function buildWelcomeEmail(opts: {
  newsletterName: string;
  area: string;
  isEffingham: boolean;
  fromEmail: string;
  appUrl: string;
}): WelcomeEmailContent {
  const subject = `Welcome to ${opts.newsletterName}`;

  const firstIssueLine = opts.isEffingham
    ? "Your first issue shows up tomorrow around 11 AM."
    : "Your first issue shows up tomorrow morning.";

  const addContactAsk = opts.fromEmail
    ? `It also helps to star it, and adding ${opts.fromEmail} to your contacts helps most of all.`
    : "It also helps to star it, and adding this address to your contacts helps most of all.";

  const paragraphs = [
    `Hey there. Chad here. Thanks for signing up for ${opts.newsletterName}.`,
    `This is just a quick hello before your first issue arrives. Every morning I put together a short email with the local news, events, and other things worth knowing around ${opts.area}. Nothing fancy. Just the gist.`,
    firstIssueLine,
    `One small favor first. A first email from somebody new sometimes lands in the Promotions tab, or even in spam. If that is where this one ended up, could you move it to your main inbox? ${addContactAsk} That tells your email app you actually want these, so the newsletter lands in the right place from here on.`,
    `And if you have ten seconds, hit reply and say hi. Tell me where around ${opts.area} you live, or how you heard about us. I read every reply myself. A reply also shows your email app this is a real conversation, which helps the issues reach you.`,
    `Glad you are here.`,
  ];

  const signoffText = `Chad\n${opts.newsletterName}\n${opts.appUrl}`;
  const textBody = [...paragraphs, signoffText].join("\n\n");

  const htmlParagraphs = paragraphs
    .map(
      (p) =>
        `    <p style="margin: 0 0 16px;">${escapeHtml(p)}</p>`
    )
    .join("\n");
  const htmlBody = `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px 16px; font-family: Georgia, serif; font-size: 16px; line-height: 1.6; color: #222222;">
${htmlParagraphs}
    <p style="margin: 0;">Chad<br>${escapeHtml(opts.newsletterName)}<br><a href="${escapeHtml(opts.appUrl)}">${escapeHtml(opts.appUrl.replace(/^https?:\/\//, ""))}</a></p>
  </div>
</body>
</html>`;

  return { subject, textBody, htmlBody };
}

// Sends the clean welcome email to one new subscriber. Called from the
// public subscribe route, the referral signup route, the sponsor
// newsletter opt-in, and the admin subscriber import (for newly created
// subscribers). Never sends newsletter content. Callers wrap this in
// try/catch: a welcome failure must not break the signup itself.
export async function sendWelcomeEmail(
  subscriber: { id: string; email: string },
  appUrl: string
): Promise<void> {
  const allSettings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r) => [r.key, r.value])
  );
  const emailClient = await getEmailClient(allSettings);
  if (!emailClient) return;

  const workspace = await getWorkspace();
  const content = buildWelcomeEmail({
    newsletterName: workspace.name,
    area: workspace.area,
    isEffingham: workspace.slug === "effingham" || workspace.id === "effingham",
    fromEmail: workspace.domain ? `chad@${workspace.domain}` : "",
    appUrl,
  });

  await emailClient.sendEmail({
    to: subscriber.email,
    subject: content.subject,
    htmlBody: content.htmlBody,
    textBody: content.textBody,
    headers: {
      // Points at the unsubscribe page (email prefilled), which works
      // with just the address. No List-Unsubscribe-Post one-click header:
      // that path requires a NewsletterRecipient id, and the welcome
      // email is deliberately not tied to a newsletter send.
      "List-Unsubscribe": `<${appUrl}/unsubscribe?email=${encodeURIComponent(subscriber.email)}>`,
    },
  });
}
