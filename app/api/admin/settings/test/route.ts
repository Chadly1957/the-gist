import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient } from "@/lib/email";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const client = getEmailClient(settings);
  if (!client) {
    return NextResponse.json(
      { message: "SMTP credentials must be configured first." },
      { status: 400 }
    );
  }

  const result = await client.testConnection();
  if (result.success) {
    return NextResponse.json({ message: "SMTP connection successful!" });
  }

  return NextResponse.json(
    { message: `Connection failed: ${result.error}` },
    { status: 400 }
  );
}
