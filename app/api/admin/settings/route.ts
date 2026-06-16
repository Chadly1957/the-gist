import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

const ALLOWED_KEYS = [
  "unosend_api_key",
  "unosend_list_id",
  "unosend_from_email",
  "unosend_from_name",
  "sponsorship_price_spotlight",
  "sponsorship_price_in_article",
  "sponsorship_price_presenting",
  "spotlight_count",
  "in_article_count",
];

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany({
    where: { key: { in: ALLOWED_KEYS } },
  });

  const settings: Record<string, string> = {};
  for (const row of rows) {
    // Mask API key for display
    if (row.key === "unosend_api_key" && row.value) {
      settings[row.key] = "••••••••" + row.value.slice(-4);
    } else {
      settings[row.key] = row.value;
    }
  }

  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { settings } = await req.json();

  for (const [key, value] of Object.entries(settings)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    // Don't overwrite API key if it's the masked version
    if (key === "unosend_api_key" && String(value).startsWith("••••")) continue;

    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  return NextResponse.json({ ok: true });
}
