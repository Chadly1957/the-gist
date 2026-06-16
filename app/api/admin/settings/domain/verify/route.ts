import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getUnosendClient } from "@/lib/unosend";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const domainId = settings["unosend_domain_id"];
  if (!domainId) {
    return NextResponse.json({ error: "No domain connected yet." }, { status: 400 });
  }

  const client = await getUnosendClient(settings);
  if (!client) {
    return NextResponse.json({ error: "Unosend is not configured." }, { status: 400 });
  }

  const result = await client.verifyDomain(domainId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ domain: result.data });
}
