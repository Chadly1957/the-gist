import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

const ALLOWED_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "smtp_from",
  "smtp_from_name",
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
    if (row.key === "smtp_pass" && row.value) {
      settings[row.key] = "••••••••" + row.value.slice(-4);
    } else {
      settings[row.key] = row.value;
    }
  }

  const smtpRow = rows.reduce<Record<string, string>>((acc, r) => { acc[r.key] = r.value; return acc; }, {});
  const hasSmtp = Boolean(
    (smtpRow["smtp_host"] || process.env.SMTP_HOST) &&
    (smtpRow["smtp_user"] || process.env.SMTP_USER) &&
    (smtpRow["smtp_pass"] || process.env.SMTP_PASS)
  );

  return NextResponse.json({ settings, hasSmtp });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { settings } = await req.json();

  for (const [key, value] of Object.entries(settings)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    if (key === "smtp_pass" && String(value).startsWith("••••")) continue;

    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  return NextResponse.json({ ok: true });
}
