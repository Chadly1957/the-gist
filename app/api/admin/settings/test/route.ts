import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient } from "@/lib/email";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // Resolve effective values (DB takes precedence, then env vars)
  const host = settings["smtp_host"] || process.env.SMTP_HOST || "";
  const user = settings["smtp_user"] || process.env.SMTP_USER || "";
  const source = settings["smtp_host"] ? "database" : process.env.SMTP_HOST ? "env" : "";

  const client = getEmailClient(settings);
  if (!client) {
    return NextResponse.json(
      { message: "SMTP credentials must be configured first." },
      { status: 400 }
    );
  }

  const result = await client.testConnection();
  if (result.success) {
    return NextResponse.json({
      message: `Connected to ${host} as ${user}${source === "env" ? " (from env vars)" : ""}`,
    });
  }

  // Strip verbose nodemailer prefix from error for readability
  const err = (result.error || "Unknown error").replace(/^Error:\s*/i, "");
  return NextResponse.json(
    { message: `${host}: ${err}` },
    { status: 400 }
  );
}
