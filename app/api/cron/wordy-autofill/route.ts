import { NextRequest, NextResponse } from "next/server";
import { autofillWordySchedule } from "@/lib/wordyAutofill";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    new URL(req.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await autofillWordySchedule(30);
  return NextResponse.json({ ok: true, ...result });
}
