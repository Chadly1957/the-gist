import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient, htmlToText } from "@/lib/email";

// If the body looks like plain text (no HTML tags), convert it to a
// properly styled HTML email so paragraphs and line breaks are preserved.
function ensureHtml(body: string): string {
  if (/<[a-z][\s\S]*>/i.test(body)) return body;

  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escaped
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p style="margin:0 0 16px 0">${p.trim().replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#333333;max-width:600px;margin:0 auto;padding:24px 20px">
${paragraphs}
</body></html>`;
}

function personalizeBody(
  body: string,
  profile: { businessName: string; contactName: string; magicToken: string },
  appUrl: string
) {
  return body
    .replaceAll("{{BUSINESS_NAME}}", profile.businessName)
    .replaceAll("{{CONTACT_NAME}}", profile.contactName)
    .replaceAll("{{PORTAL_URL}}", `${appUrl}/sponsor/portal?token=${profile.magicToken}`);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId, bulk, subject, htmlBody, excludedIds } = await req.json();

  if (!subject?.trim() || !htmlBody?.trim()) {
    return NextResponse.json({ error: "Subject and body are required." }, { status: 400 });
  }
  if (!profileId && !bulk) {
    return NextResponse.json({ error: "Specify a profileId or set bulk: true." }, { status: 400 });
  }

  const allSettings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r) => [r.key, r.value])
  );
  const emailClient = getEmailClient(allSettings);
  if (!emailClient) {
    return NextResponse.json(
      { error: "SMTP is not configured. Add your credentials in Settings." },
      { status: 503 }
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const preparedBody = ensureHtml(htmlBody);

  if (profileId) {
    const profile = await prisma.sponsorProfile.findUnique({ where: { id: profileId } });
    if (!profile) return NextResponse.json({ error: "Sponsor not found." }, { status: 404 });

    const body = personalizeBody(preparedBody, profile, appUrl);
    const result = await emailClient.sendEmail({
      to: profile.email,
      subject,
      htmlBody: body,
      textBody: htmlToText(body),
    });
    if (!result.success) {
      return NextResponse.json({ error: `Send failed: ${result.error}` }, { status: 502 });
    }
    return NextResponse.json({ sent: 1, failed: 0 });
  }

  // Bulk — send to all active sponsor profiles (minus any the admin excluded)
  const excluded = Array.isArray(excludedIds) ? excludedIds as string[] : [];
  const profiles = await prisma.sponsorProfile.findMany({
    where: { active: true, ...(excluded.length > 0 ? { id: { notIn: excluded } } : {}) },
  });
  if (profiles.length === 0) return NextResponse.json({ sent: 0, failed: 0 });

  const emails = profiles.map((p) => ({
    to: p.email,
    subject,
    htmlBody: personalizeBody(preparedBody, p, appUrl),
    textBody: htmlToText(personalizeBody(preparedBody, p, appUrl)),
  }));

  const result = await emailClient.sendBatch(emails);
  const sent = result.data?.filter((d) => d.id !== undefined).length ?? 0;
  const failed = profiles.length - sent;
  return NextResponse.json({ sent, failed });
}
