import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Merge DB settings with any unsaved form values sent in the request body.
  // This lets the test reflect the current toggle state without requiring a save first.
  const body = await req.json().catch(() => ({}));
  const formSettings: Record<string, string> = body.settings || {};

  const rows = await prisma.setting.findMany();
  const dbSettings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // Form takes precedence over DB (but skip masked password placeholders)
  const settings: Record<string, string> = { ...dbSettings };
  for (const [key, value] of Object.entries(formSettings)) {
    if (typeof value === "string" && !value.startsWith("••••")) {
      settings[key] = value;
    }
  }

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
