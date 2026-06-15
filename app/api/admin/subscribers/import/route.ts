import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

interface ImportRow {
  email: string;
  firstName?: string;
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscribers }: { subscribers: ImportRow[] } = await req.json();

  if (!Array.isArray(subscribers) || subscribers.length === 0) {
    return NextResponse.json({ error: "No subscribers provided." }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;

  for (const row of subscribers) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) { skipped++; continue; }

    try {
      await prisma.subscriber.upsert({
        where: { email },
        update: { active: true, firstName: row.firstName || undefined },
        create: { email, firstName: row.firstName || null, active: true },
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ imported, skipped });
}
