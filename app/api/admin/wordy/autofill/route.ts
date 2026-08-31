import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { autofillWordySchedule } from "@/lib/wordyAutofill";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const daysAhead = Math.min(Math.max(Number(body?.daysAhead) || 30, 1), 90);

  const result = await autofillWordySchedule(daysAhead);
  return NextResponse.json({ ok: true, ...result });
}
