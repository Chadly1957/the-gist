import { prisma } from "@/lib/db";
import { getEmailClient } from "@/lib/email";

function portalEmailHtml(contactName: string, portalUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #111827; margin: 0 0 12px;">Your Sponsor Portal</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Hi ${contactName}, here's your personal link to The Gist Decatur sponsor portal. Use it to submit listings, book ad dates, and check your status.
      </p>
      <p style="margin: 24px 0;">
        <a href="${portalUrl}" style="background: #146763; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Go to My Sponsor Portal
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Or copy this link: ${portalUrl}</p>
    </div>
  `;
}

export async function sendSponsorPortalEmail(
  to: string,
  contactName: string,
  portalUrl: string
): Promise<void> {
  try {
    const rows = await prisma.setting.findMany();
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const client = getEmailClient(settings);
    if (!client) return;

    await client.sendEmail({
      to,
      subject: "Your Sponsor Portal Link: The Gist Decatur",
      htmlBody: portalEmailHtml(contactName, portalUrl),
    });
  } catch (err) {
    console.error("Failed to send sponsor portal email:", err);
  }
}
