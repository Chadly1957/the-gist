import { getWorkspaceUrl, getWorkspace } from "@/lib/workspace";
import { workspaceUnique } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/welcome-email";

export async function POST(req: NextRequest) {
  try {
    const { email, firstName } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    const existing = await prisma.subscriber.findUnique({ where: await workspaceUnique("email", email) });
    if (existing?.active) {
      return NextResponse.json(
        { error: "This email is already subscribed." },
        { status: 409 }
      );
    }

    const subscriber = existing
      ? await prisma.subscriber.update({
          where: await workspaceUnique("email", email),
          data: { active: true, firstName: firstName || existing.firstName },
        })
      : await prisma.subscriber.create({
          data: { email, firstName: firstName || null },
        });

    const appUrl = await getWorkspaceUrl();
    try {
      await sendWelcomeEmail({ id: subscriber.id, email: subscriber.email }, appUrl);
    } catch {
      // Welcome email failure must not break the subscription itself
    }

    return NextResponse.json({
      message: `You're subscribed! Welcome to ${(await getWorkspace()).name}.`,
    });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }
}
