import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getWorkspaceUrl } from "@/lib/workspace";
import { getEmailClient, htmlToText, type EmailAttachment } from "@/lib/email";
import { buildSponsorQrPng } from "@/lib/sponsor-kit";
import { sponsorPlainSlug, sponsorQrTargetUrl, sponsorSlug } from "@/lib/sponsor-slug";

export const dynamic = "force-dynamic";

// Sponsor Amp Kit email: one personalized email to one sponsor with the
// flyer / QR / graphics attached. Multipart form in, one send out, one
// SponsorKitSend log row. Deliberately separate from the Nurture system
// and from the plain sponsor email tool (which has no attachments).

const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB across all attachments
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "pdf", "gif", "webp"]);

// Same plain-text-to-HTML treatment as the sponsor email tool, so a kit
// body typed as plain text arrives as a properly styled email.
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

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({
    where: { id: params.id },
    select: { id: true, businessName: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form." }, { status: 400 });
  }

  const to = String(form.get("to") || "").trim();
  const subject = String(form.get("subject") || "").trim();
  const body = String(form.get("body") || "").trim();
  const attachQr = form.get("attachQr") !== "false";

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }
  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Body is required." }, { status: 400 });

  const attachments: EmailAttachment[] = [];
  let totalBytes = 0;

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    if (!ALLOWED_EXTENSIONS.has(fileExtension(file.name))) {
      return NextResponse.json(
        { error: `"${file.name}" is not an allowed file type (png, jpg, pdf, gif, webp).` },
        { status: 400 }
      );
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "Attachments total more than 10 MB. Remove a file and try again." },
        { status: 400 }
      );
    }
    attachments.push({
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()),
    });
  }

  if (attachQr) {
    const appUrl = await getWorkspaceUrl();
    const target = sponsorQrTargetUrl(appUrl, sponsorSlug(profile));
    const qrPng = await buildSponsorQrPng(target);
    attachments.push({
      filename: `${sponsorPlainSlug(profile)}-qr.png`,
      content: qrPng,
    });
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
  });
}
