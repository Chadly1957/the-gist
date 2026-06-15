import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    const subscriber = await prisma.subscriber.findUnique({ where: { email: normalized } });
    if (!subscriber || !subscriber.active) {
      // Return success regardless — don't leak whether an email exists
      return NextResponse.json({ ok: true });
    }

    await prisma.subscriber.update({
      where: { email: normalized },
      data: { active: false },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
