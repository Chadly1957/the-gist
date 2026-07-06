import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEmailClient } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const profile = await prisma.sponsorProfile.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Always return success — don't reveal whether an email exists
  if (!profile) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const portalUrl = `${appUrl}/sponsor/portal?token=${profile.magicToken}`;

  const allSettings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r) => [r.key, r.value])
  );
  const emailClient = getEmailClient(allSettings);
  if (!emailClient) {
    return NextResponse.json({ error: "Email not configured." }, { status: 503 });
  }

  await emailClient.sendEmail({
    to: profile.email,
    subject: "Your Gist Decatur Sponsor Portal Link",
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#166534;padding:20px 32px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#86efac;">Sponsor Portal</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;">The Gist Decatur</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#111827;">Hi ${profile.contactName},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6;">
                Here&apos;s your link to access the ${profile.businessName} sponsor portal. Click below to view your listings, bookings, and analytics.
              </p>
              <a href="${portalUrl}" style="background:#166534;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
                Open My Sponsor Portal →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                This link is unique to your account — keep it private. If you didn&apos;t request this email, you can ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });

  return NextResponse.json({ ok: true });
}
