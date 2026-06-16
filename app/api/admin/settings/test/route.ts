import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getResendClient } from "@/lib/resend";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const client = await getResendClient(settings);
  if (!client) {
    return NextResponse.json(
      { message: "API key must be configured first." },
      { status: 400 }
    );
  }

  const result = await client.testConnection();
  if (result.success) {
    return NextResponse.json({ message: "Connected to Resend!" });
  }

  return NextResponse.json(
    { message: `Connection failed: ${result.error}` },
    { status: 400 }
  );
}
