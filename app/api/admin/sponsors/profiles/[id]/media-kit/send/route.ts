import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient, htmlToText, type EmailAttachment } from "@/lib/email";
import { buildMediaKit, MediaKitMissingTemplatesError } from "@/lib/media-kit";
import { sponsorPlainSlug } from "@/lib/sponsor-slug";

export const dynamic = "force-dynamic";

// Media Kit send: generates the kit server-side for one sponsor and
// emails it in one go (flyer PDF + PNG, social PNG, standalone QR PNG)
// through the workspace email client, then logs a SponsorKitSend row,
// the same pattern as the Amp Kit email. Attachments are built here,
// never uploaded back by the browser.
//
// Size guard: the kit email flow caps attachments at 10 MB total. The
// flyer PNG is the only piece that can grow past that on its own (a
// photographic 2550x3300 template); when the total would exceed the
// cap, the flyer PNG is left off and the print-ready PDF still goes.
// The response says which files were attached so the admin sees it.

const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

// Same plain-text-to-HTML treatment as the kit email route.
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({
    where: { id: params.id },
    select: { id: true, businessName: true, logoUrl: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let payload: { to?: unknown; subject?: unknown; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }
  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Body is required." }, { status: 400 });

  let kit;
  try {
    kit = await buildMediaKit(profile);
  } catch (err) {
    if (err instanceof MediaKitMissingTemplatesError) {
      return NextResponse.json({ error: err.message, missing: err.missing }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Media kit generation failed." },
      { status: 502 }
    );
  }

  const plain = sponsorPlainSlug(profile);
  const flyerPdf: EmailAttachment = { filename: `${plain}-flyer.pdf`, content: kit.flyerPdf };
  const flyerPng: EmailAttachment = { filename: `${plain}-flyer.png`, content: kit.flyerPng };
  const socialPng: EmailAttachment = { filename: `${plain}-social.png`, content: kit.socialPng };
  const qrPng: EmailAttachment = { filename: `${plain}-qr.png`, content: kit.qrPng };

  const attachments: EmailAttachment[] = [flyerPdf, flyerPng, socialPng, qrPng];
  let flyerPngDropped = false;
  const totalBytes = attachments.reduce((sum, a) => sum + a.content.length, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    attachments.splice(1, 1);
    flyerPngDropped = true;
  }
  const finalBytes = attachments.reduce((sum, a) => sum + a.content.length, 0);
  if (finalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "The generated kit is still over the 10 MB email limit even without the flyer PNG. Try a lighter template image." },
      { status: 400 }
    );
  }

  const allSettings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r) => [r.key, r.value])
  );
  const emailClient = await getEmailClient(allSettings);
  if (!emailClient) {
    return NextResponse.json(
      { error: "Email is not configured for this workspace. Add credentials in Settings." },
      { status: 503 }
    );
  }

  const htmlBody = ensureHtml(body);
  const result = await emailClient.sendEmail({
    to,
    subject,
    htmlBody,
    textBody: htmlToText(htmlBody),
    attachments,
  });
  if (!result.success) {
    return NextResponse.json({ error: `Send failed: ${result.error}` }, { status: 502 });
  }

  await prisma.sponsorKitSend.create({
    data: {
      sponsorId: profile.id,
      subject,
      attachmentNames: attachments.map((a) => a.filename).join(", "),
    },
  });

  return NextResponse.json({
    sent: 1,
    attachments: attachments.map((a) => a.filename),
    flyerPngDropped,
    usedLogoFallback: kit.usedLogoFallback,
    logoFallbackReason: kit.logoFallbackReason,
  });
}
