import { NextResponse } from "next/server";
import { getPresentingSponsor } from "@/lib/gameSponsor";

export const dynamic = "force-dynamic";

export async function GET() {
  const sponsor = await getPresentingSponsor();
  return NextResponse.json({ sponsor });
}
