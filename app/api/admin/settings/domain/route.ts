import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getUnosendClient } from "@/lib/unosend";

const DOMAIN_ID_KEY = "unosend_domain_id";

async function loadSettings() {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await loadSettings();
  const domainId = settings[DOMAIN_ID_KEY];
  if (!domainId) return NextResponse.json({ domain: null });

  const client = await getUnosendClient(settings);
  if (!client) return NextResponse.json({ domain: null });

  const result = await client.getDomain(domainId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ domain: result.data });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain } = await req.json();
  if (!domain) {
    return NextResponse.json({ error: "Domain name is required." }, { status: 400 });
  }

  const settings = await loadSettings();
  const client = await getUnosendClient(settings);
  if (!client) {
    return NextResponse.json({ error: "Add your Unosend API key first." }, { status: 400 });
  }

  const result = await client.createDomain(domain.trim().toLowerCase());
  if (!result.success || !result.data) {
    return NextResponse.json({ error: result.error || "Failed to create domain." }, { status: 502 });
  }

  await prisma.setting.upsert({
    where: { key: DOMAIN_ID_KEY },
    update: { value: result.data.id },
    create: { key: DOMAIN_ID_KEY, value: result.data.id },
  });

  return NextResponse.json({ domain: result.data });
}
