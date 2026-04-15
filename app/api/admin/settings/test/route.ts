import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getUnosendClient } from "@/lib/unosend";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const client = await getUnosendClient(settings);
  if (!client) {
    return NextResponse.json(
      { message: "API key and List ID must be configured first." },
      { status: 400 }
    );
  }

  const result = await client.getListStats();
  if (result.success) {
    const stats = result.data as { total?: number; active?: number } | undefined;
    return NextResponse.json({
      message: `Connected! List has ${stats?.active ?? stats?.total ?? "?"} subscribers.`,
    });
  }

  return NextResponse.json(
    { message: `Connection failed: ${result.error}` },
    { status: 400 }
  );
}
