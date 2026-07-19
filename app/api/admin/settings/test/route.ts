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

  const unosendKey = settings["unosend_api_key"] || process.env.UNOSEND_API_KEY || "";
  const isUnosend = Boolean(unosendKey);

  const client = getEmailClient(settings);
  if (!client) {
    return NextResponse.json(
      { message: "No email provider configured. Add a Unosend API key or SMTP credentials." },
      { status: 400 }
    );
  }

  const result = await client.testConnection();
  if (result.success) {
    const message = isUnosend
      ? `Unosend configured${source === "env" ? " (from env vars)" : ""} — ready to send.`
      : `Connected to ${host} as ${user}${source === "env" ? " (from env vars)" : ""}`;
    return NextResponse.json({ message });
  }

  const err = (result.error || "Unknown error").replace(/^Error:\s*/i, "");
  return NextResponse.json(
    { message: isUnosend ? `Unosend: ${err}` : `${host}: ${err}` },
    { status: 400 }
  );
}
