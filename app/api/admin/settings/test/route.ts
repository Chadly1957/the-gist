import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient } from "@/lib/email";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const provider = settings["email_provider"] || process.env.EMAIL_PROVIDER || "";
  const resendKey = settings["resend_api_key"] || process.env.RESEND_API_KEY || "";
  const unosendKey = settings["unosend_api_key"] || process.env.UNOSEND_API_KEY || "";
  const smtpHost = settings["smtp_host"] || process.env.SMTP_HOST || "";
  const smtpUser = settings["smtp_user"] || process.env.SMTP_USER || "";

  const activeProvider =
    provider === "resend" ? "resend"
    : provider === "unosend" ? "unosend"
    : provider === "smtp" ? "smtp"
    : resendKey ? "resend"
    : unosendKey ? "unosend"
    : smtpHost ? "smtp"
    : "";

  const client = getEmailClient(settings);
  if (!client) {
    return NextResponse.json(
      { message: "No email provider configured. Select and configure a provider in Settings." },
      { status: 400 }
    );
  }

  const result = await client.testConnection();
  if (result.success) {
    const message =
      activeProvider === "resend" ? "Resend connected — ready to send."
      : activeProvider === "unosend" ? "Unosend connected — ready to send."
      : `Connected to ${smtpHost} as ${smtpUser}`;
    return NextResponse.json({ message });
  }

  const err = (result.error || "Unknown error").replace(/^Error:\s*/i, "");
  const label =
    activeProvider === "resend" ? "Resend"
    : activeProvider === "unosend" ? "Unosend"
    : smtpHost;
  return NextResponse.json({ message: `${label}: ${err}` }, { status: 400 });
}
