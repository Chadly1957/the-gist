import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, firstName } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    // Save to local DB
    const existing = await prisma.subscriber.findUnique({ where: { email } });
    if (existing) {
      if (existing.active) {
        return NextResponse.json(
          { error: "This email is already subscribed." },
          { status: 409 }
        );
      }
      // Re-activate
      await prisma.subscriber.update({
        where: { email },
        data: { active: true, firstName: firstName || existing.firstName },
      });
    } else {
      await prisma.subscriber.create({
        data: { email, firstName: firstName || null },
      });
    }

    return NextResponse.json({
      message: "You're subscribed! Welcome to The Gist Decatur.",
    });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }
}
